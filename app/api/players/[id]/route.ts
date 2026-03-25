import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPublicProfile, getFollowCounts, isFollowing, getActiveModerationActions } from '@/lib/db-frontend';
import { sql, escapeStr } from '@/lib/database';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: playerId } = await params;
  const isMod = session.roles?.some(r => ['owner', 'admin', 'god', 'helper'].includes(r));

  try {
    const profile = await getPublicProfile(playerId);
    if (!profile) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const followCounts = await getFollowCounts(playerId);
    const following = await isFollowing(session.id, playerId);

    let isOnline = false;
    if (profile.mc_username) {
      const r = await sql(`SELECT is_online FROM players WHERE name='${escapeStr(profile.mc_username)}' AND is_online=true LIMIT 1`);
      isOnline = r.length > 0 && r[0].rows.length > 0;
    }

    const response: any = {
      id: profile.id,
      mc_username: profile.mc_username,
      site_name: profile.site_name,
      roles: profile.roles,
      created_at: profile.created_at,
      is_online: isOnline,
      followers: followCounts.followers,
      following: followCounts.following,
      is_followed_by_me: following,
    };

    if (isMod) {
      const activeActions = await getActiveModerationActions(playerId);
      response.active_moderation = activeActions;
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
