import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { labs, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession, canAccessCollege } from '@/lib/auth-jwt';
import { logger, sanitizeError } from '@/lib/logger';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const clientId = getClientIdentifier(request);
    await rateLimit(`labs:get:${clientId}`, { windowMs: 60000, maxRequests: 60 });

    const { id } = await params;
    const labId = parseInt(id, 10);

    if (isNaN(labId) || labId <= 0) {
      return NextResponse.json(
        { error: 'Invalid lab ID' },
        { status: 400 }
      );
    }

    // Get lab details
    const labResult = await db
      .select()
      .from(labs)
      .where(eq(labs.id, labId))
      .limit(1);

    if (labResult.length === 0) {
      return NextResponse.json(
        { error: 'Lab not found' },
        { status: 404 }
      );
    }

    const lab = labResult[0];

    // Check if lab belongs to user's college (single policy owner)
    if (!canAccessCollege(session.user, lab.collegeId)) {
      return NextResponse.json(
        { error: 'Access denied: You do not have permission to access laboratories from other institutions' },
        { status: 403 }
      );
    }

    // Get users assigned to this lab
    const labUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        employeeId: users.employeeId,
      })
      .from(users)
      .where(eq(users.labId, labId));

    return NextResponse.json({
      lab,
      users: labUsers,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        {
          status: 429,
          headers: { 'Retry-After': error.retryAfter.toString() }
        }
      );
    }

    logger.error('Error fetching lab details', { error });
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}