import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { assets } from '@/db/schema';
import { desc, ilike, or, eq, and } from 'drizzle-orm';
import { validateSearchParams, validateAssetInput, ValidationError } from '@/lib/validation';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { validateApiKey, UnauthorizedError } from '@/lib/auth';
import { logger, sanitizeError } from '@/lib/logger';
import { getSession } from '@/lib/auth-jwt';

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
    rateLimit(`assets:get:${clientId}`, { windowMs: 60000, maxRequests: 60 });

    // Validate and sanitize search parameters
    const params = validateSearchParams(request.nextUrl.searchParams);

    let query = db.select().from(assets);
    const conditions = [];
    
    if (params.search) {
      conditions.push(
        or(
          ilike(assets.name, `%${params.search}%`),
          ilike(assets.serialNumber, `%${params.search}%`),
          ilike(assets.manufacturer, `%${params.search}%`),
          ilike(assets.location, `%${params.search}%`)
        )
      );
    }
    
    if (params.status) {
      conditions.push(eq(assets.status, params.status));
    }
    
    if (params.category) {
      conditions.push(eq(assets.category, params.category));
    }

    let allAssets;
    if (conditions.length > 0) {
      // @ts-ignore - Drizzle types can be complex
      allAssets = await query
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(assets.createdAt))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit);
    } else {
      allAssets = await query
        .orderBy(desc(assets.createdAt))
        .limit(params.limit)
        .offset((params.page - 1) * params.limit);
    }

    return NextResponse.json({
      data: allAssets,
      pagination: {
        page: params.page,
        limit: params.limit,
      }
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

    logger.error('Error fetching assets', { error });
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication (optional - uncomment to require API key)
    // validateApiKey(request);

    // Rate limiting - stricter for writes
    const clientId = getClientIdentifier(request);
    rateLimit(`assets:post:${clientId}`, { windowMs: 60000, maxRequests: 20 });

    // Parse and validate request body
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = validateAssetInput(body);
    
    // Use lab from request or user's default lab
    const labId = body.labId || session.user.labId;
    if (!labId) {
      return NextResponse.json(
        { error: 'Lab ID is required. Please specify a lab or set your default lab.' },
        { status: 400 }
      );
    }
    
    const newAsset = await db.insert(assets).values({
      name: validatedData.name,
      category: validatedData.category,
      manufacturer: validatedData.manufacturer || null,
      model: validatedData.model || null,
      serialNumber: validatedData.serialNumber || null,
      labId: labId,
      location: validatedData.location,
      status: validatedData.status,
      purchaseDate: validatedData.purchaseDate || null,
      warrantyExpiry: validatedData.warrantyExpiry || null,
      notes: validatedData.notes || null,
      createdById: session.user.id,
      updatedById: session.user.id,
    }).returning();

    logger.info('Asset created', { assetId: newAsset[0].id, name: newAsset[0].name });

    return NextResponse.json(newAsset[0], { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { 
          status: 429,
          headers: { 'Retry-After': error.retryAfter.toString() }
        }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    logger.error('Error creating asset', { error });
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}