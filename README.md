<div align="center">
  <h1>MineServer2</h1>
  <p>Complete Minecraft server management with embedded SpacetimeDB</p>
</div>

MineServer2 is a self-contained Minecraft server management dashboard. Create, monitor, and manage multiple Minecraft servers from a single web interface with real-time metrics, player tracking, and persistent data via an embedded SpacetimeDB database.

## Features

- **Multi-Server Management** — Create and manage Paper, Folia, and Velocity servers from one dashboard
- **Real-time Monitoring** — Live CPU, RAM, TPS, and player count charts
- **Player Management** — Track OP status, bans, whitelists, waitlists, IP history, playtime, and session data
- **Embedded Database** — SpacetimeDB v2.0.5 bundled as a self-contained binary; no external database needed
- **Auto-Start** — Database and server processes start automatically on launch
- **Console** — Execute RCON commands directly from the web UI
- **File Manager** — Upload, download, and edit server files with Monaco editor
- **Backups** — Automated scheduled backups with zip compression
- **Automation** — Rule-based triggers (player join/leave/kick) with cooldowns
- **Network Tunneling** — FRP tunnel support for exposing local servers
- **Fully Portable** — All binaries (SpacetimeDB, FRP) bundled in `Bin/`; clone and run

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Charts | Recharts |
| Icons | Lucide React |
| State | Zustand (persisted to localStorage) |
| Data Fetching | SWR + Server-Sent Events |
| Database | SpacetimeDB v2.0.5 (embedded standalone) |
| Auth | NextAuth.js |
| Runtime | Bun |
| Tunneling | FRP (bundled) |

## Quick Start

```bash
# Clone
git clone https://github.com/ncdevshiv/nc-mineman.git
cd MineServer2

# Install
bun install

# Configure
cp .env.example .env.local

# Run (auto-starts SpacetimeDB + Next.js)
bun run dev
```

Open `http://localhost:3000`. SpacetimeDB starts automatically on port 3001.

## Project Structure

```
MineServer2/
├── Bin/
│   ├── SpacetimeDB/          # Embedded database binaries
│   │   ├── spacetimedb-cli.exe
│   │   └── spacetimedb-standalone.exe
│   └── FRP/                  # Tunnel binaries
│       ├── frpc.exe
│       └── frps.exe
├── app/
│   ├── api/
│   │   ├── servers/          # Server CRUD + actions
│   │   ├── spacetimedb/      # Database management API
│   │   ├── network/          # FRP tunnel API
│   │   └── auth/             # NextAuth routes
│   └── page.tsx              # SPA entry point
├── components/
│   ├── sidebar.tsx           # Navigation sidebar
│   ├── server-list.tsx       # Server grid
│   ├── dashboard.tsx         # Server dashboard (metrics, controls)
│   ├── console.tsx           # RCON console
│   ├── players.tsx           # Player management (RCON)
│   ├── files.tsx             # File manager
│   ├── automation.tsx        # Automation rules
│   ├── backups.tsx           # Backup manager
│   ├── settings.tsx          # Server settings
│   ├── network-wizard.tsx    # FRP tunnel setup
│   ├── spacetime-dashboard.tsx  # SpacetimeDB overview
│   ├── spacetime-servers.tsx    # DB server records CRUD
│   ├── spacetime-players.tsx    # DB player management
│   ├── spacetime-logs.tsx       # DB log viewer
│   └── spacetime-metrics.tsx    # DB metrics charts
├── lib/
│   ├── server-manager.ts     # Minecraft server process manager
│   ├── spacetimedb.ts        # SpacetimeDB process manager
│   ├── spacetimedb-data.ts   # SpacetimeDB schema + CRUD layer
│   ├── rcon.ts               # RCON connection pool
│   ├── store.ts              # Zustand state store
│   └── papermc.ts            # PaperMC API client
├── scripts/
│   ├── dev.ts                # Dev start (auto-starts SpacetimeDB)
│   ├── start.ts              # Full fresh start
│   ├── start-dev.ts          # Dev fresh start
│   └── start-server.ts       # Production start
├── plugins/                  # Server plugins (Serverstats JARs)
├── tunnel/                   # FRP tunnel configs
└── data/spacetimedb/         # SpacetimeDB data directory (auto-created)
```

## Database Schema

SpacetimeDB runs as an embedded standalone server on port 3001. Eight tables:

| Table | Purpose |
|-------|---------|
| `servers` | Server configs (name, software, version, RAM, status) |
| `players` | Player records (OP, ban, whitelist, waitlist, IP, playtime, notes) |
| `player_sessions` | Join/leave timestamps with duration |
| `player_ip_history` | IP address tracking per player |
| `server_logs` | Persistent log storage with level filtering |
| `metrics` | CPU, RAM, TPS, player count time-series |
| `automation_rules` | Trigger/action rules with cooldowns |
| `scheduled_tasks` | Cron-based scheduled actions |

## Dashboard Tabs

### Server View (per-server sidebar tabs)
- **Dashboard** — Status, start/stop, live metrics, quick command
- **Console** — Real-time server log stream + command input
- **Players** — OP/whitelist/ban management via RCON
- **File Manager** — Browse, edit, upload, download files
- **Software** — Download/update server JARs from PaperMC
- **Plugins** — Manage server plugins
- **Backups** — Create, download, restore backups
- **Automation** — Rule-based automation (triggers + actions)
- **Settings** — Server name, RAM, CPU limit, properties

### Global View (sidebar top)
- **Servers** — Server list grid with create/delete
- **Network** — FRP tunnel configuration
- **Database** — SpacetimeDB management dashboard
  - Overview — Status, version, schema, server list
  - Servers — CRUD table with add/edit/delete/clear
  - Players — Full player management with filters, search, IP history, notes, sessions
  - Logs — Log viewer with level filter, search, pagination
  - Metrics — CPU/RAM/TPS/Players charts with configurable data points

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Dev server (auto-starts SpacetimeDB + Next.js) |
| `bun run build` | Production build |
| `bun run start` | Production server (auto-starts SpacetimeDB) |
| `bun run start:fresh` | Kill all processes, clean build, start fresh |
| `bun run start:dev:fresh` | Dev fresh start with dependency install |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript type check |
| `bun run clean` | Clean Next.js cache |

## Environment Variables

```env
APP_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
GEMINI_API_KEY="your-gemini-api-key"      # Optional: AI features

# SpacetimeDB
SPACETIMEDB_ENABLED="true"                 # Set "false" to disable
SPACETIMEDB_PORT="3001"                    # Must differ from Next.js port
SPACETIMEDB_HOST="127.0.0.1"
```

## Architecture

```
Browser ──→ Next.js (port 3000)
               │
               ├── API Routes ──→ Minecraft servers (RCON + process spawn)
               │
               └── API Routes ──→ SpacetimeDB (port 3001, HTTP API)
                                        │
                                        └── Embedded standalone binary
                                            (auto-started, auto-initialized)
```

SpacetimeDB auto-starts on first API call via `ensureRunning()`, which polls `/v1/ping` until HTTP is ready, then initializes the schema. The `bun run dev` script also pre-starts it as a background process.

## License

MIT
