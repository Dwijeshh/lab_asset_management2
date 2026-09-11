import { NextResponse } from 'next/server';
import { db } from '@/db';
import { assets, assetLoans, users, labs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth-jwt';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;
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
      loans = await baseQuery.orderBy(desc(assetLoans.loanDate));
    } else if (user.role === 'main_technician') {
      // Return loans where the asset belongs to the main tech's college
      // or the borrower belongs to the main tech's college.
      // Since it's intra-college, borrower's college == asset's college == main tech's college
      loans = await baseQuery
        .where(eq(assets.collegeId, user.collegeId))
        .orderBy(desc(assetLoans.loanDate));
    } else {
      loans = await baseQuery
        .where(eq(assetLoans.borrowerId, user.id))
        .orderBy(desc(assetLoans.loanDate));
    }

    return NextResponse.json({ data: loans });
  } catch (error) {
    console.error('Error fetching asset loans:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
