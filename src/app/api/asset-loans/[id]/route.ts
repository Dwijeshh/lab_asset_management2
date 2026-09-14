import { NextResponse } from 'next/server';
import { db } from '@/db';
import { assets, assetLoans, notifications, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

    const user = session.user;
    if (user.role !== 'admin' && user.role !== 'main_technician') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Rate limiting - stricter for write actions
    const clientId = getClientIdentifier(request);
    await rateLimit(`loans:put:${clientId}`, { windowMs: 60000, maxRequests: 20 });

    const { id } = await params;
    const loanId = parseInt(id);

    // Use join to avoid needing Drizzle relational config
    const rows = await db
      .select({
        loan: assetLoans,
        asset: assets,
      })
      .from(assetLoans)
      .leftJoin(assets, eq(assetLoans.assetId, assets.id))
      .where(eq(assetLoans.id, loanId))
      .limit(1);

    if (!rows.length || !rows[0].asset) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const loan = rows[0].loan;
    const asset = rows[0].asset;

    if (loan.status === 'returned') {
      return NextResponse.json({ error: 'Loan is already returned' }, { status: 400 });
    }

    // Single policy owner: non-admins may only return loans whose asset
    // belongs to their own college.
    if (!canAccessCollege(session.user, asset.collegeId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update loan to returned
    await db.update(assetLoans)
      .set({
        status: 'returned',
        actualReturnDate: new Date(),
      })
      .where(eq(assetLoans.id, loanId));

    // Update asset back to available
    await db.update(assets)
      .set({ status: 'available', updatedAt: new Date() })
      .where(eq(assets.id, loan.assetId));

    // Notify borrower
    await db.insert(notifications).values({
      userId: loan.borrowerId,
      type: 'loan_returned',
      title: 'Asset Returned 🔄',
      message: `The loan for "${asset.name}" has been marked as returned by ${user.name}.`,
      relatedLoanId: loanId,
    });

    // Audit trail
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'asset_loan',
      entityId: loanId,
      changes: JSON.stringify({
        assetId: loan.assetId,
        borrowerId: loan.borrowerId,
        status: 'returned',
        loanDate: loan.loanDate,
        wasOverdue:
          loan.expectedReturnDate !== null && loan.expectedReturnDate < new Date(),
      }),
    });

    return NextResponse.json({ message: 'Asset marked as returned successfully' });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }

    logger.error('Error returning asset loan', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
