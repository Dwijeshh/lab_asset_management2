import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { labs, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

    // Check if lab belongs to user's college (admin can access any college)
    if (session.user.role !== 'admin' && lab.collegeId !== session.user.collegeId) {
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
    console.error('Error fetching lab details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lab details' },
      { status: 500 }
    );
  }
}