import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { labs, colleges } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSession, canCreateLabs } from '@/lib/auth-jwt';
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
    rateLimit(`labs:get:${clientId}`, { windowMs: 60000, maxRequests: 60 });

    const { searchParams } = new URL(request.url);
    const collegeIdParam = searchParams.get('collegeId');

    let filterCollegeId: number | null = null;
    if (session.user.role === 'admin') {
      if (collegeIdParam && collegeIdParam !== 'all') {
        filterCollegeId = parseInt(collegeIdParam);
      }
    } else {
      // Non-admins are strictly locked to their assigned college
      filterCollegeId = session.user.collegeId;
    }

    let allLabs;
    if (filterCollegeId !== null) {
      allLabs = await db
        .select()
        .from(labs)
        .where(eq(labs.collegeId, filterCollegeId))
        .orderBy(desc(labs.createdAt));
    } else {
      // Admin viewing all colleges
      allLabs = await db
        .select()
        .from(labs)
        .orderBy(desc(labs.createdAt));
    }

    return NextResponse.json({ data: allLabs });
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

    logger.error('Error fetching labs', { error });
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permission: only admin and main_technician can create labs
    if (!canCreateLabs(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to create labs' },
        { status: 403 }
      );
    }

    // Rate limiting
    const clientId = getClientIdentifier(request);
    rateLimit(`labs:post:${clientId}`, { windowMs: 60000, maxRequests: 20 });

    const body = await request.json();

    // Validation
    if (!body.name || !body.code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      );
    }

    const targetCollegeId = (session.user.role === 'admin' && body.collegeId)
      ? parseInt(body.collegeId)
      : session.user.collegeId;

    const newLab = await db.insert(labs).values({
      name: body.name,
      code: body.code,
      department: body.department || null,
      building: body.building || null,
      floor: body.floor || null,
      roomNumber: body.roomNumber || null,
      collegeId: targetCollegeId,
      capacity: body.capacity || null,
      isActive: true,
    }).returning();

    logger.info('Lab created', { labId: newLab[0].id, userId: session.user.id });

    return NextResponse.json(newLab[0], { status: 201 });
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

    logger.error('Error creating lab', { error });
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}