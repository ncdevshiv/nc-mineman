import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSocialRequests, createSocialRequest, getSiteUser } from '@/lib/db-frontend';
import { sql, escapeStr } from '@/lib/database';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const requests = await getSocialRequests(session.id);
    const enriched = await Promise.all(requests.map(async (r: any) => {
      const fromUser = await getSiteUser(r.from_id);
      const toUser = await getSiteUser(r.to_id);

      // Determine online status for from_user
      let from_online_smp = false;
      let from_online_site = false;
      try {
        if (fromUser?.mc_username) {
          const smpRes = await sql(`SELECT is_online FROM players WHERE name='${escapeStr(fromUser.mc_username)}' AND is_online=true LIMIT 1`);
          from_online_smp = smpRes.length > 0 && smpRes[0].rows.length > 0;
        }
      } catch {}
      try {
        const suRes = await sql(`SELECT last_seen FROM site_users WHERE id='${escapeStr(r.from_id)}' LIMIT 1`);
        if (suRes.length > 0 && suRes[0].rows.length > 0) {
          const lastSeen = suRes[0].rows[0]?.last_seen as string | null | undefined;
          if (lastSeen) {
            const diffMs = Date.now() - new Date(lastSeen).getTime();
            from_online_site = diffMs < 5 * 60 * 1000;
          }
        }
      } catch {}

      // Determine online status for to_user
      let to_online_smp = false;
      let to_online_site = false;
      try {
        if (toUser?.mc_username) {
          const smpRes = await sql(`SELECT is_online FROM players WHERE name='${escapeStr(toUser.mc_username)}' AND is_online=true LIMIT 1`);
          to_online_smp = smpRes.length > 0 && smpRes[0].rows.length > 0;
        }
      } catch {}
      try {
        const suRes = await sql(`SELECT last_seen FROM site_users WHERE id='${escapeStr(r.to_id)}' LIMIT 1`);
        if (suRes.length > 0 && suRes[0].rows.length > 0) {
          const lastSeen = suRes[0].rows[0]?.last_seen as string | null | undefined;
          if (lastSeen) {
            const diffMs = Date.now() - new Date(lastSeen).getTime();
            to_online_site = diffMs < 5 * 60 * 1000;
          }
        }
      } catch {}

      return {
        ...r,
        from_name: fromUser?.mc_username || fromUser?.site_name || 'Unknown',
        to_name: toUser?.mc_username || toUser?.site_name || 'Unknown',
        from_online_smp,
        from_online_site,
        to_online_smp,
        to_online_site,
      };
    }));
    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await createSocialRequest({
      id,
      from_id: session.id,
      to_id: body.to_id,
      type: body.type || 'friend',
    });
    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}
