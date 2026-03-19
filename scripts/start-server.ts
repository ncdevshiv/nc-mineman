import { existsSync, mkdirSync, cpSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';

const traceId = randomUUID();
const service = 'mine-manager-start';

const log = (level: string, message: string, context: Record<string, unknown> = {}) => {
	const entry = {
		timestamp: new Date().toISOString(),
		level,
		service,
		trace_id: traceId,
		message,
		...context,
	};
	console.log(JSON.stringify(entry));
};

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || '3000';
const cwd = process.cwd();
const serverPath = join(cwd, '.next', 'standalone', 'server.js');
const staticSource = join(cwd, '.next', 'static');
const staticTarget = join(cwd, '.next', 'standalone', '.next', 'static');

async function startSpacetimeDB(): Promise<void> {
	const spacetimedbBin = join(cwd, 'Bin', 'SpacetimeDB', 'spacetimedb-standalone.exe');
	if (!existsSync(spacetimedbBin)) {
		log('warn', 'SpacetimeDB binary not found, skipping');
		return;
	}
	if (process.env.SPACETIMEDB_ENABLED === 'false') {
		log('info', 'SpacetimeDB disabled via env');
		return;
	}

	const dataDir = join(cwd, 'data', 'spacetimedb', 'data');
	mkdirSync(dataDir, { recursive: true });

	log('info', 'Starting SpacetimeDB standalone server', { port: process.env.SPACETIMEDB_PORT || '3001' });
	try {
		const { spawn } = await import('child_process');
		const proc = spawn(spacetimedbBin, ['start'], {
			cwd: join(cwd, 'Bin', 'SpacetimeDB'),
			env: { ...process.env, SPACETIMEDB_DATA_DIR: dataDir },
			stdio: 'ignore',
			detached: true,
		});
		proc.unref();
		log('info', 'SpacetimeDB started in background');
	} catch (err: any) {
		log('error', 'Failed to start SpacetimeDB', { error: err.message });
	}
}

if (!existsSync(serverPath)) {
	log('error', 'Standalone server bundle missing. Run `bun run build` before starting.', { error_code: 'ERR-ID-101', serverPath });
	process.exit(1);
}

if (!existsSync(staticSource)) {
	log('error', 'Static assets missing. Run `bun run build` before starting.', { error_code: 'ERR-ID-102', staticSource });
	process.exit(1);
}

try {
	mkdirSync(dirname(staticTarget), { recursive: true });
	cpSync(staticSource, staticTarget, { recursive: true });
	log('info', 'Static assets synced to standalone bundle', { staticSource, staticTarget });
} catch (error: any) {
	log('error', 'Failed to sync static assets', { error_code: 'ERR-ID-103', error: error.message, staticSource, staticTarget });
	process.exit(1);
}

await startSpacetimeDB();

process.env.HOST = host;
process.env.PORT = port;
log('info', 'Starting Next.js standalone server', { host, port, serverPath });

await import(serverPath);
