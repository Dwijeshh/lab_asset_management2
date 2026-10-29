import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { assets, assetLoans, assetRequests, auditLogs, deviceRequests, labs, notifications } from '@/db/schema';
import { getSession, canAccessCollege } from '@/lib/auth-jwt';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { logger, sanitizeError } from '@/lib/logger';

class DecisionError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    throw error;
  }

  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user;
    if (user.role !== 'admin' && user.role !== 'main_technician') {
      return NextResponse.json({ error: 'Only a main technician or administrator can assign devices.' }, { status: 403 });
    }
    await rateLimit(`device-requests:put:${user.id}:${getClientIdentifier(request)}`, { windowMs: 60000, maxRequests: 20 });
    const { id } = await params;
    if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const requestId = Number(id);
    const body = await request.json();
    const action = body.action;
    if (action !== 'approve' && action !== 'reject') return NextResponse.json({ error: 'Choose approve or reject.' }, { status: 400 });
    const chosenIds = body.assetIds;
    if (action === 'approve' && (!Array.isArray(chosenIds) || chosenIds.length > 20 ||
        chosenIds.some((assetId: unknown) => !Number.isSafeInteger(assetId) || Number(assetId) <= 0) ||
        new Set(chosenIds).size !== chosenIds.length)) {
      return NextResponse.json({ error: 'Choose distinct available assets for this request.' }, { status: 400 });
    }

    const result = await db.transaction(async tx => {
      const [pending] = await tx.select().from(deviceRequests)
        .where(eq(deviceRequests.id, requestId)).for('update').limit(1);
      if (!pending || !canAccessCollege(user, pending.collegeId)) throw new DecisionError('Request not found.', 404);
      if (pending.status !== 'pending') throw new DecisionError('Request is already processed.', 409);
      const [destination] = await tx.select({ collegeId: labs.collegeId }).from(labs)
        .where(eq(labs.id, pending.requesterLabId)).limit(1);
      if (!destination || destination.collegeId !== pending.collegeId) {
        throw new DecisionError('The destination lab is no longer in this institution.', 409);
      }

      let returnDate = pending.expectedReturnDate;
      if (action === 'approve' && pending.loanType === 'temporary' && body.expectedReturnDate) {
        returnDate = new Date(body.expectedReturnDate);
      }
      if (action === 'approve' && pending.loanType === 'temporary' && returnDate &&
          (Number.isNaN(returnDate.getTime()) || returnDate.getTime() <= Date.now())) {
        throw new DecisionError('Choose a future return date before approving.', 400);
      }
      if (action === 'approve' && pending.loanType === 'permanent' && body.expectedReturnDate) {
        throw new DecisionError('Permanent transfers do not have a return date.', 400);
      }

      if (action === 'approve') {
        const assetIds = chosenIds as number[];
        if (assetIds.length !== pending.quantity) {
          throw new DecisionError(`Select exactly ${pending.quantity} available units.`, 400);
        }
        const selected = await tx.select({ asset: assets, labCollegeId: labs.collegeId })
          .from(assets)
          .innerJoin(labs, eq(assets.labId, labs.id))
          .where(inArray(assets.id, assetIds))
          .for('update');
        if (selected.length !== pending.quantity || selected.some(({ asset, labCollegeId }) =>
          asset.collegeId !== pending.collegeId || labCollegeId !== pending.collegeId ||
          asset.labId === pending.requesterLabId || asset.status !== 'available' ||
          asset.name !== pending.assetName || asset.category !== pending.category || asset.model !== pending.model)) {
          throw new DecisionError('One or more selected devices are no longer available from this institution.', 409);
        }
        const activeLoans = await tx.select({ id: assetLoans.id }).from(assetLoans)
          .where(and(inArray(assetLoans.assetId, assetIds), eq(assetLoans.status, 'active'))).limit(1);
        if (activeLoans.length) throw new DecisionError('One or more selected devices already have an active loan.', 409);

        for (const { asset } of selected) {
          const changed = await tx.update(assets)
            .set(pending.loanType === 'temporary'
              ? { status: 'in_use', updatedAt: new Date(), updatedById: user.id }
              : { labId: pending.requesterLabId, collegeId: pending.collegeId, updatedAt: new Date(), updatedById: user.id })
            .where(and(eq(assets.id, asset.id), eq(assets.status, 'available'), eq(assets.labId, asset.labId)))
            .returning({ id: assets.id });
          if (!changed.length) throw new DecisionError('A selected device changed during approval. Refresh and try again.', 409);
          const [assignedRequest] = await tx.insert(assetRequests).values({
            deviceRequestId: pending.id,
            assetId: asset.id,
            requesterId: pending.requesterId,
            requesterLabId: pending.requesterLabId,
            requesterCollegeId: pending.collegeId,
            ownerCollegeId: pending.collegeId,
            loanType: pending.loanType,
            status: 'approved',
            notes: pending.notes,
            expectedReturnDate: pending.loanType === 'temporary' ? returnDate : null,
            reviewedById: user.id,
            reviewedAt: new Date(),
          }).returning({ id: assetRequests.id });
          await tx.insert(assetLoans).values({
            requestId: assignedRequest.id,
            assetId: asset.id,
            borrowerId: pending.requesterId,
            borrowerLabId: pending.requesterLabId,
            approverId: user.id,
            loanType: pending.loanType,
            expectedReturnDate: pending.loanType === 'temporary' ? returnDate : null,
          });
        }
      }

      const [processed] = await tx.update(deviceRequests).set({
        status: action === 'approve' ? 'approved' : 'rejected',
        expectedReturnDate: action === 'approve' && pending.loanType === 'temporary' ? returnDate : pending.expectedReturnDate,
        reviewedById: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(deviceRequests.id, pending.id)).returning();
      await tx.insert(notifications).values({
        userId: pending.requesterId,
        type: action === 'approve' ? 'request_approved' : 'request_rejected',
        title: action === 'approve' ? 'Device request approved' : 'Device request rejected',
        message: action === 'approve'
          ? `${user.name} assigned ${pending.quantity} × ${pending.assetName} to your request.`
          : `${user.name} rejected your request for ${pending.quantity} × ${pending.assetName}.`,
        relatedDeviceRequestId: pending.id,
      });
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: action === 'approve' ? 'APPROVE' : 'REJECT',
        entityType: 'device_request',
        entityId: pending.id,
        changes: JSON.stringify({ quantity: pending.quantity, assetIds: action === 'approve' ? chosenIds : [], loanType: pending.loanType }),
      });
      return processed;
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof DecisionError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    logger.error('Error processing device request', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
