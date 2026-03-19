import { NextResponse } from 'next/server';
import { getMetrics, clearMetrics } from '@/lib/spacetimedb-data';

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const serverId = searchParams.get('serverId');
		if (!serverId) return NextResponse.json({ error: 'serverId required' }, { status: 400 });
		const limit = parseInt(searchParams.get('limit') || '60');
		const metrics = await getMetrics(serverId, limit);
		return NextResponse.json(metrics);
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		if (body.action === 'clear' && body.serverId) {
			await clearMetrics(body.serverId);
			return NextResponse.json({ success: true, cleared: true });
		}
		return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}
