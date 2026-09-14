import { NextResponse } from 'next/server';
import { db } from '@/db';
import { assets, assetRequests, assetLoans, users, notifications, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession, canAccessCollege } from '@/lib/auth-jwt';
import { logger, sanitizeError } from '@/lib/logger';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { assertCsrf, CsrfError } from '@/lib/csrf';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: 'Cross-origin request blocked' },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting - stricter for write actions
    const clientId = getClientIdentifier(request);
    await rateLimit(`requests:put:${clientId}`, { windowMs: 60000, maxRequests: 20 });

    const user = session.user;
    if (user.role !== 'admin' && user.role !== 'main_technician') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const requestId = parseInt(id);
    const body = await request.json();
    const { action, expectedReturnDate } = body; // action: 'approve' | 'reject'

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Fetch request + asset using a join (no Drizzle relational config needed)
    const rows = await db
      .select({
        request: assetRequests,
        asset: assets,
      })
      .from(assetRequests)
      .leftJoin(assets, eq(assetRequests.assetId, assets.id))
      .where(eq(assetRequests.id, requestId))
      .limit(1);

    if (!rows.length || !rows[0].asset) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const existingRequest = rows[0].request;
    const existingAsset = rows[0].asset;

    if (existingRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Request is already processed' }, { status: 400 });
    }

    // Single policy owner: non-admins may only process requests owned by
    // their own college.
    if (!canAccessCollege(session.user, existingRequest.ownerCollegeId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Apply the decision atomically: the status flip acts as the concurrency
    // guard, so a double-submit cannot approve twice or create two loans.
    const updated = await db.update(assetRequests)
      .set({
        status: newStatus,
        reviewedById: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(assetRequests.id, requestId), eq(assetRequests.status, 'pending')))
      .returning({ id: assetRequests.id });

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Request is already processed' }, { status: 400 });
    }

    // Return date for an approved loan: the approver may override it; the
    // borrower's proposed date is the fallback. Permanent transfers have none.
    let loanReturnDate: Date | null = null;
    if (existingRequest.loanType === 'temporary') {
      if (expectedReturnDate) {
        loanReturnDate = new Date(expectedReturnDate);
        if (isNaN(loanReturnDate.getTime())) {
          return NextResponse.json({ error: 'Invalid expectedReturnDate' }, { status: 400 });
        }
      } else {
        loanReturnDate = existingRequest.expectedReturnDate ?? null;
      }
    }

    let loanId: number | null = null;

    if (action === 'approve') {
      const loan = await db.insert(assetLoans).values({
        requestId,
        assetId: existingRequest.assetId,
        borrowerId: existingRequest.requesterId,
        borrowerLabId: existingRequest.requesterLabId,
        approverId: user.id,
        loanType: existingRequest.loanType,
        expectedReturnDate: loanReturnDate,
      }).returning();

      loanId = loan[0].id;

      if (existingRequest.loanType === 'permanent') {
        // Permanent: move asset to the requester's lab and keep status available
        await db.update(assets)
          .set({ labId: existingRequest.requesterLabId, collegeId: existingRequest.requesterCollegeId, updatedAt: new Date() })
          .where(eq(assets.id, existingRequest.assetId));
      } else {
        // Temporary: mark asset in_use
        await db.update(assets)
          .set({ status: 'in_use', updatedAt: new Date() })
          .where(eq(assets.id, existingRequest.assetId));
      }
    }

    // Notify requester
    await db.insert(notifications).values({
      userId: existingRequest.requesterId,
      type: action === 'approve' ? 'request_approved' : 'request_rejected',
      title: `Request ${action === 'approve' ? 'Approved ✅' : 'Rejected ❌'}`,
      message: `Your request to ${existingRequest.loanType === 'permanent' ? 'permanently transfer' : 'borrow'} "${existingAsset.name}" was ${action === 'approve' ? 'approved' : 'rejected'} by ${user.name}.`,
      relatedRequestId: requestId,
      relatedLoanId: loanId,
    });

    // Audit trail
    await db.insert(auditLogs).values({
      userId: user.id,
      action: action === 'approve' ? 'APPROVE' : 'REJECT',
      entityType: 'asset_request',
      entityId: requestId,
      changes: JSON.stringify({
        assetId: existingRequest.assetId,
        loanType: existingRequest.loanType,
        borrowerId: existingRequest.requesterId,
        loanId,
        expectedReturnDate: loanReturnDate?.toISOString() ?? null,
      }),
    });

    return NextResponse.json({ message: `Request ${newStatus} successfully` });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }

    logger.error('Error processing asset request', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
