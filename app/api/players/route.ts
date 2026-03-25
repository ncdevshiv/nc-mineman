import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchUsers, getOnlineSiteUsers } from '@/lib/db-frontend';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const online = searchParams.get('online');

  try {
    if (online === 'true') {
      const users = await getOnlineSiteUsers();
      return NextResponse.json(users);
    }
    if (!q.trim()) return NextResponse.json([]);
    const users = await searchUsers(q);
    return NextResponse.json(users.filter(u => u.id !== session.id));
  } catch {
    return NextResponse.json([]);
  }
}
