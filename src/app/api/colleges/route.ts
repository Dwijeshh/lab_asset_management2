import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { colleges } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getSession } from '@/lib/auth-jwt';
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

    // Admin can see all institutions; Technicians only see their assigned institution
    if (user.role === 'admin') {
      const allColleges = await db
        .select()
        .from(colleges)
        .where(eq(colleges.isActive, true))
        .orderBy(asc(colleges.id));

      return NextResponse.json({
        data: allColleges,
        userRole: user.role,
        userCollegeId: user.collegeId,
      });
    } else {
      const userCollege = await db
        .select()
        .from(colleges)
        .where(and(eq(colleges.id, user.collegeId), eq(colleges.isActive, true)));

      return NextResponse.json({
        data: userCollege,
        userRole: user.role,
        userCollegeId: user.collegeId,
      });
    }
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
