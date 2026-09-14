import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { colleges } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getSession, resolveCollegeFilter } from '@/lib/auth-jwt';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { logger, sanitizeError } from '@/lib/logger';

export async function GET(request: NextRequest) {
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
    rateLimit(`colleges:get:${clientId}`, { windowMs: 60000, maxRequests: 60 });

    const user = session.user;

    // Single policy owner: admins see all (active) institutions, everyone
    // else only their assigned one.
    const collegeFilter = resolveCollegeFilter(user, null);

    const visibleColleges = await db
      .select()
      .from(colleges)
      .where(
        collegeFilter === null
          ? eq(colleges.isActive, true)
          : and(eq(colleges.id, collegeFilter), eq(colleges.isActive, true))
      )
      .orderBy(asc(colleges.id));

    return NextResponse.json({
      data: visibleColleges,
      userRole: user.role,
      userCollegeId: user.collegeId,
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

    logger.error('Error fetching colleges', { error });
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
