import { $ } from 'bun';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

const cwd = process.cwd();

async function killProcessOnPort(portNum: number): Promise<void> {
	if (platform() === 'win32') {
		try {
			const result = await $`netstat -ano`.text();
			const lines = result.split('\n');
			for (const line of lines) {
				if (line.includes(`:${portNum}`) && line.includes('LISTENING')) {
					const parts = line.trim().split(/\s+/);
					const pid = parts[parts.length - 1];
					if (pid && /^\d+$/.test(pid)) {
						await $`taskkill /F /PID ${pid}`.quiet();
					}
				}
			}
		} catch {}
	} else {
		try {
			const result = await $`lsof -t -i :${portNum}`.text();
			const pids = result.trim().split('\n').filter(Boolean);
			for (const pid of pids) {
				await $`kill -9 ${pid}`.quiet();
			}
		} catch {}
	}
}

async function killProcessByName(name: string): Promise<void> {
	if (platform() === 'win32') {
		try { await $`taskkill /F /IM ${name}`.quiet(); } catch {}
	} else {
		try { await $`pkill -9 ${name}`.quiet(); } catch {}
	}
}

async function installDependencies(): Promise<boolean> {
	try {
		if (existsSync('bun.lockb')) {
			await $`bun install --frozen-lockfile`;
		} else {
			await $`bun install`;
		}
		return true;
	} catch (error) {
		console.error('[ERROR] Install failed:', error);
		return false;
	}
}

async function startSpacetimeDB(): Promise<void> {
	const spacetimedbBin = join(cwd, 'Bin', 'SpacetimeDB', 'spacetimedb-standalone.exe');
	if (!existsSync(spacetimedbBin)) {
		console.log('[SpacetimeDB] Binary not found, skipping');
		return;
	}
	if (process.env.SPACETIMEDB_ENABLED === 'false') {
		console.log('[SpacetimeDB] Disabled via env');
		return;
	}

	const dataDir = join(cwd, 'data', 'spacetimedb', 'data');
	mkdirSync(dataDir, { recursive: true });

	console.log('[SpacetimeDB] Starting standalone server on port 3001...');
	try {
		Bun.spawn([spacetimedbBin, 'start'], {
			cwd: join(cwd, 'Bin', 'SpacetimeDB'),
			env: { ...process.env, SPACETIMEDB_DATA_DIR: dataDir },
			stdout: 'pipe',
			stderr: 'pipe',
		});
		console.log('[SpacetimeDB] Started in background');
	} catch (err: any) {
		console.error('[SpacetimeDB] Failed to start:', err.message);
	}
}

async function main() {
	console.log('');
	console.log('==============================================');
	console.log('MineManager - Dev Start Script (Bun)');
	console.log('==============================================');
	console.log('');

	console.log('[1/4] Killing existing processes on port 3000 (dev server)...');
	await killProcessOnPort(3000);
	console.log('Done.');

	console.log('[2/4] Killing existing SpacetimeDB processes...');
	await killProcessByName('spacetimedb-standalone');
	console.log('Done.');

	console.log('[3/4] Installing dependencies...');
	const installSuccess = await installDependencies();
	if (!installSuccess) {
		console.log('');
		console.log('[ERROR] bun install failed! Check the errors above.');
		console.log('');
		process.exit(1);
	}
	console.log('Dependencies ready.');

	console.log('[4/5] Starting SpacetimeDB...');
	await startSpacetimeDB();

	console.log('');
	console.log('[5/5] Starting Next.js dev server...');
	console.log('URL: http://localhost:3000');
	console.log('SpacetimeDB: http://127.0.0.1:3001');
	console.log('');

	await $`bun run dev`;
}

main().catch((error) => {
	console.error('Dev server error:', error);
	process.exit(1);
});
