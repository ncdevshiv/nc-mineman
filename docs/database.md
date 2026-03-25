# SQLite Database

## Overview

NC-Mineman uses SQLite via Bun's built-in `bun:sqlite` module for all data storage. This is an embedded database that requires no external server - perfect for self-hosted deployments.

## Database Location

- **File**: `data/minemanager.db`
- **Location**: Relative to project root

## Why SQLite?

- **Zero Configuration** - No server to install or manage
- **Portable** - Single file database, easy to backup
- **Fast** - Optimized for embedded use cases
- **Reliable** - ACID compliant, WAL mode enabled
- **100k Scale** - Batch operations, cursor pagination, composite indexes, in-memory cache

## Performance Optimizations

### WAL Mode
Write-Ahead Logging enables concurrent reads while writes are serialized. Visible as `.db-shm` and `.db-wal` files.

### PRAGMA Settings
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;      -- 64MB page cache
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;      -- 5s wait on lock
PRAGMA mmap_size = 268435456;    -- 256MB memory-mapped I/O
PRAGMA temp_store = MEMORY;      -- Temp tables in RAM
```

### Batch Operations
For 100k+ player scale, use batch operations instead of individual queries:
- `batchUpsertPlayers()` — Single transaction for 1000+ player records
- `batchSetPlayersOnline()` — Bulk online/offline status updates
- `batchInsertMetrics()` — High-frequency metric ingestion
- `batchInsertLogs()` — High-throughput log storage

### Cursor Pagination
For large player lists, use cursor-based pagination instead of OFFSET:
- `getPlayersPaginated({ cursor, limit })` — O(1) seek vs O(n) OFFSET
- `getUsersPaginated({ cursor, limit })` — Same for user lists

### In-Memory Cache
Hot data is cached in memory to reduce database load:
- Server stats: 3s TTL
- Player data: 5s TTL
- Store items: 10s TTL

Import from `lib/cache.ts`:
```typescript
import { cache, CACHE_KEYS } from '@/lib/cache';
const data = await cache.get(CACHE_KEYS.serverStats(), fetcher, 5000);
```

## Configuration

Environment variables (optional):

```env
# No special config needed - uses default settings
# Database is created automatically on first run
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

### `site_users` (User Management)
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Discord user ID |
| email | TEXT | User email |
| mc_username | TEXT | Linked Minecraft username |
| discord_username | TEXT | Discord username (username#discriminator) |
| phone_number | TEXT | User phone number |
| roles | TEXT | JSON array of roles |
| site_name | TEXT | Display name |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### `tickets` & `ticket_messages`
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Ticket UUID |
| user_id | TEXT FK | User reference |
| title | TEXT | Ticket title |
| status | TEXT | open/in-progress/closed |
| assigned_to | TEXT | Admin assigned |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### `store_items` (In-Game Store)
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Item UUID |
| name | TEXT | Item name |
| price | REAL | Price |
| category | TEXT | Item category |
| display_image | TEXT | Image URL |
| is_active | BOOL | Active status |
| metadata | TEXT | JSON config |

### `inventory` (Player Inventory)
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Item UUID |
| user_id | TEXT FK | Player reference |
| item_name | TEXT | Item name |
| item_type | TEXT | Item type |
| quantity | INT | Quantity |
| metadata | TEXT | JSON data |
| acquired_from | TEXT | Source |
| acquired_at | TEXT | ISO timestamp |
| is_hidden | BOOL | Hidden status |
| is_frozen | BOOL | Frozen status |

### Additional Tables
- `friends` - Friend relationships
- `follows` - Follow system
- `social_requests` - Friend/follow requests
- `trades` - Trade listings
- `purchases` - Purchase history
- `bans` - Ban records
- `reports` - Player reports
- `moderation_actions` - Moderation log
- `auctions` - Auction listings
- `notifications` - User notifications
- `site_config` - Site configuration
- `server_logs` - Server logs
- `metrics` - Performance metrics
- `automation_rules` - Automation rules
- `scheduled_tasks` - Scheduled tasks

## Data Access

The database is accessed via `lib/spacetimedb-data.ts`:

```typescript
import { sql, escapeStr } from '@/lib/spacetimedb-data';

// Direct SQL access
const result = await sql('SELECT * FROM servers WHERE status = "running"');
```

## Data Lifecycle

1. **Server start** → `upsertServer()` saves config
2. **Player join** → `setPlayerOnline()` + `startSession()` + `insertLog()`
3. **Player leave** → `setPlayerOnline(false)` + `endSession()` + `insertLog()`
4. **Metrics tick** (every 3s) → `insertMetric()`
5. **RCON op/ban** → `setPlayerOp()` / `setPlayerBan()`
6. **Server stop** → `updateServerStatus('stopped')`

## Backup

Simply copy the database file:

```bash
# Backup
cp data/minemanager.db backups/minemanager-$(date +%Y%m%d).db

# Restore
cp backups/minemanager-20240101.db data/minemanager.db
```

## Maintenance

The database runs automatic cleanup:
- Expired bans removed
- Expired moderation actions deactivated
- Old notifications deleted (30 days)
- Old player sessions cleaned (90 days)
- Metrics pruned (keeps 2000 most recent per server)
- Server logs pruned (keeps 10000 most recent per server)