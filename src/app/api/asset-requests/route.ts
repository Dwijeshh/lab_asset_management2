import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/db';
import { assets, assetRequests, users, notifications, auditLogs } from '@/db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { validatePagination } from '@/lib/validation';
import { getSession } from '@/lib/auth-jwt';
import { logger, sanitizeError } from '@/lib/logger';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { assertCsrf, CsrfError } from '@/lib/csrf';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { page, limit } = validatePagination(request.nextUrl.searchParams);
    const user = session.user;
    let requests;

    if (user.role === 'admin') {
      requests = await db
        .select({
          request: assetRequests,
          asset: {
            name: assets.name,
            category: assets.category,
            serialNumber: assets.serialNumber,
          },
          requester: {
            name: users.name,
            email: users.email,
          },
        })
        .from(assetRequests)
        .leftJoin(assets, eq(assetRequests.assetId, assets.id))
        .leftJoin(users, eq(assetRequests.requesterId, users.id))
        .orderBy(desc(assetRequests.createdAt))
        .limit(limit)
        .offset((page - 1) * limit);
    } else if (user.role === 'main_technician') {
      requests = await db
        .select({
          request: assetRequests,
          asset: {
            name: assets.name,
            category: assets.category,
            serialNumber: assets.serialNumber,
          },
          requester: {
            name: users.name,
            email: users.email,
          },
        })
        .from(assetRequests)
        .leftJoin(assets, eq(assetRequests.assetId, assets.id))
        .leftJoin(users, eq(assetRequests.requesterId, users.id))
        .where(
          or(
            eq(assetRequests.ownerCollegeId, user.collegeId),
            eq(assetRequests.requesterId, user.id)
          )
        )
        .orderBy(desc(assetRequests.createdAt))
        .limit(limit)
        .offset((page - 1) * limit);
    } else {
      requests = await db
        .select({
          request: assetRequests,
          asset: {
            name: assets.name,
            category: assets.category,
            serialNumber: assets.serialNumber,
          },
          requester: {
            name: users.name,
            email: users.email,
          },
        })
        .from(assetRequests)
        .leftJoin(assets, eq(assetRequests.assetId, assets.id))
        .leftJoin(users, eq(assetRequests.requesterId, users.id))
        .where(eq(assetRequests.requesterId, user.id))
        .orderBy(desc(assetRequests.createdAt))
        .limit(limit)
        .offset((page - 1) * limit);
    }

    return NextResponse.json({
      data: requests,
      pagination: { page, limit },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }

    logger.error('Error fetching asset requests', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertCsrf(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: 'Cross-origin request blocked' },
        { status: 403 }
      );
    }
    throw error;
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting - stricter for writes
    const clientId = getClientIdentifier(request);
    await rateLimit(`requests:post:${clientId}`, { windowMs: 60000, maxRequests: 20 });

    const user = session.user;
    if (!user.labId) {
      return NextResponse.json({ error: 'You must be assigned to a lab to request assets' }, { status: 403 });
    }

    const body = await request.json();
    const { assetId, loanType, notes, expectedReturnDate } = body;

    if (!assetId || !loanType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (loanType !== 'temporary' && loanType !== 'permanent') {
      return NextResponse.json({ error: 'Invalid loan type' }, { status: 400 });
    }

    // Proposed return date: optional, temporary loans only, must be in the future.
    let parsedReturnDate: Date | null = null;
    if (expectedReturnDate !== undefined && expectedReturnDate !== null && expectedReturnDate !== '') {
      if (loanType !== 'temporary') {
        return NextResponse.json(
          { error: 'Expected return date only applies to temporary loans' },
          { status: 400 }
        );
      }
      parsedReturnDate = new Date(expectedReturnDate);
      if (isNaN(parsedReturnDate.getTime()) || parsedReturnDate.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: 'Expected return date must be a valid future date' },
          { status: 400 }
        );
      }
    }

    const parsedAssetId = parseInt(assetId, 10);
    if (isNaN(parsedAssetId) || parsedAssetId <= 0) {
      return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
    }

    // A requester may only have one open request per asset; duplicates would
    // notify the owner college repeatedly and could double-approve.
    const openRequest = await db.query.assetRequests.findFirst({
      where: and(
        eq(assetRequests.assetId, parsedAssetId),
        eq(assetRequests.requesterId, user.id),
        eq(assetRequests.status, 'pending')
      ),
    });
    if (openRequest) {
      return NextResponse.json(
        { error: 'You already have a pending request for this asset' },
        { status: 409 }
      );
    }

    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, parsedAssetId),
    });

    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    if (asset.status !== 'available') return NextResponse.json({ error: 'Asset is not available' }, { status: 400 });
    if (asset.collegeId !== user.collegeId) return NextResponse.json({ error: 'Cross-institution borrowing disabled' }, { status: 403 });
    if (asset.labId === user.labId) return NextResponse.json({ error: 'Asset is already in your lab' }, { status: 400 });

    const newRequest = await db.insert(assetRequests).values({
      assetId,
      requesterId: user.id,
      requesterLabId: user.labId,
      requesterCollegeId: user.collegeId,
      ownerCollegeId: asset.collegeId!,
      loanType,
      notes,
      expectedReturnDate: parsedReturnDate,
      status: 'pending',
    }).returning();

    // Audit trail
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'CREATE',
      entityType: 'asset_request',
      entityId: newRequest[0].id,
      changes: JSON.stringify({
        assetId,
        loanType,
        expectedReturnDate: parsedReturnDate?.toISOString() ?? null,
      }),
    });

    const mainTechs = await db.query.users.findMany({
      where: and(
        eq(users.collegeId, asset.collegeId!),
        eq(users.role, 'main_technician')
      ),
    });

    if (mainTechs.length > 0) {
      const notificationValues = mainTechs.map(tech => ({
        userId: tech.id,
        type: 'request_received' as const,
        title: 'New Asset Request',
        message: `${user.name} requested to ${loanType === 'permanent' ? 'permanently transfer' : 'borrow'} ${asset.name}.`,
        relatedRequestId: newRequest[0].id,
      }));
      
      await db.insert(notifications).values(notificationValues);
    }

    return NextResponse.json({ data: newRequest[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }

    logger.error('Error creating asset request', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
