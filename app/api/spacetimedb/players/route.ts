import { NextResponse } from 'next/server';
import { getPlayers, upsertPlayer, setPlayerBan, setPlayerOp, setPlayerWaitlist, setPlayerWhitelist, updatePlayerNotes, deletePlayer, clearPlayers, getPlayerIpHistory, getSessions, getPlayerStats } from '@/lib/spacetimedb-data';

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const serverId = searchParams.get('serverId');
		if (!serverId) return NextResponse.json({ error: 'serverId required' }, { status: 400 });

		const action = searchParams.get('action');
		if (action === 'stats') {
			const stats = await getPlayerStats(serverId);
			return NextResponse.json(stats);
		}
		if (action === 'ipHistory') {
			const name = searchParams.get('name');
			if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
			const history = await getPlayerIpHistory(serverId, name);
			return NextResponse.json(history);
		}
		if (action === 'sessions') {
			const sessions = await getSessions(serverId);
			return NextResponse.json(sessions);
		}

		const players = await getPlayers(serverId);
		return NextResponse.json(players);
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { serverId, action, name } = body;
		if (!serverId || !action || !name) return NextResponse.json({ error: 'serverId, action, name required' }, { status: 400 });

		switch (action) {
			case 'add': {
				await upsertPlayer({
					server_id: serverId, name, uuid: body.uuid || '', ip_address: body.ip || '',
					is_op: body.isOp ?? false, is_whitelisted: body.isWhitelisted ?? false,
					is_banned: false, is_waitlisted: body.isWaitlisted ?? false,
					permission_level: body.permissionLevel ?? 0, notes: body.notes || '',
				});
				break;
			}
			case 'ban': await setPlayerBan(serverId, name, true, body.reason || ''); break;
			case 'unban': await setPlayerBan(serverId, name, false); break;
			case 'op': await setPlayerOp(serverId, name, true, body.level ?? 4); break;
			case 'deop': await setPlayerOp(serverId, name, false); break;
			case 'waitlist': await setPlayerWaitlist(serverId, name, true); break;
			case 'unwaitlist': await setPlayerWaitlist(serverId, name, false); break;
			case 'whitelist': await setPlayerWhitelist(serverId, name, true); break;
			case 'unwhitelist': await setPlayerWhitelist(serverId, name, false); break;
			case 'notes': await updatePlayerNotes(serverId, name, body.notes || ''); break;
			case 'delete': await deletePlayer(serverId, name); break;
			case 'clear': await clearPlayers(serverId); break;
			default: return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
		}
		return NextResponse.json({ success: true });
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}
