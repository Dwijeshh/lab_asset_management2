import { NextResponse } from 'next/server';
import { db } from '@/db';
import { assets, assetRequests, assetLoans, users, notifications } from '@/db/schema';
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

    if (user.role !== 'admin' && existingRequest.ownerCollegeId !== user.collegeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await db.update(assetRequests)
      .set({
        status: newStatus,
        reviewedById: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(assetRequests.id, requestId));

    let loanId: number | null = null;

    if (action === 'approve') {
      const loan = await db.insert(assetLoans).values({
        requestId,
        assetId: existingRequest.assetId,
        borrowerId: existingRequest.requesterId,
        borrowerLabId: existingRequest.requesterLabId,
        approverId: user.id,
        loanType: existingRequest.loanType,
        expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      }).returning();

      loanId = loan[0].id;

      if (existingRequest.loanType === 'permanent') {
        // Permanent: move asset to the requester's lab and keep status available
        await db.update(assets)
          .set({ labId: existingRequest.requesterLabId, updatedAt: new Date() })
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

    return NextResponse.json({ message: `Request ${newStatus} successfully` });
  } catch (error) {
    console.error('Error processing asset request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
