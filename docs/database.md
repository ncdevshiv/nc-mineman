# SpacetimeDB Database

## Overview

SpacetimeDB v2.0.5 runs as an embedded standalone server within the project. It is fully self-contained in `Bin/SpacetimeDB/` and stores data in `data/spacetimedb/data/`.

## Binaries

| File | Size | Purpose |
|------|------|---------|
| `Bin/SpacetimeDB/spacetimedb-standalone.exe` | ~95MB | Standalone server process |
| `Bin/SpacetimeDB/spacetimedb-cli.exe` | ~32MB | CLI tool |

## Configuration

Environment variables:

```env
SPACETIMEDB_ENABLED="true"    # "false" to disable (uses JSON fallback)
SPACETIMEDB_PORT="3001"       # Must not conflict with Next.js (3000)
SPACETIMEDB_HOST="127.0.0.1"  # Bind address
```

Config file auto-generated at `data/spacetimedb/data/config.toml`:

```toml
[logs]
level = "info"

[websocket]
ping-interval = "15s"
idle-timeout = "30s"
```

## Schema

### `servers`
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Server UUID |
| name | TEXT | Display name |
| software | TEXT | paper/folia/velocity |
| version | TEXT | Minecraft version |
| ram | TEXT | Memory allocation (e.g. "2G") |
| cpu_limit | INT | CPU limit percentage |
| status | TEXT | stopped/starting/running |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### `players`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| server_id | TEXT FK | Server reference |
| name | TEXT | Player name |
| uuid | TEXT | Minecraft UUID |
| ip_address | TEXT | Last known IP |
| is_op | BOOL | Operator status |
| is_whitelisted | BOOL | Whitelist status |
| is_banned | BOOL | Ban status |
| ban_reason | TEXT | Ban reason |
| is_waitlisted | BOOL | Waitlist status |
| permission_level | INT | 0-4 permission level |
| first_seen | TEXT | First join timestamp |
| last_seen | TEXT | Last activity timestamp |
| total_playtime_seconds | INT | Cumulative playtime |
| current_session_start | TEXT | Active session start (NULL if offline) |
| is_online | BOOL | Currently online |
| notes | TEXT | Admin notes |

### `player_sessions`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| server_id | TEXT FK | Server reference |
| player_name | TEXT | Player name |
| ip_address | TEXT | IP used for session |
| joined_at | TEXT | Join timestamp |
| left_at | TEXT | Leave timestamp (NULL if active) |
| duration_seconds | INT | Session length |

### `player_ip_history`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| server_id | TEXT FK | Server reference |
| player_name | TEXT | Player name |
| ip_address | TEXT | IP address |
| seen_at | TEXT | When seen |

### `server_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| server_id | TEXT FK | Server reference |
| level | TEXT | info/warn/error |
| source | TEXT | server/player/manual |
| message | TEXT | Log message |
| timestamp | TEXT | ISO timestamp |

### `metrics`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| server_id | TEXT FK | Server reference |
| cpu | REAL | CPU usage % |
| ram | REAL | RAM usage MB |
| players | INT | Online player count |
| tps | REAL | Ticks per second |
| recorded_at | TEXT | ISO timestamp |

### `automation_rules`
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Rule UUID |
| server_id | TEXT FK | Server reference |
| name | TEXT | Rule name |
| trigger | TEXT | Trigger event |
| action | TEXT | Action type |
| action_payload | TEXT | Action data (JSON) |
| enabled | BOOL | Active status |
| cooldown_ms | INT | Cooldown between fires |

### `scheduled_tasks`
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Task UUID |
| server_id | TEXT FK | Server reference |
| name | TEXT | Task name |
| cron_expr | TEXT | Cron expression |
| action | TEXT | Action type |
| action_payload | TEXT | Action data |
| enabled | BOOL | Active status |

## HTTP API

SpacetimeDB exposes an HTTP API at `http://127.0.0.1:3001`:

- `GET /v1/ping` — Health check
- `POST /v1/database/{name}/sql` — Execute SQL query
- `GET /v1/database/{name}/schema` — Get schema

The app's `lib/spacetimedb-data.ts` wraps this API. You can also query directly:

```bash
curl -X POST http://127.0.0.1:3001/v1/database/minemanager/sql \
  -H "Content-Type: text/plain" \
  -d "SELECT * FROM players WHERE is_online = true"
```

## Data Lifecycle

1. **Server start** → `upsertServer()` saves config
2. **Player join** → `setPlayerOnline()` + `startSession()` + `insertLog()`
3. **Player leave** → `setPlayerOnline(false)` + `endSession()` + `insertLog()`
4. **Metrics tick** (every 3s) → `insertMetric()`
5. **RCON op/ban** → `setPlayerOp()` / `setPlayerBan()`
6. **Server stop** → `updateServerStatus('stopped')`

## Disabling SpacetimeDB

Set `SPACETIMEDB_ENABLED="false"` in `.env.local`. The app falls back to JSON file storage (`servers.json`). Player/session/IP data will not be persisted.
