import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { assets, deviceRequests, labs } from '@/db/schema';
import { getSession, canAccessCollege } from '@/lib/auth-jwt';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { logger, sanitizeError } from '@/lib/logger';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'admin' && session.user.role !== 'main_technician') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await rateLimit(`device-candidates:${session.user.id}:${getClientIdentifier(request)}`, { windowMs: 60000, maxRequests: 60 });
    const { id } = await params;
    if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const [deviceRequest] = await db.select().from(deviceRequests).where(eq(deviceRequests.id, Number(id))).limit(1);
    if (!deviceRequest || !canAccessCollege(session.user, deviceRequest.collegeId)) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }
    if (deviceRequest.status !== 'pending') return NextResponse.json({ error: 'Request is already processed.' }, { status: 400 });

    const candidates = await db.select({
      id: assets.id,
      name: assets.name,
      model: assets.model,
      serialNumber: assets.serialNumber,
      location: assets.location,
      labId: labs.id,
      labName: labs.name,
      labCode: labs.code,
    })
      .from(assets)
      .innerJoin(labs, eq(assets.labId, labs.id))
      .where(and(
        eq(assets.collegeId, deviceRequest.collegeId),
        eq(labs.collegeId, deviceRequest.collegeId),
        ne(assets.labId, deviceRequest.requesterLabId),
        eq(assets.status, 'available'),
        eq(assets.name, deviceRequest.assetName),
        eq(assets.category, deviceRequest.category),
        deviceRequest.model === null ? isNull(assets.model) : eq(assets.model, deviceRequest.model),
        sql`NOT EXISTS (SELECT 1 FROM asset_loans loan WHERE loan.asset_id = ${assets.id} AND loan.status = 'active')`,
      ))
      .orderBy(asc(labs.name), asc(assets.serialNumber), asc(assets.id))
      .limit(500);
    return NextResponse.json({ data: candidates });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    logger.error('Error listing device candidates', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
