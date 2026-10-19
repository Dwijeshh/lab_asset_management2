import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { assetModificationRequests, labAssignments, labs } from '@/db/schema';
import { canAccessCollege, type SessionUser } from '@/lib/auth-jwt';

type RequestScope = Pick<typeof assetModificationRequests.$inferSelect, 'collegeId' | 'labId' | 'requestedById'>;

export async function canViewModificationRequest(user: SessionUser, request: RequestScope): Promise<boolean> {
  if (user.role === 'admin') return canAccessCollege(user, request.collegeId);
  if (user.role === 'technician') {
    return request.requestedById === user.id && canAccessCollege(user, request.collegeId);
  }
  if (user.role === 'main_technician') {
    const assignment = await db
      .select({ id: labAssignments.id })
      .from(labAssignments)
      .innerJoin(labs, eq(labAssignments.labId, labs.id))
      .where(and(
        eq(labAssignments.userId, user.id),
        eq(labAssignments.labId, request.labId),
        eq(labs.collegeId, request.collegeId),
      ))
      .limit(1);
    return assignment.length > 0 && canAccessCollege(user, request.collegeId);
  }
  return false;
}
