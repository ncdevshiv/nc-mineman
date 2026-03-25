import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getFollowers, getFollowing, followUser, unfollowUser } from '@/lib/db-frontend';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'following';
  const userId = searchParams.get('userId') || session.id;

  try {
    if (type === 'followers') {
      const followers = await getFollowers(userId);
      return NextResponse.json(followers);
    }
    const following = await getFollowing(userId);
    return NextResponse.json(following);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    if (body.target_id === session.id) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }
    await followUser(session.id, body.target_id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to follow' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get('targetId');
  if (!targetId) return NextResponse.json({ error: 'targetId required' }, { status: 400 });

  try {
    await unfollowUser(session.id, targetId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to unfollow' }, { status: 500 });
  }
}
