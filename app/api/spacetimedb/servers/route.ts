import { NextResponse } from 'next/server';
import { getAllServers, upsertServer, deleteServer, clearAllServers } from '@/lib/spacetimedb-data';

export async function GET() {
	try {
		const servers = await getAllServers();
		return NextResponse.json(servers);
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		if (body.action === 'clear') {
			await clearAllServers();
			return NextResponse.json({ success: true, cleared: true });
		}
		const { id, name, software, version, ram, cpu_limit, status } = body;
		if (!id || !name) return NextResponse.json({ error: 'id and name required' }, { status: 400 });
		await upsertServer({
			id, name, software: software || 'paper', version: version || 'latest',
			ram: ram || '2G', cpu_limit: cpu_limit ?? 100, status: status || 'stopped',
			created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
		});
		return NextResponse.json({ success: true });
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');
		if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
		await deleteServer(id);
		return NextResponse.json({ success: true });
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}
