import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { assets, labs, users } from '@/db/schema';
import { getSession, canAccessCollege, resolveCollegeFilter } from '@/lib/auth-jwt';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const conditions = [isNotNull(assets.removedAt)];
  if (session.user.role !== 'admin') conditions.push(eq(assets.collegeId, session.user.collegeId));
  if (session.user.role === 'technician') {
    if (!session.user.labId) return NextResponse.json({ data: [] });
    conditions.push(eq(assets.labId, session.user.labId));
  }
  let collegeFilter: number | null;
  try { collegeFilter = resolveCollegeFilter(session.user, request.nextUrl.searchParams.get('collegeId')); }
  catch { return NextResponse.json({ error: 'Invalid collegeId' }, { status: 400 }); }
  if (collegeFilter !== null) conditions.push(eq(assets.collegeId, collegeFilter));
  const rows = await db.select({ asset: assets, labName: labs.name, removedByName: users.name })
    .from(assets).leftJoin(labs, eq(assets.labId, labs.id)).leftJoin(users, eq(assets.removedById, users.id))
    .where(and(...conditions)).orderBy(desc(assets.removedAt)).limit(500);
  const visible = rows.filter((row) => canAccessCollege(session.user, row.asset.collegeId));
  return NextResponse.json({ data: visible });
}
