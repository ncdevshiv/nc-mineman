import { NextResponse } from 'next/server';
import { getLogs, getLogCount, clearLogs, insertLog } from '@/lib/spacetimedb-data';

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const serverId = searchParams.get('serverId');
		if (!serverId) return NextResponse.json({ error: 'serverId required' }, { status: 400 });

		const level = searchParams.get('level') || 'all';
		const search = searchParams.get('search') || '';
		const limit = parseInt(searchParams.get('limit') || '200');
		const offset = parseInt(searchParams.get('offset') || '0');

		const opts = { level: level === 'all' ? undefined : level, search: search || undefined, limit, offset };
		const [logs, total] = await Promise.all([
			getLogs(serverId, opts),
			getLogCount(serverId, { level: opts.level, search: opts.search }),
		]);

		return NextResponse.json({ logs, total });
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { serverId, action } = body;
		if (!serverId) return NextResponse.json({ error: 'serverId required' }, { status: 400 });

		if (action === 'clear') {
			await clearLogs(serverId);
			return NextResponse.json({ success: true, cleared: true });
		}
		if (action === 'add') {
			await insertLog({ server_id: serverId, level: body.level || 'info', source: body.source || 'manual', message: body.message || '' });
			return NextResponse.json({ success: true });
		}
		return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}
