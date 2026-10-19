import { NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { db } from '@/db';
import { assets, assetRequests, assetLoans, users, notifications, auditLogs, labAssignments, labs } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
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
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>;
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

    if (existingAsset.removedAt && action === 'approve') {
      return NextResponse.json({ error: 'Removed assets cannot be borrowed or transferred' }, { status: 409 });
    }

    if (existingRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Request is already processed' }, { status: 400 });
    }

    // Single policy owner: non-admins may only process requests owned by
    // their own college.
    if (!canAccessCollege(session.user, existingRequest.ownerCollegeId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
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

    const decision = await db.transaction(async (tx) => {
      const [lockedAsset] = await tx.select().from(assets).where(eq(assets.id, existingRequest.assetId)).for('update').limit(1);
      if (!lockedAsset || (action === 'approve' && lockedAsset.removedAt)) return { status: 409 as const, error: 'Removed or missing assets cannot be borrowed or transferred' };
      const [lockedRequest] = await tx.select().from(assetRequests).where(eq(assetRequests.id, requestId)).for('update').limit(1);
      if (!lockedRequest || lockedRequest.status !== 'pending') return { status: 400 as const, error: 'Request is already processed' };

      if (!canAccessCollege(user, lockedAsset.collegeId) || lockedAsset.collegeId !== lockedRequest.ownerCollegeId) {
        return { status: 403 as const, error: 'Forbidden' };
      }
      if (user.role === 'main_technician') {
        // A head technician may review a request only for the source lab they
        // currently manage. Permanent transfers also affect the destination.
        const requiredLabIds = [lockedAsset.labId];
        if (action === 'approve' && lockedRequest.loanType === 'permanent') {
          requiredLabIds.push(lockedRequest.requesterLabId);
        }
        const assignments = await tx.select({ labId: labAssignments.labId, collegeId: labs.collegeId })
          .from(labAssignments)
          .innerJoin(labs, eq(labAssignments.labId, labs.id))
          .where(and(
            eq(labAssignments.userId, user.id),
            inArray(labAssignments.labId, [...new Set(requiredLabIds)]),
          ));
        const assignedIds = new Set(assignments.filter((row) => row.collegeId === user.collegeId).map((row) => row.labId));
        if (requiredLabIds.some((labId) => !assignedIds.has(labId))) {
          return { status: 403 as const, error: 'You are not assigned to the lab affected by this request' };
        }
      }

      const [updated] = await tx.update(assetRequests).set({ status: newStatus, reviewedById: user.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(assetRequests.id, requestId), eq(assetRequests.status, 'pending'))).returning({ id: assetRequests.id });
      if (!updated) return { status: 400 as const, error: 'Request is already processed' };
      let loanId: number | null = null;
      if (action === 'approve') {
        const [loan] = await tx.insert(assetLoans).values({ requestId, assetId: lockedRequest.assetId, borrowerId: lockedRequest.requesterId, borrowerLabId: lockedRequest.requesterLabId, approverId: user.id, loanType: lockedRequest.loanType, expectedReturnDate: loanReturnDate }).returning();
        loanId = loan.id;
        if (lockedRequest.loanType === 'permanent') await tx.update(assets).set({ labId: lockedRequest.requesterLabId, collegeId: lockedRequest.requesterCollegeId, updatedAt: new Date() }).where(eq(assets.id, lockedRequest.assetId));
        else await tx.update(assets).set({ status: 'in_use', updatedAt: new Date() }).where(eq(assets.id, lockedRequest.assetId));
      }
      return { status: 200 as const, loanId };
    });
    if (decision.status !== 200) return NextResponse.json({ error: decision.error }, { status: decision.status });
    const loanId = decision.loanId;

    // Notify requester
    await db.insert(notifications).values({
      userId: existingRequest.requesterId,
      type: action === 'approve' ? 'request_approved' : 'request_rejected',
      title: `Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
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
