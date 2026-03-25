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
│  │ server-manager │          │  spacetimedb-data │    │
│  │ (process spawn │          │  (SQLite via      │    │
│  │  + RCON pool)  │          │   bun:sqlite)     │    │
│  └────────┬───────┘          └────────┬─────────┘    │
│           │                           │              │
└───────────┼───────────────────────────┼──────────────┘
            │                           │
    ┌───────▼───────┐          ┌────────▼─────────┐
    │   Minecraft   │          │   SQLite DB      │
    │   Server(s)   │          │   (embedded)     │
    │   (Java)      │          │   data/*.db      │
    └───────────────┘          └──────────────────┘
```

## Data Flow

### Server Management
1. Browser sends start/stop/command request to `/api/servers/[id]/...`
2. `server-manager.ts` spawns Java process or sends RCON command
3. SSE stream (`/api/servers/[id]/logs`) pushes logs, status, metrics to browser
4. Zustand store updates components reactively

### SQLite Persistence
1. Server events (logs, player join/leave, metrics) trigger `stdb.insertLog()`, `stdb.setPlayerOnline()`, `stdb.insertMetric()`
2. `spacetimedb-data.ts` executes SQL directly via `bun:sqlite` (embedded SQLite, no external server)
3. Dashboard UI reads from `/api/spacetimedb/*` which queries the local SQLite database
4. Real-time updates via SSE at `/api/realtime` (polling-based, configurable interval)

### Plugin Integration (ServerStar)
1. Minecraft plugin runs HTTP API on port 8088 and WebSocket on port 8089
2. Dashboard proxies requests through `/api/serverstats/proxy` to the plugin
3. WebSocket provides real-time player updates, activities, and server stats

### Auto-Start Sequence
1. `bun run start` → `scripts/start-server.ts` initializes SQLite schema, then starts Next.js
2. Database file at `data/minemanager.db` is created automatically on first run
3. WAL mode enabled for concurrent read/write performance

## Key Modules

### `lib/server-manager.ts`
- `NodeManager` — singleton managing all server instances
- `ServerInstance` — represents a single Minecraft server process
- Handles spawn, stop, RCON, metrics collection, player tracking, backups, automation
- Writes data to SQLite database for persistence

### `lib/spacetimedb-data.ts`
- `sql(query)` — Executes SQL directly via `bun:sqlite` (embedded SQLite)
- Full CRUD for all 20+ tables (servers, players, users, tickets, trades, etc.)
- `initDatabase()` — creates schema if not exists
- WAL mode enabled, retry logic for concurrent writes
- Aggregation functions like `getPlayerStats()`

### `lib/rcon.ts`
- RCON connection pool per server
- Reuses connections, handles disconnects

### `lib/store.ts`
- Zustand store with localStorage persistence
- Navigation state: `globalTab`, `activeServerId`, `activeTab`
- Real-time state: `logs`, `metrics`, `status`

### `lib/rate-limit.ts`
- In-memory rate limiter per IP address
- Configurable windows for API, auth, and write endpoints
- Returns 429 with Retry-After headers when exceeded
