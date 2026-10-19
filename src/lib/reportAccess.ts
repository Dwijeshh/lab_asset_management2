import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { labAssignments, labs, reportSettings } from '@/db/schema';
import type { SessionUser } from '@/lib/auth-jwt';

export async function resolveReportScope(user: SessionUser, params: URLSearchParams) {
  if (user.role !== 'admin' && user.role !== 'main_technician') throw new Error('FORBIDDEN');
  const requestedCollege = params.get('collegeId');
  const collegeId = user.role === 'admin' && requestedCollege ? Number(requestedCollege) : user.collegeId;
  if (!Number.isInteger(collegeId) || collegeId <= 0 || (user.role !== 'admin' && collegeId !== user.collegeId)) throw new Error('FORBIDDEN');
  const configured = await db.select().from(reportSettings).where(eq(reportSettings.collegeId, collegeId)).limit(1);
  const timezone = configured[0]?.timezone || process.env.INSTITUTION_TIMEZONE || 'Asia/Kolkata';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw new Error('Invalid institution timezone'); }
  let permitted: number[];
  if (user.role === 'admin') {
    permitted = (await db.select({ id: labs.id }).from(labs).where(eq(labs.collegeId, collegeId))).map((lab) => lab.id);
  } else {
    permitted = (await db.select({ labId: labAssignments.labId }).from(labAssignments).innerJoin(labs, eq(labAssignments.labId, labs.id))
      .where(and(eq(labAssignments.userId, user.id), eq(labs.collegeId, collegeId)))).map((row) => row.labId);
  }
  const selected = params.get('labIds')?.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0);
  const labIds = selected?.length ? selected : permitted;
  if (labIds.some((id) => !permitted.includes(id))) throw new Error('FORBIDDEN');
  return { collegeId, labIds: [...new Set(labIds)], timezone };
}
