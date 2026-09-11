import { NextResponse } from 'next/server';
import { db } from '@/db';
import { assets, assetLoans, notifications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth-jwt';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    if (user.role !== 'admin' && user.role !== 'main_technician') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    if (user.role !== 'admin' && asset.collegeId !== user.collegeId) {
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

    return NextResponse.json({ message: 'Asset marked as returned successfully' });
  } catch (error) {
    console.error('Error returning asset loan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
