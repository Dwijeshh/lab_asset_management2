import { NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/auth-jwt';
import { logger, sanitizeError } from '@/lib/logger';
import { rateLimit, getClientIdentifier, RateLimitError } from '@/lib/rateLimit';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const clientId = getClientIdentifier(request);
    rateLimit(`notifications:put:${clientId}`, { windowMs: 60000, maxRequests: 60 });

    const { id } = await params;
    const notificationId = parseInt(id);

    await db.update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, session.user.id)
        )
      );

    return NextResponse.json({ message: 'Notification marked as read' });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: error.retryAfter },
        { status: 429, headers: { 'Retry-After': error.retryAfter.toString() } }
      );
    }

    logger.error('Error marking notification as read', { error });
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
