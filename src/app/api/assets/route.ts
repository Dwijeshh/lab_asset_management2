import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/requestBody';
import { db } from '@/db';
import { assets, labs, assetTypes, assetTypeFields } from '@/db/schema';
import { desc, ilike, or, eq, and, isNull, inArray } from 'drizzle-orm';
import { validateSearchParams, validateAssetInput, ValidationError } from '@/lib/validation';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';
import { assertCsrf, CsrfError } from '@/lib/csrf';
import { logger, sanitizeError } from '@/lib/logger';
import { getSession, resolveCollegeFilter, parseCollegeIdParam, canAccessCollege, canManageLab } from '@/lib/auth-jwt';
import { logAudit } from '@/lib/audit';
import { notifyAssetChange } from '@/lib/notify';
import { validateCustomFieldValues } from '@/lib/customFields';

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
    await rateLimit(`assets:get:${clientId}`, { windowMs: 60000, maxRequests: 60 });

    // Validate and sanitize search parameters
    const params = validateSearchParams(request.nextUrl.searchParams);

    let query = db.select({ asset: assets, assetTypeName: assetTypes.name }).from(assets).leftJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id));
    const conditions = [];
    // Removed assets are available only through the explicit history endpoint.
    conditions.push(isNull(assets.removedAt));
    if (session.user.role === 'technician') {
      if (!session.user.labId) return NextResponse.json({ data: [], pagination: { page: params.page, limit: params.limit } });
      conditions.push(eq(assets.labId, session.user.labId));
    }
    
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
    
    // Multi-institution isolation (single policy owner: resolveCollegeFilter)
    let allAssets;
    const collegeIdParam = request.nextUrl.searchParams.get('collegeId');
    let collegeFilter: number | null;
    try {
      collegeFilter = resolveCollegeFilter(session.user, collegeIdParam);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid collegeId' },
        { status: 400 }
      );
    }
    if (collegeFilter !== null) {
      conditions.push(eq(assets.collegeId, collegeFilter));
    }

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

    const typeIds = [...new Set(allAssets.map((row) => row.asset.assetTypeId).filter((id): id is number => id !== null))];
    const definitions = typeIds.length ? await db.select().from(assetTypeFields).where(inArray(assetTypeFields.assetTypeId, typeIds)) : [];
    const labels = new Map<number, Record<string, string>>();
    for (const field of definitions) labels.set(field.assetTypeId, { ...(labels.get(field.assetTypeId) || {}), [field.fieldKey]: field.label });
    return NextResponse.json({
      data: allAssets.map((row) => ({
        ...row.asset,
        assetTypeName: row.assetTypeName,
        customFieldDisplay: Object.entries(row.asset.customFields || {}).map(([key, value]) => ({ label: labels.get(row.asset.assetTypeId || 0)?.[key] || key, value })),
      })),
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
    // Rate limiting - stricter for writes
    const clientId = getClientIdentifier(request);
    await rateLimit(`assets:post:${clientId}`, { windowMs: 60000, maxRequests: 20 });

    // Parse and validate request body
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as Record<string, any>;
    const validatedData = validateAssetInput(body);

    // Use lab from request or user's default lab
    const rawLabId = body.labId || session.user.labId;
    if (!rawLabId) {
      return NextResponse.json(
        { error: 'Lab ID is required. Please specify a lab or set your default lab.' },
        { status: 400 }
      );
    }
    const labId = parseInt(rawLabId, 10);
    if (isNaN(labId) || labId <= 0) {
      return NextResponse.json({ error: 'Invalid lab ID' }, { status: 400 });
    }

    // Verify lab exists and enforce institution isolation: the TARGET lab's
    // college is what matters, not the asset being edited.
    const targetLab = await db.select().from(labs).where(eq(labs.id, labId)).limit(1);
    if (targetLab.length === 0) {
      return NextResponse.json(
        { error: 'Specified lab does not exist.' },
        { status: 404 }
      );
    }

    if (!canAccessCollege(session.user, targetLab[0].collegeId)) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot add equipment to a laboratory outside your assigned institution.' },
        { status: 403 }
      );
    }

    if (!(await canManageLab(session.user, labId))) {
      return NextResponse.json(
        { error: 'You are not assigned to this lab' },
        { status: 403 }
      );
    }

    const collegeId = targetLab[0].collegeId;
    const explicitAssetTypeId = body.assetTypeId === undefined || body.assetTypeId === '' ? null : Number(body.assetTypeId);
    const [legacyType] = explicitAssetTypeId === null ? await db.select().from(assetTypes).where(and(eq(assetTypes.collegeId, collegeId), eq(assetTypes.legacyCategory, validatedData.category))).limit(1) : [];
    const assetTypeId = explicitAssetTypeId ?? legacyType?.id ?? null;
    let customFields: Record<string, unknown> = {};
    if (assetTypeId !== null) {
      if (!Number.isInteger(assetTypeId) || assetTypeId <= 0) return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 });
      const [type] = await db.select().from(assetTypes).where(and(eq(assetTypes.id, assetTypeId), eq(assetTypes.collegeId, collegeId))).limit(1);
      if (!type) return NextResponse.json({ error: 'Asset type must belong to the lab college' }, { status: 400 });
      const fields = await db.select().from(assetTypeFields).where(eq(assetTypeFields.assetTypeId, assetTypeId));
      customFields = validateCustomFieldValues(fields, body.customFields || {});
    }
    
    const newAsset = await db.insert(assets).values({
      name: validatedData.name,
      category: validatedData.category,
      manufacturer: validatedData.manufacturer || null,
      model: validatedData.model || null,
      serialNumber: validatedData.serialNumber || null,
      collegeId: collegeId,
      labId: labId,
      location: validatedData.location,
      status: validatedData.status,
      purchaseDate: validatedData.purchaseDate || null,
      warrantyExpiry: validatedData.warrantyExpiry || null,
      notes: validatedData.notes || null,
      assetTypeId,
      customFields,
      createdById: session.user.id,
      updatedById: session.user.id,
    }).returning();

    logger.info('Asset created', { assetId: newAsset[0].id, name: newAsset[0].name });
    await logAudit({
      userId: session.user.id,
      action: 'CREATE',
      entityType: 'asset',
      entityId: newAsset[0].id,
      changes: {
        name: newAsset[0].name,
        category: newAsset[0].category,
        manufacturer: newAsset[0].manufacturer,
        model: newAsset[0].model,
        serialNumber: newAsset[0].serialNumber,
        status: newAsset[0].status,
        location: newAsset[0].location,
        purchaseDate: newAsset[0].purchaseDate,
        warrantyExpiry: newAsset[0].warrantyExpiry,
        notes: newAsset[0].notes,
        assetTypeId: newAsset[0].assetTypeId,
        customFields: newAsset[0].customFields,
        collegeId,
        labId,
      },
    });

    await notifyAssetChange({
      action: 'created',
      assetName: newAsset[0].name,
      labId,
      assetTypeId: newAsset[0].assetTypeId,
      actor: { id: session.user.id, name: session.user.name },
    });

    return NextResponse.json(newAsset[0], { status: 201 });
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
