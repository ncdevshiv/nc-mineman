import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/db-frontend';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unread') === 'true';

  try {
    const notifications = await getUserNotifications(session.id, unreadOnly);
    return NextResponse.json(notifications);
  } catch {
    return NextResponse.json([]);
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    if (body.action === 'mark_read' && body.id) {
      await markNotificationRead(body.id);
    } else if (body.action === 'mark_all_read') {
      await markAllNotificationsRead(session.id);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
