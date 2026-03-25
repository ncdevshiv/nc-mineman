import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { initDatabase } from '../lib/database';

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || '3000';

const log = (level: string, message: string) => {
	const ts = new Date().toISOString();
	console.log(`[${ts}] [${level.toUpperCase()}] ${message}`);
};

const cwd = process.cwd();

// Ensure build exists (check server dir since it's the critical production artifact)
if (!existsSync(join(cwd, '.next', 'server'))) {
	log('error', 'Build not found or incomplete. Run `bun run build` first.');
	process.exit(1);
}

// Initialize database schema
log('info', 'Initializing database...');
const dbOk = await initDatabase();
if (!dbOk) {
	log('warn', 'Database initialization had issues (tables may already exist)');
} else {
	log('info', 'Database ready');
}

// Start Next.js server using child_process (compatible with Windows subprocess flags)
log('info', `Starting Next.js on ${host}:${port}...`);
const env = { ...process.env, HOST: host, PORT: port };

const proc = spawn('bunx', ['next', 'start', '-p', port], {
	cwd,
	env,
	detached: false,
	windowsHide: true,
	stdio: 'inherit',
});

proc.on('error', (err) => {
	log('error', `Server spawn error: ${err.message}`);
	process.exit(1);
});

// Do NOT call process.exit() here — let the server keep running.
// The SIGINT/SIGTERM handlers below will cleanly shut it down.
proc.on('close', (code) => {
	// Only exit if the process actually closed unexpectedly (not from SIGINT/SIGTERM)
	if (code !== null && code !== 0) {
		log('info', `Server exited with code ${code}`);
		process.exit(code ?? 0);
	}
});

// Handle graceful shutdown
const shutdown = (signal: string) => {
	log('info', `Received ${signal}, shutting down server...`);
	proc.kill(signal as any);
	proc.on('close', () => {
		process.exit(0);
	});
	// Force exit after 5s
	setTimeout(() => process.exit(1), 5000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
