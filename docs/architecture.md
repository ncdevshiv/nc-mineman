# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser                           │
│              http://localhost:3000                   │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│                Next.js App (port 3000)               │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Components  │  │  API Routes  │  │  SSE Stream │  │
│  │  (React 19)  │  │  (Next.js)   │  │  (Real-time)│  │
│  └─────────────┘  └──────┬───────┘  └────────────┘  │
│                          │                           │
│           ┌──────────────┼──────────────┐            │
│           ▼                             ▼            │
│  ┌────────────────┐          ┌──────────────────┐    │
│  │ server-manager │          │   spacetimedb.ts  │    │
│  │ (process spawn │          │  (process manager │    │
│  │  + RCON pool)  │          │   + HTTP client)  │    │
│  └────────┬───────┘          └────────┬─────────┘    │
│           │                           │              │
└───────────┼───────────────────────────┼──────────────┘
            │                           │
    ┌───────▼───────┐          ┌────────▼─────────┐
    │   Minecraft   │          │   SpacetimeDB    │
    │   Server(s)   │          │   Standalone     │
    │   (Java)      │          │   (port 3001)    │
    └───────────────┘          └──────────────────┘
```

## Data Flow

### Server Management
1. Browser sends start/stop/command request to `/api/servers/[id]/...`
2. `server-manager.ts` spawns Java process or sends RCON command
3. SSE stream (`/api/servers/[id]/logs`) pushes logs, status, metrics to browser
4. Zustand store updates components reactively

### SpacetimeDB Persistence
1. Server events (logs, player join/leave, metrics) trigger `stdb.insertLog()`, `stdb.setPlayerOnline()`, `stdb.insertMetric()`
2. `spacetimedb-data.ts` sends SQL queries via HTTP POST to `http://127.0.0.1:3001/v1/database/minemanager/sql`
3. Dashboard UI reads from `/api/spacetimedb/*` which queries SpacetimeDB

### Auto-Start Sequence
1. `bun run dev` → `scripts/dev.ts` spawns SpacetimeDB binary as background process
2. Browser loads → `page.tsx` fires `fetch('/api/spacetimedb')`
3. `GET /api/spacetimedb` calls `spacetimeDB.ensureRunning()`
4. `ensureRunning()` pings `/v1/ping` in a loop until HTTP is ready
5. On first successful ping, `initDatabase()` creates all 8 tables

## Key Modules

### `lib/server-manager.ts`
- `NodeManager` — singleton managing all server instances
- `ServerInstance` — represents a single Minecraft server process
- Handles spawn, stop, RCON, metrics collection, player tracking, backups, automation
- Writes data to SpacetimeDB when `SPACETIMEDB_ENABLED !== 'false'`

### `lib/spacetimedb.ts`
- Module-level state (not a class) for webpack compatibility
- `start()` — spawns `spacetimedb-standalone.exe`
- `stop()` — kills process via `taskkill` (Windows) or `SIGTERM`
- `ping()` — HTTP GET to `/v1/ping`
- `waitForReady(timeoutMs)` — polls ping until OK
- `ensureRunning()` — one-shot auto-start with schema init

### `lib/spacetimedb-data.ts`
- `sql(query)` — POST to SpacetimeDB SQL endpoint
- Full CRUD for all 8 tables
- `initDatabase()` — creates schema if not exists
- Aggregation functions like `getPlayerStats()`

### `lib/rcon.ts`
- RCON connection pool per server
- Reuses connections, handles disconnects

### `lib/store.ts`
- Zustand store with localStorage persistence
- Navigation state: `globalTab`, `activeServerId`, `activeTab`
- Real-time state: `logs`, `metrics`, `status`
