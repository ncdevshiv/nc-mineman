import { spacetimeDB } from './spacetimedb';

const DB_NAME = 'minemanager';

interface SqlColumn { name: string; type: string }
interface SqlRow { [key: string]: unknown }
interface SqlResult { schema: { elements: SqlColumn[] }; rows: SqlRow[] }

async function sql(query: string): Promise<SqlResult[]> {
	const res = await fetch(`${spacetimeDB.baseUrl}/v1/database/${DB_NAME}/sql`, {
		method: 'POST',
		headers: { 'Content-Type': 'text/plain' },
		body: query,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`SpacetimeDB SQL error (${res.status}): ${text}`);
	}
	return res.json();
}

function escapeStr(v: string): string {
	return v.replace(/'/g, "''");
}

// ───────────────────────── Schema ─────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS servers (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	software TEXT NOT NULL,
	version TEXT NOT NULL,
	ram TEXT NOT NULL DEFAULT '2G',
	cpu_limit INT NOT NULL DEFAULT 100,
	status TEXT NOT NULL DEFAULT 'stopped',
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
	first_seen TEXT NOT NULL DEFAULT (datetime('now')),
	last_seen TEXT NOT NULL DEFAULT (datetime('now')),
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
	joined_at TEXT NOT NULL DEFAULT (datetime('now')),
	left_at TEXT DEFAULT NULL,
	duration_seconds INT NOT NULL DEFAULT 0,
	FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_ip_history (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	server_id TEXT NOT NULL,
	player_name TEXT NOT NULL,
	ip_address TEXT NOT NULL,
	seen_at TEXT NOT NULL DEFAULT (datetime('now')),
	FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_logs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	server_id TEXT NOT NULL,
	level TEXT NOT NULL DEFAULT 'info',
	source TEXT NOT NULL DEFAULT 'server',
	message TEXT NOT NULL,
	timestamp TEXT NOT NULL DEFAULT (datetime('now')),
	FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS metrics (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	server_id TEXT NOT NULL,
	cpu REAL NOT NULL DEFAULT 0,
	ram REAL NOT NULL DEFAULT 0,
	players INT NOT NULL DEFAULT 0,
	tps REAL NOT NULL DEFAULT 20,
	recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
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
`;

// ───────────────────────── Init ─────────────────────────

export async function initDatabase(): Promise<boolean> {
	try {
		await sql(SCHEMA_SQL);
		console.log('[SpacetimeDB Data] Schema initialized');
		return true;
	} catch (err: any) {
		console.error('[SpacetimeDB Data] Schema init failed:', err.message);
		return false;
	}
}

export async function getDbStatus(): Promise<{ exists: boolean; tables: string[] }> {
	try {
		const results = await sql("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
		if (results.length > 0) {
			return { exists: true, tables: results[0].rows.map((r) => String(r.name)) };
		}
	} catch {}
	return { exists: false, tables: [] };
}

// ───────────────────────── Servers ─────────────────────────

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
	} catch {}
	return [];
}

export async function getServer(id: string): Promise<ServerRecord | null> {
	try {
		const r = await sql(`SELECT * FROM servers WHERE id='${escapeStr(id)}'`);
		if (r.length > 0 && r[0].rows.length > 0) return r[0].rows[0] as unknown as ServerRecord;
	} catch {}
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

// ───────────────────────── Players ─────────────────────────

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
	} catch {}
	return [];
}

export async function getOnlinePlayers(serverId: string): Promise<PlayerRecord[]> {
	try {
		const r = await sql(`SELECT * FROM players WHERE server_id='${escapeStr(serverId)}' AND is_online=true ORDER BY name`);
		if (r.length > 0) return r[0].rows as unknown as PlayerRecord[];
	} catch {}
	return [];
}

export async function clearPlayers(serverId: string) {
	await sql(`DELETE FROM player_ip_history WHERE server_id='${escapeStr(serverId)}'`);
	await sql(`DELETE FROM player_sessions WHERE server_id='${escapeStr(serverId)}'`);
	await sql(`DELETE FROM players WHERE server_id='${escapeStr(serverId)}'`);
}

// ───────────────────────── Player Sessions ─────────────────────────

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
	} catch {}
	return [];
}

// ───────────────────────── Player IP History ─────────────────────────

export interface PlayerIpRecord {
	id: number; server_id: string; player_name: string;
	ip_address: string; seen_at: string;
}

export async function getPlayerIpHistory(serverId: string, playerName: string): Promise<PlayerIpRecord[]> {
	try {
		const r = await sql(`SELECT * FROM player_ip_history WHERE server_id='${escapeStr(serverId)}' AND player_name='${escapeStr(playerName)}' ORDER BY seen_at DESC`);
		if (r.length > 0) return r[0].rows as unknown as PlayerIpRecord[];
	} catch {}
	return [];
}

// ───────────────────────── Server Logs ─────────────────────────

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
	} catch {}
	return [];
}

export async function getLogCount(serverId: string, opts?: { level?: string; search?: string }): Promise<number> {
	try {
		let where = `WHERE server_id='${escapeStr(serverId)}'`;
		if (opts?.level && opts.level !== 'all') where += ` AND level='${escapeStr(opts.level)}'`;
		if (opts?.search) where += ` AND message LIKE '%${escapeStr(opts.search)}%'`;
		const r = await sql(`SELECT COUNT(*) as cnt FROM server_logs ${where}`);
		if (r.length > 0 && r[0].rows.length > 0) return Number(r[0].rows[0].cnt);
	} catch {}
	return 0;
}

export async function clearLogs(serverId: string) {
	await sql(`DELETE FROM server_logs WHERE server_id='${escapeStr(serverId)}'`);
}

// ───────────────────────── Metrics ─────────────────────────

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
	} catch {}
	return [];
}

export async function pruneMetrics(serverId: string, keep: number = 2000) {
	await sql(`DELETE FROM metrics WHERE server_id='${escapeStr(serverId)}' AND id NOT IN (SELECT id FROM metrics WHERE server_id='${escapeStr(serverId)}' ORDER BY recorded_at DESC LIMIT ${keep})`);
}

export async function clearMetrics(serverId: string) {
	await sql(`DELETE FROM metrics WHERE server_id='${escapeStr(serverId)}'`);
}

// ───────────────────────── Automation Rules ─────────────────────────

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
	} catch {}
	return [];
}

export async function deleteAutomationRule(id: string) {
	await sql(`DELETE FROM automation_rules WHERE id='${escapeStr(id)}'`);
}

// ───────────────────────── Scheduled Tasks ─────────────────────────

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
	} catch {}
	return [];
}

export async function deleteScheduledTask(id: string) {
	await sql(`DELETE FROM scheduled_tasks WHERE id='${escapeStr(id)}'`);
}

// ───────────────────────── Aggregate / Stats ─────────────────────────

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
	} catch {
		return { total: 0, online: 0, banned: 0, ops: 0, whitelisted: 0, waitlisted: 0 };
	}
}
