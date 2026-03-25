import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchUsers } from '@/lib/db-frontend';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  if (!q.trim()) return NextResponse.json([]);

  try {
    const users = await searchUsers(q);
    return NextResponse.json(users.filter(u => u.id !== session.id));
  } catch {
    return NextResponse.json([]);
  }
}
