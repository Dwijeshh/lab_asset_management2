import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { getSession, resolveCollegeFilter } from '@/lib/auth-jwt';
import { validatePagination } from '@/lib/validation';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { logger, sanitizeError } from '@/lib/logger';

const actions = new Set(['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT']);
const entityTypes = new Set(['asset', 'asset_request', 'device_request', 'asset_loan', 'user', 'lab']);

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'admin' && session.user.role !== 'main_technician') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await rateLimit(`audit-logs:get:${session.user.id}:${getClientIdentifier(request)}`, { windowMs: 60000, maxRequests: 60 });

    const params = request.nextUrl.searchParams;
    const { page, limit } = validatePagination(params);
    let collegeId: number | null;
    try {
      collegeId = resolveCollegeFilter(session.user, params.get('collegeId'));
    } catch {
      return NextResponse.json({ error: 'Invalid institution.' }, { status: 400 });
    }

    const action = params.get('action');
    const entityType = params.get('entityType');
    if ((action && !actions.has(action)) || (entityType && !entityTypes.has(entityType))) {
      return NextResponse.json({ error: 'Invalid log filter.' }, { status: 400 });
    }

    const conditions: SQL[] = [];
    if (collegeId !== null) {
      conditions.push(or(eq(auditLogs.collegeId, collegeId), eq(auditLogs.relatedCollegeId, collegeId))!);
    }
    if (action) conditions.push(eq(auditLogs.action, action));
    if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
    const filter = conditions.length ? and(...conditions) : undefined;

    const [rows, totalRows] = await Promise.all([
      db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        changes: auditLogs.changes,
        collegeId: auditLogs.collegeId,
        relatedCollegeId: auditLogs.relatedCollegeId,
        createdAt: auditLogs.createdAt,
        actor: { id: users.id, name: users.name, email: users.email },
      }).from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(filter)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(limit).offset((page - 1) * limit),
      db.select({ total: count() }).from(auditLogs).where(filter),
    ]);

    return NextResponse.json({
      data: rows,
      pagination: { page, limit, total: totalRows[0]?.total ?? 0 },
    });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    logger.error('Error listing audit logs', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
