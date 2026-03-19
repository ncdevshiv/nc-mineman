import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

const cwd = process.cwd();

async function startSpacetimeDB() {
	if (process.env.SPACETIMEDB_ENABLED === 'false') {
		return;
	}

	const spacetimedbBin = join(cwd, 'Bin', 'SpacetimeDB', 'spacetimedb-standalone.exe');
	if (!existsSync(spacetimedbBin)) {
		return;
	}

	const dataDir = join(cwd, 'data', 'spacetimedb', 'data');
	mkdirSync(dataDir, { recursive: true });

	// Kill any existing instance
	try {
		if (platform() === 'win32') {
			const { spawn } = await import('child_process');
			spawn('taskkill', ['/F', '/IM', 'spacetimedb-standalone.exe'], { stdio: 'ignore' });
		}
	} catch {}

	// Start SpacetimeDB in background
	try {
		const { spawn } = await import('child_process');
		const proc = spawn(spacetimedbBin, ['start'], {
			cwd: join(cwd, 'Bin', 'SpacetimeDB'),
			env: { ...process.env, SPACETIMEDB_DATA_DIR: dataDir },
			stdio: 'ignore',
			detached: true,
		});
		proc.unref();
		console.log('[SpacetimeDB] Auto-started on port 3001');
	} catch (err: any) {
		console.error('[SpacetimeDB] Auto-start failed:', err.message);
	}
}

// Start SpacetimeDB then launch Next.js
await startSpacetimeDB();

// Import and run next dev
const { $ } = await import('bun');
await $`next dev`;
