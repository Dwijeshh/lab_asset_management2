import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { assets, labs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth-jwt';

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

    const { id } = await params;
    const labId = parseInt(id, 10);

    if (isNaN(labId) || labId <= 0) {
      return NextResponse.json(
        { error: 'Invalid lab ID' },
        { status: 400 }
      );
    }

    // Verify lab belongs to user's college
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

    if (session.user.role !== 'admin' && labResult[0].collegeId !== session.user.collegeId) {
      return NextResponse.json(
        { error: 'Access denied: You do not have permission to access laboratories from other institutions' },
        { status: 403 }
      );
    }

    // Get assets for this lab
    const labAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.labId, labId))
      .orderBy(desc(assets.createdAt));

    return NextResponse.json({
      data: labAssets,
    });
  } catch (error) {
    console.error('Error fetching lab assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lab assets' },
      { status: 500 }
    );
  }
}