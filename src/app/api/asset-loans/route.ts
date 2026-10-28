import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/db';
import { assets, assetLoans, users, labs } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { validatePagination } from '@/lib/validation';
import { getSession, resolveCollegeFilter } from '@/lib/auth-jwt';
import { logger, sanitizeError } from '@/lib/logger';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const clientId = getClientIdentifier(request);
    await rateLimit(`loans:get:${clientId}`, { windowMs: 60000, maxRequests: 60 });

    const { page, limit } = validatePagination(request.nextUrl.searchParams);
    const user = session.user;
    let collegeFilter: number | null;
    try {
      collegeFilter = resolveCollegeFilter(user, request.nextUrl.searchParams.get('collegeId'));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid collegeId' }, { status: 400 });
    }
    let loans;

    const baseQuery = db
      .select({
        loan: assetLoans,
        asset: {
          name: assets.name,
          category: assets.category,
          serialNumber: assets.serialNumber,
          collegeId: assets.collegeId,
        },
        borrower: {
          name: users.name,
          email: users.email,
        },
        lab: {
          name: labs.name,
        }
      })
      .from(assetLoans)
      .leftJoin(assets, eq(assetLoans.assetId, assets.id))
      .leftJoin(users, eq(assetLoans.borrowerId, users.id))
      .leftJoin(labs, eq(assetLoans.borrowerLabId, labs.id));

    if (user.role === 'admin') {
      loans = await baseQuery
        .where(collegeFilter === null
          ? eq(assetLoans.status, 'active')
          : and(eq(assets.collegeId, collegeFilter), eq(assetLoans.status, 'active')))
        .orderBy(desc(assetLoans.loanDate))
        .limit(limit)
        .offset((page - 1) * limit);
    } else if (user.role === 'main_technician') {
      // Return loans where the asset belongs to the main tech's college
      // or the borrower belongs to the main tech's college.
      // Since it's intra-college, borrower's college == asset's college == main tech's college
      loans = await baseQuery
        .where(and(eq(assets.collegeId, user.collegeId), eq(assetLoans.status, 'active')))
        .orderBy(desc(assetLoans.loanDate))
        .limit(limit)
        .offset((page - 1) * limit);
    } else {
      loans = await baseQuery
        .where(and(eq(assetLoans.borrowerId, user.id), eq(assetLoans.status, 'active')))
        .orderBy(desc(assetLoans.loanDate))
        .limit(limit)
        .offset((page - 1) * limit);
    }

    return NextResponse.json({
      data: loans,
      pagination: { page, limit },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }

    logger.error('Error fetching asset loans', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
