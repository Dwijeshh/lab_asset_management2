import { NextRequest, NextResponse } from 'next/server';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { assets, labs } from '@/db/schema';
import { getSession } from '@/lib/auth-jwt';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { logger, sanitizeError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.user.labId) return NextResponse.json({ error: 'Assign a destination lab before requesting devices.' }, { status: 403 });

    await rateLimit(`device-options:${session.user.id}:${getClientIdentifier(request)}`, { windowMs: 60000, maxRequests: 60 });
    const options = await db.select({
      name: assets.name,
      category: assets.category,
      model: assets.model,
      available: count(),
    })
      .from(assets)
      .innerJoin(labs, eq(assets.labId, labs.id))
      .where(and(
        eq(assets.collegeId, session.user.collegeId),
        eq(labs.collegeId, session.user.collegeId),
        ne(assets.labId, session.user.labId),
        eq(assets.status, 'available'),
        sql`NOT EXISTS (SELECT 1 FROM asset_loans loan WHERE loan.asset_id = ${assets.id} AND loan.status = 'active')`,
      ))
      .groupBy(assets.name, assets.category, assets.model)
      .orderBy(asc(assets.name), asc(assets.model));

    return NextResponse.json({ data: options });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    logger.error('Error listing requestable devices', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
