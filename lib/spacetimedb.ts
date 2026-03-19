import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SPACETIMEDB_DIR = path.join(process.cwd(), 'Bin', 'SpacetimeDB');
const SPACETIMEDB_DATA_DIR = path.join(process.cwd(), 'data', 'spacetimedb');
const SPACETIMEDB_CLI = path.join(SPACETIMEDB_DIR, 'spacetimedb-cli.exe');
const SPACETIMEDB_STANDALONE = path.join(SPACETIMEDB_DIR, 'spacetimedb-standalone.exe');

const DEFAULT_PORT = parseInt(process.env.SPACETIMEDB_PORT || '3001');
const DEFAULT_HOST = process.env.SPACETIMEDB_HOST || '127.0.0.1';
const STDB_ENABLED = process.env.SPACETIMEDB_ENABLED !== 'false';

export interface SpacetimeDBStatus {
	running: boolean;
	pid: number | null;
	port: number;
	host: string;
	dataDir: string;
	version: string | null;
}

function ensureDirectories() {
	const dirs = [
		SPACETIMEDB_DIR,
		SPACETIMEDB_DATA_DIR,
		path.join(SPACETIMEDB_DATA_DIR, 'data'),
	];
	for (const dir of dirs) {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}
}

function writeConfig() {
	const configPath = path.join(SPACETIMEDB_DATA_DIR, 'data', 'config.toml');
	const configDir = path.dirname(configPath);
	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true });
	}

	const config = `[logs]
level = "info"
directives = [
    "spacetimedb=warn",
    "spacetimedb_standalone=info",
]

[websocket]
ping-interval = "15s"
idle-timeout = "30s"
close-handshake-timeout = "250ms"
incoming-queue-length = 2048
`;

	fs.writeFileSync(configPath, config);
}

ensureDirectories();
writeConfig();

// Module-level state (survives hot reloads via this module cache)
let _process: ChildProcess | null = null;
let _running = false;
let _starting = false;
let _autoStartAttempted = false;
const _logs: string[] = [];
const MAX_LOGS = 500;
const emitter = new EventEmitter();

function addLog(msg: string) {
	_logs.push(msg);
	if (_logs.length > MAX_LOGS) {
		_logs.shift();
	}
}

