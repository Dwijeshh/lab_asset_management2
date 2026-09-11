import { NextResponse } from 'next/server';
import { db } from '@/db';
import { assets, assetRequests, users, notifications } from '@/db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { getSession } from '@/lib/auth-jwt';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        .orderBy(desc(assetRequests.createdAt));
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
        .orderBy(desc(assetRequests.createdAt));
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
        .orderBy(desc(assetRequests.createdAt));
    }

    return NextResponse.json({ data: requests });
  } catch (error) {
    console.error('Error fetching asset requests:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
    if (!user.labId) {
      return NextResponse.json({ error: 'You must be assigned to a lab to request assets' }, { status: 403 });
    }

    const body = await request.json();
    const { assetId, loanType, notes } = body;

    if (!assetId || !loanType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, assetId),
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
      status: 'pending',
    }).returning();

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
    console.error('Error creating asset request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
