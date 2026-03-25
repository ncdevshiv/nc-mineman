import { $ } from 'bun';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';
import { ensureJwtKeys } from '../lib/jwt-keys';

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

async function main() {
	console.log('');
	console.log('==============================================');
	console.log('MineManager - Dev Start Script (Bun)');
	console.log('==============================================');
	console.log('');

	console.log('[1/3] Killing existing processes on port 3000 (dev server)...');
	await killProcessOnPort(3000);
	console.log('Done.');

	console.log('[2/4] Installing dependencies...');
	const installSuccess = await installDependencies();
	if (!installSuccess) {
		console.log('');
		console.log('[ERROR] bun install failed! Check the errors above.');
		console.log('');
		process.exit(1);
	}
	console.log('Dependencies ready.');

	console.log('');
	console.log('[3/3] Starting Next.js dev server...');
	console.log('URL: http://localhost:3000');
	console.log('');

	await $`bun run dev`;
}

main().catch((error) => {
	console.error('Dev server error:', error);
	process.exit(1);
});
