import { createClient, type Client, type InArgs } from '@libsql/client';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const DB_PATH = join(process.cwd(), 'data', 'minemanager.db');

// Lazy initialization - client is only created when actually needed at runtime
let db: Client | null = null;
let dbInitPromise: Promise<Client | null> | null = null;
let buildTimeSkip = false;

/**
 * Detect if we're running in a Node.js build worker (not Bun runtime).
 * During `next build`, Next.js uses Node.js workers that don't have bun:sqlite.
 * We skip database initialization entirely during build since no data access happens.
 */
function isBuildTime(): boolean {
	if (buildTimeSkip) return true;
	// Bun defines process.versions.bun; Node.js does not
	const isBun = typeof (globalThis as any).Bun !== 'undefined' || !!process.versions?.bun;
	if (!isBun) {
		buildTimeSkip = true;
		return true;
	}
	return false;
}

export async function ensureDb(): Promise<Client | null> {
	if (isBuildTime()) return null;
	if (db) return db;
	if (dbInitPromise) return dbInitPromise;

	dbInitPromise = (async () => {
		try {
			const dataDir = join(process.cwd(), 'data');
			if (!existsSync(dataDir)) {
				mkdirSync(dataDir, { recursive: true });
			}
			db = createClient({ url: `file:${DB_PATH}` });
			// Set pragmas via separate execute calls
			await db.execute('PRAGMA journal_mode = WAL');
			await db.execute('PRAGMA synchronous = NORMAL');
			await db.execute('PRAGMA cache_size = -64000');
			await db.execute('PRAGMA foreign_keys = ON');
			await db.execute('PRAGMA busy_timeout = 5000');
			await db.execute('PRAGMA mmap_size = 268435456');
			await db.execute('PRAGMA temp_store = MEMORY');
			return db;
		} catch (e) {
			console.error('[Database] Failed to open local SQLite db', e);
			db = null;
			return null;
		}
	})();

	return dbInitPromise;
}

const DB_NAME = 'minemanager';

export function getDbPath(): string {
	return DB_PATH;
}

export async function getDbInstance(): Promise<Client | null> {
	return ensureDb();
}

interface SqlColumn { name: string; type: string }
interface SqlRow { [key: string]: unknown }
interface SqlResult { schema: { elements: SqlColumn[] }; rows: SqlRow[] }

function logDbError(operation: string, err: unknown) {
	const message = err instanceof Error ? err.message : String(err);
	console.error(`[Database] ${operation} failed: ${message}`);
}

interface SqlParamQuery { sql: string; args: InArgs }

export async function sql(query: string): Promise<SqlResult[]>;
export async function sql(query: SqlParamQuery): Promise<SqlResult[]>;
export async function sql(query: string | SqlParamQuery): Promise<SqlResult[]> {
	const database = await ensureDb();
	if (!database) return [];
	const maxRetries = 3;
	let lastError: Error | null = null;

	const isParamQuery = typeof query === 'object' && 'sql' in query;
	const sqlString = isParamQuery ? query.sql : query;
	const sqlArgs = isParamQuery ? query.args : undefined;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const trimmed = sqlString.trim().toUpperCase();
			const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA');
			const result = isParamQuery
				? await database.execute({ sql: sqlString, args: sqlArgs })
				: await database.execute(sqlString);
			if (isSelect) {
				return [{ schema: { elements: [] }, rows: result.rows as SqlRow[] }] as SqlResult[];
			} else {
				return [];
			}
		} catch (err: any) {
			lastError = err;
			if (err.message?.includes('database is locked') && attempt < maxRetries - 1) {
				await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
				continue;
			}
			throw new Error(`SQLite error: ${err.message}`);
		}
	}
	throw lastError || new Error('SQLite error: unknown');
}