export const spacetimeDB = {
	get isRunning() { return _running; },
	get baseUrl() { return `http://${DEFAULT_HOST}:${DEFAULT_PORT}`; },

	getLogs(): string[] {
		return [..._logs];
	},

	async getVersion(): Promise<string | null> {
		return new Promise((resolve) => {
			if (!fs.existsSync(SPACETIMEDB_CLI)) {
				resolve(null);
				return;
			}
			const proc = spawn(SPACETIMEDB_CLI, ['version'], {
				cwd: SPACETIMEDB_DIR,
				stdio: ['pipe', 'pipe', 'pipe'],
			});
			let output = '';
			proc.stdout?.on('data', (data) => { output += data.toString(); });
			proc.on('close', () => {
				const match = output.match(/spacetime(?:db-cli)?\s+version:\s*([\d.]+)/i);
				resolve(match ? match[1] : output.trim() || null);
			});
			proc.on('error', () => resolve(null));
		});
	},

	async start(): Promise<boolean> {
		if (_running) {
			addLog('[SpacetimeDB] Already running.');
			return true;
		}

		if (_starting) {
			addLog('[SpacetimeDB] Start in progress, waiting...');
			for (let i = 0; i < 30; i++) {
				await new Promise((r) => setTimeout(r, 500));
				if (_running) return true;
			}
			return false;
		}

		if (!fs.existsSync(SPACETIMEDB_STANDALONE)) {
			addLog('[SpacetimeDB] Binary not found: ' + SPACETIMEDB_STANDALONE);
			return false;
		}

		_starting = true;
		addLog(`[SpacetimeDB] Starting on ${DEFAULT_HOST}:${DEFAULT_PORT}...`);

		return new Promise((resolve) => {
			try {
				const dataDir = path.join(SPACETIMEDB_DATA_DIR, 'data');
				_process = spawn(SPACETIMEDB_STANDALONE, ['start'], {
					cwd: SPACETIMEDB_DIR,
					stdio: ['pipe', 'pipe', 'pipe'],
					env: { ...process.env, SPACETIMEDB_DATA_DIR: dataDir },
				});

				let done = false;

				const onReady = (line: string) => {
					if (done) return;
					if (
						line.includes('listening') || line.includes('started') ||
						line.includes('Running') || line.includes('ready')
					) {
						done = true;
						_running = true;
						_starting = false;
						resolve(true);
					}
				};

				_process.stdout?.on('data', (data) => {
					const str = data.toString().trim();
					if (str) str.split('\n').forEach((l: string) => { addLog(`[SpacetimeDB] ${l}`); onReady(l); });
				});

				_process.stderr?.on('data', (data) => {
					const str = data.toString().trim();
					if (str) str.split('\n').forEach((l: string) => { addLog(`[SpacetimeDB] ${l}`); onReady(l); });
				});

				_process.on('close', (code) => {
					addLog(`[SpacetimeDB] Exited code ${code}`);
					_running = false;
					_starting = false;
					_process = null;
				});

				_process.on('error', (err) => {
					addLog(`[SpacetimeDB] Error: ${err.message}`);
					_running = false;
					_starting = false;
					_process = null;
					if (!done) { done = true; resolve(false); }
				});

				// Fallback: assume started after 5s
				setTimeout(() => {
					if (!done) {
						done = true;
						_running = true;
						_starting = false;
						resolve(true);
					}
				}, 5000);
			} catch (err: any) {
				addLog(`[SpacetimeDB] Exception: ${err.message}`);
				_starting = false;
				resolve(false);
			}
		});
	},

	stop() {
		if (!_running || !_process) {
			addLog('[SpacetimeDB] Not running.');
			return;
		}
		addLog('[SpacetimeDB] Stopping...');
		if (os.platform() === 'win32') {
			try { spawn('taskkill', ['/pid', String(_process.pid), '/f'], { stdio: 'ignore' }); }
			catch { _process.kill('SIGTERM'); }
		} else {
			_process.kill('SIGTERM');
		}
		_running = false;
		_starting = false;
		_process = null;
	},

	async ping(): Promise<boolean> {
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 3000);
			const res = await fetch(`${this.baseUrl}/v1/ping`, { signal: controller.signal });
			clearTimeout(timeout);
			return res.ok;
		} catch {
			return false;
		}
	},

	async ensureRunning(): Promise<boolean> {
		if (!STDB_ENABLED) return false;
		if (_running) return true;
		if (_autoStartAttempted && _running) return true;
		if (_starting) {
			// Wait for the in-progress start to finish
			for (let i = 0; i < 40; i++) {
				await new Promise((r) => setTimeout(r, 500));
				if (_running) break;
			}
		}
		if (_autoStartAttempted) return _running;
		_autoStartAttempted = true;

		// Check if already running externally
		const pong = await this.ping();
		if (pong) {
			_running = true;
			return true;
		}

		const started = await this.start();
		if (!started) return false;

		// Wait for HTTP to actually be ready (up to 30s)
		const ready = await this.waitForReady(30000);
		if (!ready) {
			addLog('[SpacetimeDB] Timed out waiting for HTTP readiness');
			return false;
		}

		// Now init schema
		try {
			const { initDatabase } = await import('./spacetimedb-data');
			await initDatabase();
		} catch (err: any) {
			addLog(`[SpacetimeDB] Schema init failed: ${err.message}`);
		}
		return true;
	},

	/** Poll /v1/ping until it responds OK or timeout expires */
	async waitForReady(timeoutMs: number = 30000): Promise<boolean> {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const ok = await this.ping();
			if (ok) return true;
			await new Promise((r) => setTimeout(r, 500));
		}
		return false;
	},

	async execCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
		return new Promise((resolve) => {
			if (!fs.existsSync(SPACETIMEDB_CLI)) {
				resolve({ stdout: '', stderr: 'CLI not found', code: -1 });
				return;
			}
			const proc = spawn(SPACETIMEDB_CLI, args, {
				cwd: SPACETIMEDB_DIR,
				stdio: ['pipe', 'pipe', 'pipe'],
				env: { ...process.env, SPACETIMEDB_DATA_DIR: path.join(SPACETIMEDB_DATA_DIR, 'data') },
			});
			let stdout = '';
			let stderr = '';
			proc.stdout?.on('data', (data) => { stdout += data.toString(); });
			proc.stderr?.on('data', (data) => { stderr += data.toString(); });
			proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
			proc.on('error', (err) => resolve({ stdout, stderr: err.message, code: -1 }));
		});
	},

	getStatus(): SpacetimeDBStatus {
		return {
			running: _running,
			pid: _process?.pid ?? null,
			port: DEFAULT_PORT,
			host: DEFAULT_HOST,
			dataDir: path.join(SPACETIMEDB_DATA_DIR, 'data'),
			version: null,
		};
	},
};

export { SPACETIMEDB_CLI, SPACETIMEDB_DIR, SPACETIMEDB_DATA_DIR };
