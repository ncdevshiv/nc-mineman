import { $ } from 'bun';
import { existsSync, rmSync, mkdirSync, cpSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { platform } from 'os';

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

async function killProcessByName(name: string): Promise<void> {
	if (platform() === 'win32') {
		try {
			await $`taskkill /F /IM ${name}`.quiet();
		} catch {}
	} else {
		try {
			await $`pkill -9 ${name}`.quiet();
		} catch {}
	}
}

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

async function cleanBuildArtifacts(): Promise<void> {
	const dirsToClean = ['.next', 'node_modules/.cache', 'dist', 'build'];
	for (const dir of dirsToClean) {
		const fullPath = join(cwd, dir);
		if (existsSync(fullPath)) {
			rmSync(fullPath, { recursive: true, force: true });
		}
	}
}

async function runBuild(): Promise<boolean> {
	try {
		await $`bun run build`;
		return true;
	} catch (error) {
		log('error', 'Build failed', { error: String(error) });
		return false;
	}
}

async function startServer(): Promise<void> {
	const serverPath = join(cwd, '.next', 'standalone', 'server.js');
	const staticSource = join(cwd, '.next', 'static');
	const staticTarget = join(cwd, '.next', 'standalone', '.next', 'static');

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

	process.env.HOST = host;
	process.env.PORT = port;
	log('info', 'Starting Next.js standalone server', { host, port, serverPath });

	await import(serverPath);
}

async function main() {
	console.log('');
	console.log('==============================================');
	console.log('MineManager - Fresh Start Script (Bun)');
	console.log('==============================================');
	console.log('');

	console.log('[1/8] Killing existing Java processes (Minecraft servers)...');
	await killProcessByName('java');
	console.log('Done.');

	console.log('[2/8] Killing existing Node.js/Bun processes...');
	await killProcessByName('node');
	await killProcessByName('bun');
	console.log('Done.');

	console.log('[3/8] Killing existing FRP tunnel processes...');
	await killProcessByName('frpc');
	await killProcessByName('playit');
	console.log('Done.');

	console.log('[4/8] Killing processes on port 3000 (Next.js)...');
	await killProcessOnPort(3000);
	console.log('Done.');

	console.log('[5/8] Killing processes on port 25565 (Minecraft default)...');
	await killProcessOnPort(25565);
	console.log('Done.');

	console.log('[6/8] Clearing Next.js cache and build artifacts...');
	await cleanBuildArtifacts();
	console.log('Done.');

	console.log('');
	console.log('[7/8] Running fresh build...');
	const buildSuccess = await runBuild();
	if (!buildSuccess) {
		console.log('');
		console.log('[ERROR] Build failed! Check the errors above.');
		console.log('');
		process.exit(1);
	}
	console.log('Build successful.');

	console.log('');
	console.log('[8/8] Starting MineManager server...');
	console.log('');
	console.log('==============================================');
	console.log('Server ready at: http://localhost:3000');
	console.log('Press Ctrl+C to stop the server');
	console.log('==============================================');
	console.log('');

	await startServer();
}

main().catch((error) => {
	log('error', 'Fatal error', { error: String(error) });
	process.exit(1);
});
