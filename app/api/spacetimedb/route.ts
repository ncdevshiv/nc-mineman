import { NextResponse } from 'next/server';
import { spacetimeDB } from '@/lib/spacetimedb';
import { initDatabase, getDbStatus } from '@/lib/spacetimedb-data';

export async function GET() {
	await spacetimeDB.ensureRunning();

	const status = spacetimeDB.getStatus();
	let dbStatus = { exists: false, tables: [] as string[] };
	try { dbStatus = await getDbStatus(); } catch {}
	const version = await spacetimeDB.getVersion();
	return NextResponse.json({ ...status, version, database: dbStatus, baseUrl: spacetimeDB.baseUrl });
}

export async function POST() {
	try {
		const started = await spacetimeDB.start();
		if (!started) return NextResponse.json({ error: 'Failed to start SpacetimeDB' }, { status: 500 });

		const ready = await spacetimeDB.waitForReady(30000);
		if (!ready) return NextResponse.json({ error: 'SpacetimeDB not responding after 30s' }, { status: 500 });

		const dbInit = await initDatabase();
		return NextResponse.json({ success: true, status: spacetimeDB.getStatus(), databaseInitialized: dbInit });
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function DELETE() {
	try {
		spacetimeDB.stop();
		return NextResponse.json({ success: true });
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}
