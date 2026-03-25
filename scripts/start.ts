import { $ } from 'bun';
import { existsSync, rmSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { platform } from 'os';

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || '3000';
const cwd = process.cwd();

async function killProcessByName(name: string): Promise<void> {
	if (platform() === 'win32') {
		try { await $`taskkill /F /IM ${name}`.quiet(); } catch {}
	} else {
		try { await $`pkill -9 ${name}`.quiet(); } catch {}
	}
}

async function killProcessOnPort(portNum: number): Promise<void> {
	if (platform() === 'win32') {
		try {
			const result = await $`netstat -ano`.text();
			for (const line of result.split('\n')) {
				if (line.includes(`:${portNum}`) && line.includes('LISTENING')) {
					const pid = line.trim().split(/\s+/).pop();
					if (pid && /^\d+$/.test(pid)) await $`taskkill /F /PID ${pid}`.quiet();
				}
			}
		} catch {}
	} else {
		try {
			const pids = (await $`lsof -t -i :${portNum}`.text()).trim().split('\n').filter(Boolean);
			for (const pid of pids) await $`kill -9 ${pid}`.quiet();
		} catch {}
	}
}

async function cleanBuildArtifacts(): Promise<void> {
	for (const dir of ['.next', 'node_modules/.cache', 'dist', 'build']) {
		const fullPath = join(cwd, dir);
		if (existsSync(fullPath)) rmSync(fullPath, { recursive: true, force: true });
	}
}

async function runBuild(): Promise<boolean> {
	try { await $`bun run build`; return true; }
	catch { return false; }
}

async function main() {
	console.log('');
	console.log('==============================================');
	console.log('MineManager - Fresh Start Script (Bun)');
	console.log('==============================================');
	console.log('');

	console.log('[1/7] Killing existing processes on port 3000...');
	await killProcessOnPort(3000);
	console.log('Done.');

	console.log('[2/7] Killing existing processes on port 25565...');
	await killProcessOnPort(25565);
	console.log('Done.');

	console.log('[3/7] Clearing build artifacts...');
	await cleanBuildArtifacts();
	console.log('Done.');

	console.log('');
	console.log('[4/7] Installing dependencies...');
	try { await $`bun install`; } catch {}
	console.log('Done.');

	console.log('');
	console.log('[5/7] Running fresh build...');
	const buildSuccess = await runBuild();
	if (!buildSuccess) {
		console.log('[ERROR] Build failed!');
		process.exit(1);
	}
	console.log('Build successful.');

	console.log('');
	console.log('[6/7] Initializing database...');
	const { initDatabase } = await import('../lib/database');
	const dbOk = await initDatabase();
	console.log(dbOk ? 'Database ready.' : 'Database init had warnings.');

	console.log('');
	console.log('[7/7] Starting server...');
	console.log('==============================================');
	console.log('Server ready at: http://localhost:3000');
	console.log('Press Ctrl+C to stop');
	console.log('==============================================');
	console.log('');

	const proc = Bun.spawn(['bunx', 'next', 'start', '-H', host, '-p', port], {
		cwd, stdio: ['inherit', 'inherit', 'inherit'],
		env: { ...process.env, HOST: host, PORT: port },
	});
	proc.exited.then((code) => process.exit(code ?? 0));
	process.on('SIGINT', () => proc.kill('SIGINT'));
	process.on('SIGTERM', () => proc.kill('SIGTERM'));
}

main().catch((error) => {
	console.error('[FATAL]', error);
	process.exit(1);
});