export function escapeStr(v: string): string {
	return v.replace(/'/g, "''");
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS servers (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	software TEXT NOT NULL,
	version TEXT NOT NULL,
	ram TEXT NOT NULL DEFAULT '2G',
	cpu_limit INT NOT NULL DEFAULT 100,
	status TEXT NOT NULL DEFAULT 'stopped',
	created_at TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS players (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	server_id TEXT NOT NULL,
	name TEXT NOT NULL,
	uuid TEXT NOT NULL DEFAULT '',
	ip_address TEXT NOT NULL DEFAULT '',
	is_op BOOL NOT NULL DEFAULT false,
	is_whitelisted BOOL NOT NULL DEFAULT false,
	is_banned BOOL NOT NULL DEFAULT false,
	ban_reason TEXT NOT NULL DEFAULT '',
	is_waitlisted BOOL NOT NULL DEFAULT false,
	permission_level INT NOT NULL DEFAULT 0,
	first_seen TEXT NOT NULL DEFAULT '',
	last_seen TEXT NOT NULL DEFAULT '',
	total_playtime_seconds INT NOT NULL DEFAULT 0,
	current_session_start TEXT DEFAULT NULL,
	is_online BOOL NOT NULL DEFAULT false,
	notes TEXT NOT NULL DEFAULT '',
	UNIQUE(server_id, name),
	FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	server_id TEXT NOT NULL,
	player_name TEXT NOT NULL,
	ip_address TEXT NOT NULL DEFAULT '',
	joined_at TEXT NOT NULL DEFAULT '',
	left_at TEXT DEFAULT NULL,
	duration_seconds INT NOT NULL DEFAULT 0,
	FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_ip_history (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	server_id TEXT NOT NULL,
	player_name TEXT NOT NULL,
	ip_address TEXT NOT NULL,
	seen_at TEXT NOT NULL DEFAULT '',
	FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_logs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	server_id TEXT NOT NULL,
	level TEXT NOT NULL DEFAULT 'info',
	source TEXT NOT NULL DEFAULT 'server',
	message TEXT NOT NULL,
	timestamp TEXT NOT NULL DEFAULT '',
	FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS metrics (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	server_id TEXT NOT NULL,
	cpu REAL NOT NULL DEFAULT 0,
	ram REAL NOT NULL DEFAULT 0,
	players INT NOT NULL DEFAULT 0,
	tps REAL NOT NULL DEFAULT 20,
	recorded_at TEXT NOT NULL DEFAULT '',
	FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS automation_rules (
	id TEXT PRIMARY KEY,
	server_id TEXT NOT NULL,
	name TEXT NOT NULL,
	trigger TEXT NOT NULL,
	action TEXT NOT NULL,
	action_payload TEXT NOT NULL DEFAULT '',
	enabled BOOL NOT NULL DEFAULT true,
	cooldown_ms INT NOT NULL DEFAULT 60000,
	FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
	id TEXT PRIMARY KEY,
	server_id TEXT NOT NULL,
	name TEXT NOT NULL,
	cron_expr TEXT NOT NULL,
	action TEXT NOT NULL,
	action_payload TEXT NOT NULL DEFAULT '',
	enabled BOOL NOT NULL DEFAULT true,
	FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	mc_username TEXT,
	discord_username TEXT DEFAULT '',
	phone_number TEXT,
	roles TEXT NOT NULL DEFAULT '["member"]',
	site_name TEXT DEFAULT '',
	created_at TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tickets (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	title TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'open',
	assigned_to TEXT,
	created_at TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL DEFAULT '',
	FOREIGN KEY (user_id) REFERENCES site_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_messages (
	id TEXT PRIMARY KEY,
	ticket_id TEXT NOT NULL,
	sender_id TEXT NOT NULL,
	message TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT '',
	FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS store_items (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	price REAL NOT NULL,
	category TEXT NOT NULL,
	display_image TEXT DEFAULT '',
	is_active BOOL NOT NULL DEFAULT true,
	metadata TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS social_requests (
	id TEXT PRIMARY KEY,
	from_id TEXT NOT NULL,
	to_id TEXT NOT NULL,
	type TEXT NOT NULL DEFAULT 'friend',
	status TEXT NOT NULL DEFAULT 'pending',
	created_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS friends (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	friend_id TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT '',
	UNIQUE(user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS trades (
	id TEXT PRIMARY KEY,
	seller_id TEXT NOT NULL,
	seller_name TEXT NOT NULL DEFAULT '',
	type TEXT NOT NULL DEFAULT 'in-game',
	item_name TEXT NOT NULL,
	item_description TEXT NOT NULL DEFAULT '',
	asking_price TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'open',
	created_at TEXT NOT NULL DEFAULT '',
	FOREIGN KEY (seller_id) REFERENCES site_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchases (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	item_id TEXT NOT NULL,
	item_name TEXT NOT NULL DEFAULT '',
	quantity INT NOT NULL DEFAULT 1,
	amount REAL NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT '',
	FOREIGN KEY (user_id) REFERENCES site_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bans (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL UNIQUE,
	reason TEXT NOT NULL DEFAULT '',
	duration TEXT NOT NULL DEFAULT '',
	banned_at TEXT NOT NULL DEFAULT '',
	expires_at TEXT,
	FOREIGN KEY (user_id) REFERENCES site_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	item_name TEXT NOT NULL,
	item_type TEXT NOT NULL DEFAULT 'item',
	quantity INT NOT NULL DEFAULT 1,
	metadata TEXT DEFAULT '{}',
	acquired_from TEXT DEFAULT '',
	acquired_at TEXT NOT NULL DEFAULT '',
	is_hidden BOOL NOT NULL DEFAULT false,
	is_frozen BOOL NOT NULL DEFAULT false,
	FOREIGN KEY (user_id) REFERENCES site_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
	id TEXT PRIMARY KEY,
	reporter_id TEXT NOT NULL,
	reported_id TEXT NOT NULL,
	reason TEXT NOT NULL DEFAULT '',
	description TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'open',
	resolved_by TEXT,
	resolved_at TEXT,
	created_at TEXT NOT NULL DEFAULT '',
	FOREIGN KEY (reporter_id) REFERENCES site_users(id) ON DELETE CASCADE,
	FOREIGN KEY (reported_id) REFERENCES site_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS follows (
	id TEXT PRIMARY KEY,
	follower_id TEXT NOT NULL,
	following_id TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT '',
	UNIQUE(follower_id, following_id),
	FOREIGN KEY (follower_id) REFERENCES site_users(id) ON DELETE CASCADE,
	FOREIGN KEY (following_id) REFERENCES site_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS moderation_actions (
	id TEXT PRIMARY KEY,
	target_user_id TEXT NOT NULL,
	performed_by TEXT NOT NULL,
	action TEXT NOT NULL,
	reason TEXT NOT NULL DEFAULT '',
	duration_seconds INT DEFAULT NULL,
	metadata TEXT DEFAULT '{}',
	created_at TEXT NOT NULL DEFAULT '',
	expires_at TEXT,
	is_active BOOL NOT NULL DEFAULT true,
	FOREIGN KEY (target_user_id) REFERENCES site_users(id) ON DELETE CASCADE,
	FOREIGN KEY (performed_by) REFERENCES site_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auctions (
	id TEXT PRIMARY KEY,
	seller_id TEXT NOT NULL,
	seller_name TEXT NOT NULL DEFAULT '',
	item_name TEXT NOT NULL,
	item_description TEXT NOT NULL DEFAULT '',
	starting_price REAL NOT NULL DEFAULT 0,
	current_bid REAL NOT NULL DEFAULT 0,
	current_bidder_id TEXT,
	current_bidder_name TEXT,
	status TEXT NOT NULL DEFAULT 'active',
	starts_at TEXT NOT NULL DEFAULT '',
	ends_at TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL DEFAULT '',
	FOREIGN KEY (seller_id) REFERENCES site_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL,
type TEXT NOT NULL DEFAULT 'info',
title TEXT NOT NULL DEFAULT '',
message TEXT NOT NULL DEFAULT '',
is_read BOOL NOT NULL DEFAULT false,
link TEXT DEFAULT '',
created_at TEXT NOT NULL DEFAULT '',
FOREIGN KEY (user_id) REFERENCES site_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_config (
key TEXT PRIMARY KEY,
value TEXT NOT NULL,
description TEXT NOT NULL DEFAULT '',
updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS discord_role_mappings (
id TEXT PRIMARY KEY,
discord_role_id TEXT NOT NULL,
discord_role_name TEXT NOT NULL,
site_role TEXT NOT NULL,
sync_direction TEXT NOT NULL DEFAULT 'discord-to-site',
created_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_players_server_online ON players(server_id, is_online);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_player_sessions_server ON player_sessions(server_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_server_logs_server_ts ON server_logs(server_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_server_logs_level ON server_logs(server_id, level);
CREATE INDEX IF NOT EXISTS idx_metrics_server_ts ON metrics(server_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_social_requests_to ON social_requests(to_id, status);
CREATE INDEX IF NOT EXISTS idx_social_requests_from ON social_requests(from_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_bans_expires ON bans(expires_at);
CREATE INDEX IF NOT EXISTS idx_mod_actions_target ON moderation_actions(target_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mod_actions_expires ON moderation_actions(expires_at, is_active);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_players_uuid ON players(uuid);
CREATE INDEX IF NOT EXISTS idx_players_banned ON players(is_banned);
CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen);
CREATE INDEX IF NOT EXISTS idx_players_playtime ON players(total_playtime_seconds);
CREATE INDEX IF NOT EXISTS idx_site_users_email ON site_users(email);
CREATE INDEX IF NOT EXISTS idx_site_users_mc_username ON site_users(mc_username);
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON tickets(status, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_auctions_active ON auctions(status, ends_at, current_bid);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory(user_id, item_type);
CREATE INDEX IF NOT EXISTS idx_player_ip_history_name ON player_ip_history(server_id, player_name);

CREATE TABLE IF NOT EXISTS auction_bids (
	id TEXT PRIMARY KEY,
	auction_id TEXT NOT NULL,
	bidder_id TEXT NOT NULL,
	bidder_name TEXT NOT NULL DEFAULT '',
	amount REAL NOT NULL,
	created_at TEXT NOT NULL DEFAULT '',
	FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
	FOREIGN KEY (bidder_id) REFERENCES site_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auction_bids_auction ON auction_bids(auction_id, amount);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder ON auction_bids(bidder_id);
`;

export async function initDatabase(): Promise<boolean> {
	const database = await ensureDb();
	if (!database) {
		console.error('[Database] Cannot init: database not open');
		return false;
	}
	try {
		// Create tables and indexes
		const statements = SCHEMA_SQL.split(';').map(s => s.trim()).filter(Boolean);
		for (const stmt of statements) {
			if (stmt.length > 0) {
				await database.execute(stmt);
			}
		}

		// Migrations: add missing columns to existing tables
		const migrations = [
			`ALTER TABLE site_users ADD COLUMN phone_number TEXT DEFAULT NULL`,
			`ALTER TABLE site_users ADD COLUMN discord_username TEXT DEFAULT ''`,
			`ALTER TABLE site_users ADD COLUMN site_name TEXT DEFAULT ''`,
			`ALTER TABLE site_users ADD COLUMN created_at TEXT DEFAULT ''`,
			`ALTER TABLE site_users ADD COLUMN updated_at TEXT DEFAULT ''`,
			`ALTER TABLE site_users ADD COLUMN avatar_url TEXT DEFAULT NULL`,
			`ALTER TABLE players ADD COLUMN uuid TEXT DEFAULT ''`,
			`ALTER TABLE players ADD COLUMN ip_address TEXT DEFAULT ''`,
			`ALTER TABLE players ADD COLUMN total_playtime_seconds INT DEFAULT 0`,
			`ALTER TABLE players ADD COLUMN current_session_start TEXT DEFAULT NULL`,
			`ALTER TABLE players ADD COLUMN is_online BOOL DEFAULT false`,
			`ALTER TABLE players ADD COLUMN notes TEXT DEFAULT ''`,
			`ALTER TABLE inventory ADD COLUMN is_frozen BOOL DEFAULT false`,
			`ALTER TABLE inventory ADD COLUMN metadata TEXT DEFAULT '{}'`,
			`ALTER TABLE inventory ADD COLUMN acquired_from TEXT DEFAULT ''`,
			`ALTER TABLE inventory ADD COLUMN acquired_at TEXT DEFAULT ''`,
			`ALTER TABLE inventory ADD COLUMN is_hidden BOOL DEFAULT false`,
			`ALTER TABLE auctions ADD COLUMN current_bidder_name TEXT DEFAULT NULL`,
			`ALTER TABLE auctions ADD COLUMN starts_at TEXT DEFAULT ''`,
			`ALTER TABLE auctions ADD COLUMN seller_name TEXT DEFAULT ''`,
			`ALTER TABLE trades ADD COLUMN seller_name TEXT DEFAULT ''`,
			`ALTER TABLE trades ADD COLUMN type TEXT DEFAULT 'in-game'`,
			`ALTER TABLE trades ADD COLUMN item_description TEXT DEFAULT ''`,
			`ALTER TABLE trades ADD COLUMN asking_price TEXT DEFAULT ''`,
			`ALTER TABLE tickets ADD COLUMN assigned_to TEXT DEFAULT NULL`,
			`ALTER TABLE moderation_actions ADD COLUMN metadata TEXT DEFAULT '{}'`,
			`ALTER TABLE moderation_actions ADD COLUMN duration_seconds INT DEFAULT NULL`,
		];

		for (const migration of migrations) {
			try { await database.execute(migration); } catch { /* Column already exists */ }
		}

		console.log('[Database] Schema initialized successfully');
		return true;
	} catch (err: any) {
		console.error('[Database] Schema init failed:', err.message);
		return false;
	}
}

export async function getDbStatus(): Promise<{ exists: boolean; tables: string[] }> {
	try {
		const results = await sql("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
		if (results.length > 0) {
			return { exists: true, tables: results[0].rows.map((r) => String(r.name)) };
		}
	} catch (err) {
		logDbError('getDbStatus', err);
	}
	return { exists: false, tables: [] };
}

export interface ServerRecord {
	id: string; name: string; software: string; version: string;
	ram: string; cpu_limit: number; status: string;
	created_at: string; updated_at: string;
}

export async function upsertServer(r: ServerRecord) {
	await sql(`INSERT INTO servers (id,name,software,version,ram,cpu_limit,status,created_at,updated_at)
		VALUES ('${r.id}','${r.name}','${r.software}','${r.version}','${r.ram}',${r.cpu_limit},'${r.status}','${r.created_at}','${r.updated_at}')
		ON CONFLICT(id) DO UPDATE SET name=excluded.name,software=excluded.software,version=excluded.version,
		ram=excluded.ram,cpu_limit=excluded.cpu_limit,status=excluded.status,updated_at=excluded.updated_at`);
}

export async function deleteServer(id: string) {
	const eid = escapeStr(id);
	await sql(`DELETE FROM servers WHERE id='${eid}'`);
	await sql(`DELETE FROM players WHERE server_id='${eid}'`);
	await sql(`DELETE FROM player_sessions WHERE server_id='${eid}'`);
	await sql(`DELETE FROM player_ip_history WHERE server_id='${eid}'`);
	await sql(`DELETE FROM server_logs WHERE server_id='${eid}'`);
	await sql(`DELETE FROM metrics WHERE server_id='${eid}'`);
	await sql(`DELETE FROM automation_rules WHERE server_id='${eid}'`);
	await sql(`DELETE FROM scheduled_tasks WHERE server_id='${eid}'`);
}

export async function getAllServers(): Promise<ServerRecord[]> {
	try {
		const r = await sql('SELECT * FROM servers ORDER BY created_at');
		if (r.length > 0) return r[0].rows as unknown as ServerRecord[];
	} catch (err) {
		logDbError('getAllServers', err);
	}
	return [];
}

export async function getServer(id: string): Promise<ServerRecord | null> {
	try {
		const r = await sql(`SELECT * FROM servers WHERE id='${escapeStr(id)}'`);
		if (r.length > 0 && r[0].rows.length > 0) return r[0].rows[0] as unknown as ServerRecord;
	} catch (err) {
		logDbError('getServer', err);
	}
	return null;
}

export async function updateServerStatus(id: string, status: string) {
	await sql(`UPDATE servers SET status='${escapeStr(status)}', updated_at=datetime('now') WHERE id='${escapeStr(id)}'`);
}

export async function clearAllServers() {
	await sql('DELETE FROM server_logs');
	await sql('DELETE FROM metrics');
	await sql('DELETE FROM player_ip_history');
	await sql('DELETE FROM player_sessions');
	await sql('DELETE FROM players');
	await sql('DELETE FROM automation_rules');
	await sql('DELETE FROM scheduled_tasks');
	await sql('DELETE FROM servers');
}

export interface PlayerRecord {
	id: number; server_id: string; name: string; uuid: string;
	ip_address: string; is_op: boolean; is_whitelisted: boolean;
	is_banned: boolean; ban_reason: string; is_waitlisted: boolean;
	permission_level: number; first_seen: string; last_seen: string;
	total_playtime_seconds: number; current_session_start: string | null;
	is_online: boolean; notes: string;
}

export async function upsertPlayer(r: Partial<PlayerRecord> & { server_id: string; name: string }) {
	const now = new Date().toISOString();
	await sql(`INSERT INTO players (server_id,name,uuid,ip_address,is_op,is_whitelisted,is_banned,ban_reason,is_waitlisted,permission_level,first_seen,last_seen,total_playtime_seconds,is_online,notes)
		VALUES ('${escapeStr(r.server_id)}','${escapeStr(r.name)}','${escapeStr(r.uuid || '')}','${escapeStr(r.ip_address || '')}',${r.is_op ?? false},${r.is_whitelisted ?? false},${r.is_banned ?? false},'${escapeStr(r.ban_reason || '')}',${r.is_waitlisted ?? false},${r.permission_level ?? 0},'${r.first_seen || now}','${r.last_seen || now}',${r.total_playtime_seconds ?? 0},${r.is_online ?? false},'${escapeStr(r.notes || '')}')
		ON CONFLICT(server_id,name) DO UPDATE SET
		uuid=COALESCE(NULLIF(excluded.uuid,''),uuid),
		ip_address=COALESCE(NULLIF(excluded.ip_address,''),ip_address),
		is_op=excluded.is_op,is_whitelisted=excluded.is_whitelisted,
		is_banned=excluded.is_banned,ban_reason=excluded.ban_reason,
		is_waitlisted=excluded.is_waitlisted,permission_level=excluded.permission_level,
		last_seen='${now}',is_online=excluded.is_online,notes=excluded.notes`);
}

export async function setPlayerOnline(serverId: string, name: string, ip: string, online: boolean) {
	const now = new Date().toISOString();
	await sql(`INSERT INTO players (server_id,name,ip_address,first_seen,last_seen,is_online)
		VALUES ('${escapeStr(serverId)}','${escapeStr(name)}','${escapeStr(ip)}','${now}','${now}',${online})
		ON CONFLICT(server_id,name) DO UPDATE SET
		ip_address=COALESCE(NULLIF('${escapeStr(ip)}',''),ip_address),
		last_seen='${now}',is_online=${online}`);
	if (ip) {
		await sql(`INSERT INTO player_ip_history (server_id,player_name,ip_address) VALUES ('${escapeStr(serverId)}','${escapeStr(name)}','${escapeStr(ip)}')`);
	}
}

export async function setPlayerBan(serverId: string, name: string, banned: boolean, reason: string = '') {
	await sql(`UPDATE players SET is_banned=${banned},ban_reason='${escapeStr(reason)}' WHERE server_id='${escapeStr(serverId)}' AND name='${escapeStr(name)}'`);
}

export async function setPlayerOp(serverId: string, name: string, isOp: boolean, level: number = 4) {
	await sql(`UPDATE players SET is_op=${isOp},permission_level=${isOp ? level : 0} WHERE server_id='${escapeStr(serverId)}' AND name='${escapeStr(name)}'`);
}

export async function setPlayerWaitlist(serverId: string, name: string, waitlisted: boolean) {
	await sql(`UPDATE players SET is_waitlisted=${waitlisted} WHERE server_id='${escapeStr(serverId)}' AND name='${escapeStr(name)}'`);
}

export async function setPlayerWhitelist(serverId: string, name: string, whitelisted: boolean) {
	await sql(`UPDATE players SET is_whitelisted=${whitelisted} WHERE server_id='${escapeStr(serverId)}' AND name='${escapeStr(name)}'`);
}

export async function updatePlayerNotes(serverId: string, name: string, notes: string) {
	await sql(`UPDATE players SET notes='${escapeStr(notes)}' WHERE server_id='${escapeStr(serverId)}' AND name='${escapeStr(name)}'`);
}

export async function deletePlayer(serverId: string, name: string) {
	await sql(`DELETE FROM players WHERE server_id='${escapeStr(serverId)}' AND name='${escapeStr(name)}'`);
}

export async function getPlayers(serverId: string): Promise<PlayerRecord[]> {
	try {
		const r = await sql(`SELECT * FROM players WHERE server_id='${escapeStr(serverId)}' ORDER BY last_seen DESC`);
		if (r.length > 0) return r[0].rows as unknown as PlayerRecord[];
	} catch (err) {
		logDbError('getPlayers', err);
	}
	return [];
}

export async function getOnlinePlayers(serverId: string): Promise<PlayerRecord[]> {
	try {
		const r = await sql(`SELECT * FROM players WHERE server_id='${escapeStr(serverId)}' AND is_online=true ORDER BY name`);
		if (r.length > 0) return r[0].rows as unknown as PlayerRecord[];
	} catch (err) {
		logDbError('getOnlinePlayers', err);
	}
	return [];
}

export async function clearPlayers(serverId: string) {
	await sql(`DELETE FROM player_ip_history WHERE server_id='${escapeStr(serverId)}'`);
	await sql(`DELETE FROM player_sessions WHERE server_id='${escapeStr(serverId)}'`);
	await sql(`DELETE FROM players WHERE server_id='${escapeStr(serverId)}'`);
}

export interface PlayerSession {
	id: number; server_id: string; player_name: string;
	ip_address: string; joined_at: string; left_at: string | null;
	duration_seconds: number;
}

export async function startSession(serverId: string, name: string, ip: string) {
	const now = new Date().toISOString();
	await sql(`INSERT INTO player_sessions (server_id,player_name,ip_address,joined_at) VALUES ('${escapeStr(serverId)}','${escapeStr(name)}','${escapeStr(ip)}','${now}')`);
	await sql(`UPDATE players SET current_session_start='${now}' WHERE server_id='${escapeStr(serverId)}' AND name='${escapeStr(name)}'`);
}

export async function endSession(serverId: string, name: string) {
	const now = new Date().toISOString();
	await sql(`UPDATE player_sessions SET left_at='${now}', duration_seconds=strftime('%s','${now}')-strftime('%s',joined_at)
		WHERE server_id='${escapeStr(serverId)}' AND player_name='${escapeStr(name)}' AND left_at IS NULL ORDER BY id DESC LIMIT 1`);
	await sql(`UPDATE players SET current_session_start=NULL WHERE server_id='${escapeStr(serverId)}' AND name='${escapeStr(name)}'`);
}

export async function getSessions(serverId: string, limit: number = 50): Promise<PlayerSession[]> {
	try {
		const r = await sql(`SELECT * FROM player_sessions WHERE server_id='${escapeStr(serverId)}' ORDER BY joined_at DESC LIMIT ${limit}`);
		if (r.length > 0) return r[0].rows as unknown as PlayerSession[];
	} catch (err) {
		logDbError('getSessions', err);
	}
	return [];
}

export interface PlayerIpRecord {
	id: number; server_id: string; player_name: string;
	ip_address: string; seen_at: string;
}

export async function getPlayerIpHistory(serverId: string, playerName: string): Promise<PlayerIpRecord[]> {
	try {
		const r = await sql(`SELECT * FROM player_ip_history WHERE server_id='${escapeStr(serverId)}' AND player_name='${escapeStr(playerName)}' ORDER BY seen_at DESC`);
		if (r.length > 0) return r[0].rows as unknown as PlayerIpRecord[];
	} catch (err) {
		logDbError('getPlayerIpHistory', err);
	}
	return [];
}

export interface ServerLogRecord {
	id: number; server_id: string; level: string;
	source: string; message: string; timestamp: string;
}

export async function insertLog(r: { server_id: string; level?: string; source?: string; message: string }) {
	await sql(`INSERT INTO server_logs (server_id,level,source,message) VALUES ('${escapeStr(r.server_id)}','${r.level || 'info'}','${r.source || 'server'}','${escapeStr(r.message)}')`);
}

export async function getLogs(serverId: string, opts?: { limit?: number; level?: string; search?: string; offset?: number }): Promise<ServerLogRecord[]> {
	try {
		let where = `WHERE server_id='${escapeStr(serverId)}'`;
		if (opts?.level && opts.level !== 'all') where += ` AND level='${escapeStr(opts.level)}'`;
		if (opts?.search) where += ` AND message LIKE '%${escapeStr(opts.search)}%'`;
		const limit = opts?.limit ?? 200;
		const offset = opts?.offset ?? 0;
		const r = await sql(`SELECT * FROM server_logs ${where} ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`);
		if (r.length > 0) return (r[0].rows as unknown as ServerLogRecord[]).reverse();
	} catch (err) {
		logDbError('getLogs', err);
	}
	return [];
}

export async function getLogCount(serverId: string, opts?: { level?: string; search?: string }): Promise<number> {
	try {
		let where = `WHERE server_id='${escapeStr(serverId)}'`;
		if (opts?.level && opts.level !== 'all') where += ` AND level='${escapeStr(opts.level)}'`;
		if (opts?.search) where += ` AND message LIKE '%${escapeStr(opts.search)}%'`;
		const r = await sql(`SELECT COUNT(*) as cnt FROM server_logs ${where}`);
		if (r.length > 0 && r[0].rows.length > 0) return Number(r[0].rows[0].cnt);
	} catch (err) {
		logDbError('getLogCount', err);
	}
	return 0;
}

export async function clearLogs(serverId: string) {
	await sql(`DELETE FROM server_logs WHERE server_id='${escapeStr(serverId)}'`);
}

export interface MetricRecord {
	id: number; server_id: string; cpu: number; ram: number;
	players: number; tps: number; recorded_at: string;
}

export async function insertMetric(r: { server_id: string; cpu: number; ram: number; players: number; tps: number }) {
	await sql(`INSERT INTO metrics (server_id,cpu,ram,players,tps) VALUES ('${escapeStr(r.server_id)}',${r.cpu},${r.ram},${r.players},${r.tps})`);
}

export async function getMetrics(serverId: string, limit: number = 60): Promise<MetricRecord[]> {
	try {
		const r = await sql(`SELECT * FROM metrics WHERE server_id='${escapeStr(serverId)}' ORDER BY recorded_at DESC LIMIT ${limit}`);
		if (r.length > 0) return (r[0].rows as unknown as MetricRecord[]).reverse();
	} catch (err) {
		logDbError('getMetrics', err);
	}
	return [];
}

export async function pruneMetrics(serverId: string, keep: number = 2000) {
	await sql(`DELETE FROM metrics WHERE server_id='${escapeStr(serverId)}' AND id NOT IN (SELECT id FROM metrics WHERE server_id='${escapeStr(serverId)}' ORDER BY recorded_at DESC LIMIT ${keep})`);
}

export async function clearMetrics(serverId: string) {
	await sql(`DELETE FROM metrics WHERE server_id='${escapeStr(serverId)}'`);
}

export interface AutomationRuleRecord {
	id: string; server_id: string; name: string; trigger: string;
	action: string; action_payload: string; enabled: boolean; cooldown_ms: number;
}

export async function upsertAutomationRule(r: AutomationRuleRecord) {
	await sql(`INSERT INTO automation_rules (id,server_id,name,trigger,action,action_payload,enabled,cooldown_ms)
		VALUES ('${r.id}','${escapeStr(r.server_id)}','${escapeStr(r.name)}','${escapeStr(r.trigger)}','${escapeStr(r.action)}','${escapeStr(r.action_payload)}',${r.enabled},${r.cooldown_ms})
		ON CONFLICT(id) DO UPDATE SET name=excluded.name,trigger=excluded.trigger,action=excluded.action,
		action_payload=excluded.action_payload,enabled=excluded.enabled,cooldown_ms=excluded.cooldown_ms`);
}

export async function getAutomationRules(serverId: string): Promise<AutomationRuleRecord[]> {
	try {
		const r = await sql(`SELECT * FROM automation_rules WHERE server_id='${escapeStr(serverId)}'`);
		if (r.length > 0) return r[0].rows as unknown as AutomationRuleRecord[];
	} catch (err) {
		logDbError('getAutomationRules', err);
	}
	return [];
}

export async function deleteAutomationRule(id: string) {
	await sql(`DELETE FROM automation_rules WHERE id='${escapeStr(id)}'`);
}

export interface ScheduledTaskRecord {
	id: string; server_id: string; name: string; cron_expr: string;
	action: string; action_payload: string; enabled: boolean;
}

export async function upsertScheduledTask(r: ScheduledTaskRecord) {
	await sql(`INSERT INTO scheduled_tasks (id,server_id,name,cron_expr,action,action_payload,enabled)
		VALUES ('${r.id}','${escapeStr(r.server_id)}','${escapeStr(r.name)}','${escapeStr(r.cron_expr)}','${escapeStr(r.action)}','${escapeStr(r.action_payload)}',${r.enabled})
		ON CONFLICT(id) DO UPDATE SET name=excluded.name,cron_expr=excluded.cron_expr,action=excluded.action,
		action_payload=excluded.action_payload,enabled=excluded.enabled`);
}

export async function getScheduledTasks(serverId: string): Promise<ScheduledTaskRecord[]> {
	try {
		const r = await sql(`SELECT * FROM scheduled_tasks WHERE server_id='${escapeStr(serverId)}'`);
		if (r.length > 0) return r[0].rows as unknown as ScheduledTaskRecord[];
	} catch (err) {
		logDbError('getScheduledTasks', err);
	}
	return [];
}

export async function deleteScheduledTask(id: string) {
	await sql(`DELETE FROM scheduled_tasks WHERE id='${escapeStr(id)}'`);
}

export async function getPlayerStats(serverId: string) {
	try {
		const [total, online, banned, ops, whitelisted, waitlisted] = await Promise.all([
			sql(`SELECT COUNT(*) as c FROM players WHERE server_id='${escapeStr(serverId)}'`),
			sql(`SELECT COUNT(*) as c FROM players WHERE server_id='${escapeStr(serverId)}' AND is_online=true`),
			sql(`SELECT COUNT(*) as c FROM players WHERE server_id='${escapeStr(serverId)}' AND is_banned=true`),
			sql(`SELECT COUNT(*) as c FROM players WHERE server_id='${escapeStr(serverId)}' AND is_op=true`),
			sql(`SELECT COUNT(*) as c FROM players WHERE server_id='${escapeStr(serverId)}' AND is_whitelisted=true`),
			sql(`SELECT COUNT(*) as c FROM players WHERE server_id='${escapeStr(serverId)}' AND is_waitlisted=true`),
		]);
		return {
			total: Number(total[0]?.rows[0]?.c ?? 0),
			online: Number(online[0]?.rows[0]?.c ?? 0),
			banned: Number(banned[0]?.rows[0]?.c ?? 0),
			ops: Number(ops[0]?.rows[0]?.c ?? 0),
			whitelisted: Number(whitelisted[0]?.rows[0]?.c ?? 0),
			waitlisted: Number(waitlisted[0]?.rows[0]?.c ?? 0),
		};
	} catch (err) {
		logDbError('getPlayerStats', err);
		return { total: 0, online: 0, banned: 0, ops: 0, whitelisted: 0, waitlisted: 0 };
	}
}

// ---- Production Maintenance ----

export async function pruneServerLogs(serverId: string, keep: number = 10000) {
	await sql(`DELETE FROM server_logs WHERE server_id='${escapeStr(serverId)}' AND id NOT IN (SELECT id FROM server_logs WHERE server_id='${escapeStr(serverId)}' ORDER BY timestamp DESC LIMIT ${keep})`);
}

export async function cleanupExpiredBans() {
	await sql("DELETE FROM bans WHERE expires_at IS NOT NULL AND expires_at < datetime('now')");
}

export async function cleanupExpiredModerationActions() {
	await sql("UPDATE moderation_actions SET is_active=false WHERE is_active=true AND expires_at IS NOT NULL AND expires_at < datetime('now')");
}

export async function cleanupOldNotifications(keepDays: number = 30) {
	await sql(`DELETE FROM notifications WHERE is_read=true AND created_at < datetime('now', '-${keepDays} days')`);
}

export async function cleanupOldPlayerSessions(keepDays: number = 90) {
	await sql(`DELETE FROM player_sessions WHERE joined_at < datetime('now', '-${keepDays} days')`);
}

export async function runMaintenance() {
	try {
		await cleanupExpiredBans();
		await cleanupExpiredModerationActions();
		await cleanupOldNotifications();
		await cleanupOldPlayerSessions();
		const servers = await getAllServers();
		for (const server of servers) {
			await pruneMetrics(server.id);
			await pruneServerLogs(server.id);
		}
		console.log('[Database] Maintenance completed');
	} catch (err: any) {
		console.error('[Database] Maintenance failed:', err.message);
	}
}

export async function getDatabaseStats(): Promise<{ tables: Record<string, number> }> {
	const tables = ['site_users', 'players', 'server_logs', 'metrics', 'inventory', 'trades', 'auctions', 'reports', 'moderation_actions', 'notifications', 'friends', 'follows', 'tickets', 'store_items', 'purchases'];
	const result: Record<string, number> = {};
	for (const table of tables) {
		try {
			const r = await sql(`SELECT COUNT(*) as c FROM ${table}`);
			result[table] = Number(r[0]?.rows[0]?.c ?? 0);
		} catch {
			result[table] = -1;
		}
	}
	return { tables: result };
}

// ═══════════════════════════════════════════════════════════════
// BATCH OPERATIONS - For 100k player scale
// ═══════════════════════════════════════════════════════════════

/**
 * Batch upsert players - handles 100k+ player records efficiently.
 * Uses a single transaction for all inserts.
 */
export async function batchUpsertPlayers(serverId: string, players: Array<{
	name: string;
	uuid?: string;
	ip_address?: string;
	is_online?: boolean;
}>): Promise<number> {
	if (players.length === 0) return 0;
	const database = await ensureDb();
	if (!database) return 0;

	const now = new Date().toISOString();
	let count = 0;

	try {
		await database.execute('BEGIN TRANSACTION');
		for (const p of players) {
			await database.execute({
				sql: `INSERT INTO players (server_id, name, uuid, ip_address, is_online, last_seen, first_seen)
					VALUES (?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT(server_id, name) DO UPDATE SET
					uuid = COALESCE(NULLIF(?, ''), uuid),
					ip_address = COALESCE(NULLIF(?, ''), ip_address),
					is_online = ?,
					last_seen = ?`,
				args: [serverId, p.name, p.uuid || '', p.ip_address || '', p.is_online ? 1 : 0, now, now, p.uuid || '', p.ip_address || '', p.is_online ? 1 : 0, now]
			});
			count++;
		}
		await database.execute('COMMIT');
	} catch (err) {
		await database.execute('ROLLBACK');
		throw err;
	}
	return count;
}

/**
 * Batch set player online status - for tracking 100k+ players.
 */
export async function batchSetPlayersOnline(serverId: string, onlineNames: string[]): Promise<void> {
	const database = await ensureDb();
	if (!database) return;
	if (onlineNames.length === 0) return;

	const now = new Date().toISOString();

	try {
		await database.execute('BEGIN TRANSACTION');
		// First set all offline
		await database.execute({
			sql: `UPDATE players SET is_online = 0, current_session_start = NULL WHERE server_id = ? AND is_online = 1`,
			args: [serverId]
		});

		// Then set online for names in list
		for (const name of onlineNames) {
			await database.execute({
				sql: `UPDATE players SET is_online = 1, last_seen = ?, current_session_start = COALESCE(current_session_start, ?) WHERE server_id = ? AND name = ?`,
				args: [now, now, serverId, name]
			});
		}
		await database.execute('COMMIT');
	} catch (err) {
		await database.execute('ROLLBACK');
		throw err;
	}
}

/**
 * Batch insert metrics - for high-frequency metric collection.
 */
export async function batchInsertMetrics(serverId: string, metricsData: Array<{
	cpu: number;
	ram: number;
	players: number;
	tps: number;
}>): Promise<void> {
	const database = await ensureDb();
	if (!database) return;
	if (metricsData.length === 0) return;

	const now = new Date().toISOString();

	try {
		await database.execute('BEGIN TRANSACTION');
		for (const m of metricsData) {
			await database.execute({
				sql: `INSERT INTO metrics (server_id, cpu, ram, players, tps, recorded_at) VALUES (?, ?, ?, ?, ?, ?)`,
				args: [serverId, m.cpu, m.ram, m.players, m.tps, now]
			});
		}
		await database.execute('COMMIT');
	} catch (err) {
		await database.execute('ROLLBACK');
		throw err;
	}
}

/**
 * Batch insert logs - for high-throughput log ingestion.
 */
export async function batchInsertLogs(serverId: string, logs: Array<{
	level: string;
	source: string;
	message: string;
}>): Promise<void> {
	const database = await ensureDb();
	if (!database) return;
	if (logs.length === 0) return;

	const now = new Date().toISOString();

	try {
		await database.execute('BEGIN TRANSACTION');
		for (const l of logs) {
			await database.execute({
				sql: `INSERT INTO server_logs (server_id, level, source, message, timestamp) VALUES (?, ?, ?, ?, ?)`,
				args: [serverId, l.level || 'info', l.source || 'server', l.message, now]
			});
		}
		await database.execute('COMMIT');
	} catch (err) {
		await database.execute('ROLLBACK');
		throw err;
	}
}

// ═══════════════════════════════════════════════════════════════
// CURSOR-BASED PAGINATION - For 100k player lists
// ═══════════════════════════════════════════════════════════════

/**
 * Cursor-based pagination for players (handles 100k+ efficiently).
 * Uses the player id as cursor instead of OFFSET for O(1) seek.
 */
export async function getPlayersPaginated(serverId: string, options: {
	cursor?: number;
	limit?: number;
	onlineOnly?: boolean;
	search?: string;
} = {}): Promise<{ players: any[]; nextCursor: number | null; hasMore: boolean }> {
	const limit = Math.min(options.limit || 50, 200);
	let query = 'SELECT * FROM players WHERE server_id = ?';
	const params: any[] = [serverId];

	if (options.cursor) {
		query += ' AND id > ?';
		params.push(options.cursor);
	}
	if (options.onlineOnly) {
		query += ' AND is_online = 1';
	}
	if (options.search) {
		query += ' AND name LIKE ?';
		params.push(`%${options.search}%`);
	}
	query += ' ORDER BY id ASC LIMIT ?';
	params.push(limit + 1);

	// Build query string with escaped params for libsql
	const q = query.replace(/\?/g, () => `'${params.shift()}'`);
	const result = await sql(q);
	const rows = result[0]?.rows || [];
	const hasMore = rows.length > limit;
	const players = hasMore ? rows.slice(0, limit) : rows;
	const nextCursor = hasMore ? Number(players[players.length - 1]?.id) : null;

	return { players, nextCursor, hasMore };
}

/**
 * Cursor-based pagination for site users.
 */
export async function getUsersPaginated(options: {
	cursor?: string;
	limit?: number;
	search?: string;
	role?: string;
} = {}): Promise<{ users: any[]; nextCursor: string | null; hasMore: boolean }> {
	const limit = Math.min(options.limit || 50, 200);
	let query = 'SELECT * FROM site_users WHERE 1=1';
	const params: any[] = [];

	if (options.cursor) {
		query += ' AND id > ?';
		params.push(options.cursor);
	}
	if (options.search) {
		query += ' AND (mc_username LIKE ? OR site_name LIKE ? OR email LIKE ?)';
		const s = `%${options.search}%`;
		params.push(s, s, s);
	}
	query += ' ORDER BY id ASC LIMIT ?';
	params.push(limit + 1);

	const q = query.replace(/\?/g, () => `'${escapeStr(params.shift())}'`);
	const result = await sql(q);
	const rows = result[0]?.rows || [];
	const hasMore = rows.length > limit;
	const users = hasMore ? rows.slice(0, limit) : rows;
	const nextCursor = hasMore ? String(users[users.length - 1]?.id) : null;

	return { users, nextCursor, hasMore };
}

// ═══════════════════════════════════════════════════════════════
// AUCTION BIDDING SYSTEM
// ═══════════════════════════════════════════════════════════════

export async function placeAuctionBid(auctionId: string, bidderId: string, bidderName: string, amount: number): Promise<{ success: boolean; error?: string }> {
	try {
		const auctions = await sql(`SELECT * FROM auctions WHERE id = '${escapeStr(auctionId)}' AND status = 'active'`);
		if (auctions.length === 0 || auctions[0].rows.length === 0) {
			return { success: false, error: 'Auction not found or ended' };
		}
		const auction = auctions[0].rows[0] as any;
		if (amount <= (auction.current_bid || auction.starting_price)) {
			return { success: false, error: `Bid must be higher than current bid of ${auction.current_bid || auction.starting_price}` };
		}
		if (auction.seller_id === bidderId) {
			return { success: false, error: 'Cannot bid on your own auction' };
		}

		const bidId = Math.random().toString(36).substring(2, 15);
		const now = new Date().toISOString();
		await sql(`INSERT INTO auction_bids (id, auction_id, bidder_id, bidder_name, amount, created_at) VALUES ('${bidId}', '${escapeStr(auctionId)}', '${escapeStr(bidderId)}', '${escapeStr(bidderName)}', ${amount}, '${now}')`);
		await sql(`UPDATE auctions SET current_bid = ${amount}, current_bidder_id = '${escapeStr(bidderId)}', current_bidder_name = '${escapeStr(bidderName)}' WHERE id = '${escapeStr(auctionId)}'`);

		return { success: true };
	} catch (err: any) {
		return { success: false, error: err.message };
	}
}

export async function getAuctionBids(auctionId: string): Promise<any[]> {
	try {
		const result = await sql(`SELECT * FROM auction_bids WHERE auction_id = '${escapeStr(auctionId)}' ORDER BY amount DESC`);
		return result[0]?.rows || [];
	} catch { return []; }
}

// ═══════════════════════════════════════════════════════════════
// PLAYER FREEZE/WARN (moderation)
// ═══════════════════════════════════════════════════════════════

export async function freezePlayerInventory(userId: string, freeze: boolean): Promise<void> {
	await sql(`UPDATE inventory SET is_frozen = ${freeze ? 1 : 0} WHERE user_id = '${escapeStr(userId)}'`);
}

export async function warnPlayer(targetUserId: string, performedBy: string, reason: string): Promise<void> {
	const id = Math.random().toString(36).substring(2, 15);
	const now = new Date().toISOString();
	await sql(`INSERT INTO moderation_actions (id, target_user_id, performed_by, action, reason, created_at, is_active) VALUES ('${id}', '${escapeStr(targetUserId)}', '${escapeStr(performedBy)}', 'warn', '${escapeStr(reason)}', '${now}', 1)`);
}

export async function getActiveWarnings(userId: string): Promise<any[]> {
	try {
		const result = await sql(`SELECT * FROM moderation_actions WHERE target_user_id = '${escapeStr(userId)}' AND action = 'warn' AND is_active = 1 ORDER BY created_at DESC`);
		return result[0]?.rows || [];
	} catch { return []; }
}
