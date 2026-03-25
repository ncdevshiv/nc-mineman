import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { removeFriend } from '@/lib/db-frontend';

export async function DELETE(_request: Request, { params }: { params: Promise<{ friendId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { friendId } = await params;
  try {
    await removeFriend(session.id, friendId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to remove friend' }, { status: 500 });
  }
}
