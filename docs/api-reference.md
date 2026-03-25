# API Reference

## Server Management

### `GET /api/servers`
List all servers.

**Response:** `[{ id, name, software, version, ram, cpuLimit, status }]`

### `POST /api/servers`
Create a new server.

**Body:** `{ name, software, version }`

**Response:** `{ success, server: { id, name, ... } }`

### `GET /api/servers/[id]`
Get server details.

### `DELETE /api/servers/[id]`
Delete a server and all its data.

### `POST /api/servers/[id]/start`
Start the server.

### `POST /api/servers/[id]/stop`
Stop the server.

### `POST /api/servers/[id]/kill`
Force-kill the server process.

### `POST /api/servers/[id]/command`
Execute an RCON command.

**Body:** `{ command }`

### `GET /api/servers/[id]/logs`
Server-Sent Events stream. Events:
- `init` — { status, logs, metrics }
- `log` — { msg }
- `status` — { status }
- `metrics` — { metric }

### `GET /api/servers/[id]/players`
Get player data (ops, whitelist, bans, activity).

### `POST /api/servers/[id]/players`
Execute player action via RCON.

**Body:** `{ action, player }` where action is `op`, `deop`, `ban`, `pardon`, `whitelist add`, `whitelist remove`, `kick`

Also persists to SQLite database.

### `GET /api/servers/[id]/files`
List files in server directory.

### `POST /api/servers/[id]/files`
Upload/edit files.

### `GET /api/servers/[id]/backups`
List backups.

### `POST /api/servers/[id]/backups`
Create a backup.

### `GET /api/servers/[id]/automation`
Get automation rules.

### `POST /api/servers/[id]/automation`
Create/update automation rule.

### `GET /api/servers/[id]/settings`
Get server properties.

### `POST /api/servers/[id]/settings`
Update server settings.

## Database Management

### `GET /api/spacetimedb`
Get database status and table list.

**Response:** `{ running, type, engine, database: { exists, tables, path, fileExists } }`

### `POST /api/spacetimedb`
Re-initialize database schema.

### `DELETE /api/spacetimedb`
No-op for embedded SQLite (database is always available).

## Database Data (Player & Server Records)

### `GET /api/spacetimedb/servers`
List all server records from database.

### `POST /api/spacetimedb/servers`
Add/update server record.

**Body:** `{ id, name, software, version, ram, cpu_limit, status }`

Set `{ action: "clear" }` to delete all server records.

### `DELETE /api/spacetimedb/servers?id={id}`
Delete a server record and all related data.

### `GET /api/spacetimedb/players?serverId={id}`
Get all players for a server.

**Query params:** `action=stats` | `action=ipHistory&name={player}` | `action=sessions`

### `POST /api/spacetimedb/players`
Player CRUD operations.

**Body:** `{ serverId, name, action }` where action is:
- `add` — Add player record
- `ban` / `unban` — Toggle ban
- `op` / `deop` — Toggle operator
- `waitlist` / `unwaitlist` — Toggle waitlist
- `whitelist` / `unwhitelist` — Toggle whitelist
- `notes` — Update notes (`{ notes: "..." }`)
- `delete` — Delete player record
- `clear` — Delete all players for server

### `GET /api/spacetimedb/logs?serverId={id}`
Get logs with filtering.

**Query params:** `level=info|warn|error|all`, `search=`, `limit=200`, `offset=0`

**Response:** `{ logs: [...], total }`

### `POST /api/spacetimedb/logs`
Manage logs.

**Body:** `{ serverId, action }` where action is:
- `clear` — Delete all logs for server
- `add` — Add log entry (`{ level, source, message }`)

### `GET /api/spacetimedb/metrics?serverId={id}`
Get metrics data.

**Query params:** `limit=60`

### `POST /api/spacetimedb/metrics`
**Body:** `{ action: "clear", serverId }`

## Network (FRP)

### `GET /api/network`
Get tunnel status and config.

### `POST /api/network`
Start tunnel.

### `DELETE /api/network`
Stop tunnel.

### `GET /api/network/logs`
Tunnel event stream (SSE).

## Auth

### `POST /api/auth/[...nextauth]`
NextAuth.js authentication endpoints.
