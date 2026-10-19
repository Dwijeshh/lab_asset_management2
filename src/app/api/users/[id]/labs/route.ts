import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { db } from '@/db';
import { users, labs, labAssignments } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth-jwt';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { logger, sanitizeError } from '@/lib/logger';

// GET /api/users/[id]/labs — list assigned labs for a main technician
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Only admin or the user themselves may list assigned labs
    if (session.user.role !== 'admin' && session.user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = userRows[0];
    if (targetUser.role !== 'main_technician') {
      return NextResponse.json({ error: 'User is not a head technician' }, { status: 400 });
    }

    const assignedLabs = await db
      .select({
        id: labs.id,
        name: labs.name,
        code: labs.code,
        department: labs.department,
        building: labs.building,
        floor: labs.floor,
        roomNumber: labs.roomNumber,
        collegeId: labs.collegeId,
        isActive: labs.isActive,
        assignedAt: labAssignments.createdAt,
      })
      .from(labAssignments)
      .innerJoin(labs, eq(labAssignments.labId, labs.id))
      .where(eq(labAssignments.userId, userId));

    return NextResponse.json({ data: assignedLabs, labs: assignedLabs });
  } catch (error) {
    logger.error('Error listing user labs', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

// POST /api/users/[id]/labs — assign a lab to a head technician (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }
    throw error;
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const clientId = getClientIdentifier(request);
    await rateLimit(`users:labs:post:${clientId}`, { windowMs: 60000, maxRequests: 30 });

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>;
    const labId = parseInt(body.labId, 10);
    if (isNaN(labId) || labId <= 0) {
      return NextResponse.json({ error: 'Invalid lab ID' }, { status: 400 });
    }

    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const targetUser = userRows[0];
    if (targetUser.role !== 'main_technician') {
      return NextResponse.json(
        { error: 'User must be a main technician to be assigned labs' },
        { status: 400 }
      );
    }

    const labRows = await db.select().from(labs).where(eq(labs.id, labId)).limit(1);
    if (labRows.length === 0) {
      return NextResponse.json({ error: 'Lab not found' }, { status: 404 });
    }
    const targetLab = labRows[0];

    // Must be in the same college
    if (targetLab.collegeId !== targetUser.collegeId) {
      return NextResponse.json(
        { error: 'Lab does not belong to the user’s college' },
        { status: 400 }
      );
    }

    await db
      .insert(labAssignments)
      .values({
        userId: targetUser.id,
        labId: targetLab.id,
        assignedById: session.user.id,
      })
      .onConflictDoNothing();

    return NextResponse.json({ message: 'Lab assigned successfully' }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }
    logger.error('Error assigning lab', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

// DELETE /api/users/[id]/labs — unassign a lab from a head technician (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }
    throw error;
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const clientId = getClientIdentifier(request);
    await rateLimit(`users:labs:delete:${clientId}`, { windowMs: 60000, maxRequests: 30 });

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    let labId: number | undefined;
    const urlLabId = request.nextUrl.searchParams.get('labId');
    if (urlLabId) {
      labId = parseInt(urlLabId, 10);
    } else {
      try {
        const parsedBody = await readJsonBody(request);
        if (!parsedBody.ok) return parsedBody.response;
        const body = parsedBody.data as Record<string, any>;
        if (body.labId) labId = parseInt(body.labId, 10);
      } catch {
        // body may be empty
      }
    }

    if (!labId || isNaN(labId) || labId <= 0) {
      return NextResponse.json({ error: 'Valid lab ID is required' }, { status: 400 });
    }

    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (userRows[0].role !== 'main_technician') {
      return NextResponse.json(
        { error: 'User must be a main technician' },
        { status: 400 }
      );
    }

    await db
      .delete(labAssignments)
      .where(and(eq(labAssignments.userId, userId), eq(labAssignments.labId, labId)));

    return NextResponse.json({ message: 'Lab unassigned successfully' });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }
    logger.error('Error unassigning lab', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

// PUT /api/users/[id]/labs — sync assigned labs (multi-select) for a head technician (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }
    throw error;
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const clientId = getClientIdentifier(request);
    await rateLimit(`users:labs:put:${clientId}`, { windowMs: 60000, maxRequests: 30 });

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>;
    const labIds: number[] = Array.isArray(body.labIds)
      ? body.labIds.map((l: unknown) => parseInt(String(l), 10)).filter((n: number) => !isNaN(n) && n > 0)
      : [];

    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const targetUser = userRows[0];
    if (targetUser.role !== 'main_technician') {
      return NextResponse.json(
        { error: 'User must be a main technician to be assigned labs' },
        { status: 400 }
      );
    }

    // Validate that all labs belong to targetUser.collegeId
    if (labIds.length > 0) {
      const selectedLabs = await db
        .select()
        .from(labs)
        .where(inArray(labs.id, labIds));
      if (selectedLabs.length !== labIds.length) {
        return NextResponse.json({ error: 'One or more specified labs do not exist' }, { status: 400 });
      }
      for (const lab of selectedLabs) {
        if (lab.collegeId !== targetUser.collegeId) {
          return NextResponse.json(
            { error: 'All assigned labs must belong to the user’s college' },
            { status: 400 }
          );
        }
      }
    }

    // Replace assignments
    await db.delete(labAssignments).where(eq(labAssignments.userId, userId));
    if (labIds.length > 0) {
      await db.insert(labAssignments).values(
        labIds.map((labId) => ({
          userId,
          labId,
          assignedById: session.user.id,
        }))
      );
    }

    return NextResponse.json({ message: 'Lab assignments updated successfully' });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }
    logger.error('Error syncing user labs', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

