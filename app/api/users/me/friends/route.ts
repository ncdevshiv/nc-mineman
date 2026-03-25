import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getFriends, removeFriend } from '@/lib/db-frontend';
import { sql, escapeStr } from '@/lib/database';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const friends = await getFriends(session.id);

    const enriched = await Promise.all(friends.map(async (f: any) => {
      let online_smp = false;
      let online_site = false;
      try {
        if (f.mc_username) {
          const r = await sql(`SELECT is_online FROM players WHERE name='${escapeStr(f.mc_username)}' AND is_online=true LIMIT 1`);
          online_smp = r.length > 0 && r[0].rows.length > 0;
        }
      } catch {}
      try {
        const su = await sql(`SELECT last_seen FROM site_users WHERE id='${escapeStr(f.id)}' LIMIT 1`);
        if (su.length > 0 && su[0].rows.length > 0) {
          const lastSeen = su[0].rows[0]?.last_seen as string | null | undefined;
          if (lastSeen) {
            const diffMs = Date.now() - new Date(lastSeen).getTime();
            online_site = diffMs < 5 * 60 * 1000; // within 5 minutes
          }
        }
      } catch {}
      return {
        id: f.id,
        name: f.mc_username || f.site_name || 'Unknown',
        mc_username: f.mc_username,
        site_name: f.site_name,
        online_smp,
        online_site,
      };
    }));

    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json([]);
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const friendId = searchParams.get('friendId');
  if (!friendId) return NextResponse.json({ error: 'friendId required' }, { status: 400 });

  try {
    await removeFriend(session.id, friendId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to remove friend' }, { status: 500 });
  }
}
