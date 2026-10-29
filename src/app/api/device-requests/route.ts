import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { assets, assetRequests, auditLogs, deviceRequests, labs, notifications, users } from '@/db/schema';
import { getSession, resolveCollegeFilter } from '@/lib/auth-jwt';
import { ASSET_CATEGORIES } from '@/lib/assets';
import { validatePagination } from '@/lib/validation';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { logger, sanitizeError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await rateLimit(`device-requests:get:${session.user.id}:${getClientIdentifier(request)}`, { windowMs: 60000, maxRequests: 60 });
    const { page, limit } = validatePagination(request.nextUrl.searchParams);
    let collegeFilter: number | null;
    try {
      collegeFilter = resolveCollegeFilter(session.user, request.nextUrl.searchParams.get('collegeId'));
    } catch {
      return NextResponse.json({ error: 'Invalid institution.' }, { status: 400 });
    }
    const visible = session.user.role === 'technician'
      ? eq(deviceRequests.requesterId, session.user.id)
      : collegeFilter === null ? undefined : eq(deviceRequests.collegeId, collegeFilter);
    const rows = await db.select({
      request: deviceRequests,
      requester: { name: users.name, email: users.email },
      destinationLab: { name: labs.name, code: labs.code },
    })
      .from(deviceRequests)
      .innerJoin(users, eq(deviceRequests.requesterId, users.id))
      .innerJoin(labs, eq(deviceRequests.requesterLabId, labs.id))
      .where(visible)
      .orderBy(desc(deviceRequests.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const ids = rows.map(row => row.request.id);
    const assigned = ids.length ? await db.select({
      deviceRequestId: assetRequests.deviceRequestId,
      assetId: assets.id,
      name: assets.name,
      serialNumber: assets.serialNumber,
    })
      .from(assetRequests)
      .innerJoin(assets, eq(assetRequests.assetId, assets.id))
      .where(inArray(assetRequests.deviceRequestId, ids)) : [];

    return NextResponse.json({ data: rows.map(row => ({
      ...row,
      assignedAssets: assigned.filter(asset => asset.deviceRequestId === row.request.id),
    })), pagination: { page, limit } });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    logger.error('Error listing device requests', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    if (!user.labId) return NextResponse.json({ error: 'Assign a destination lab before requesting devices.' }, { status: 403 });
    await rateLimit(`device-requests:post:${user.id}:${getClientIdentifier(request)}`, { windowMs: 60000, maxRequests: 20 });

    const body = await request.json();
    const assetName = typeof body.assetName === 'string' ? body.assetName.trim() : '';
    const model = body.model == null ? null : typeof body.model === 'string' ? body.model : undefined;
    const category = ASSET_CATEGORIES.find(item => item.value === body.category)?.value;
    const quantity = body.quantity;
    const loanType = body.loanType;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    if (!assetName || assetName.length > 255 || !category || model === undefined || (model !== null && model.length > 255) ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 20 ||
        (loanType !== 'temporary' && loanType !== 'permanent') || notes.length > 1000) {
      return NextResponse.json({ error: 'Choose a device and a quantity from 1 to 20.' }, { status: 400 });
    }

    let expectedReturnDate: Date | null = null;
    if (body.expectedReturnDate) {
      if (loanType !== 'temporary') return NextResponse.json({ error: 'Return date applies only to temporary loans.' }, { status: 400 });
      expectedReturnDate = new Date(body.expectedReturnDate);
      if (Number.isNaN(expectedReturnDate.getTime()) || expectedReturnDate.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Choose a future return date.' }, { status: 400 });
      }
    }

    const [destination] = await db.select({ collegeId: labs.collegeId }).from(labs).where(eq(labs.id, user.labId)).limit(1);
    if (!destination || destination.collegeId !== user.collegeId) {
      return NextResponse.json({ error: 'Your assigned laboratory is unavailable.' }, { status: 403 });
    }
    const availableWhere = and(
      eq(assets.collegeId, user.collegeId), eq(labs.collegeId, user.collegeId),
      ne(assets.labId, user.labId), eq(assets.status, 'available'),
      eq(assets.name, assetName), eq(assets.category, category),
      model === null ? isNull(assets.model) : eq(assets.model, model),
      sql`NOT EXISTS (SELECT 1 FROM asset_loans loan WHERE loan.asset_id = ${assets.id} AND loan.status = 'active')`,
    );
    const [stock] = await db.select({ available: count() }).from(assets).innerJoin(labs, eq(assets.labId, labs.id)).where(availableWhere);
    if ((stock?.available ?? 0) < quantity) {
      return NextResponse.json({ error: 'Not enough available units remain in other labs. Refresh the device list.' }, { status: 409 });
    }

    const mainTechs = await db.select({ id: users.id }).from(users).where(and(
      eq(users.collegeId, user.collegeId), eq(users.role, 'main_technician'), eq(users.isActive, true),
    ));
    if (mainTechs.length === 0) {
      return NextResponse.json({ error: 'No active main technician is assigned to your institution yet.' }, { status: 409 });
    }

    const [created] = await db.transaction(async tx => {
      const inserted = await tx.insert(deviceRequests).values({
        requesterId: user.id, requesterLabId: user.labId!, collegeId: user.collegeId,
        assetName, category, model, quantity, loanType,
        expectedReturnDate, notes: notes || null,
      }).returning();
      await tx.insert(notifications).values(mainTechs.map(tech => ({
        userId: tech.id,
        type: 'request_received' as const,
        title: 'New device request',
        message: `${user.name} requested ${quantity} × ${assetName} for their lab.`,
        relatedDeviceRequestId: inserted[0].id,
      })));
      await tx.insert(auditLogs).values({
        userId: user.id, action: 'CREATE', entityType: 'device_request', entityId: inserted[0].id,
        changes: JSON.stringify({ assetName, category, model, quantity, loanType, requesterLabId: user.labId }),
      });
      return inserted;
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    logger.error('Error creating device request', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
