<div align="center">
<h1>NC-Mineman</h1>
<p>Self-Hosted Minecraft Server Management Dashboard</p>
<p><strong>100% Self-Contained • Open Source • Production Ready</strong></p>
</div>

---

## What is NC-Mineman?

NC-Mineman is a complete Minecraft server management solution that's **fully self-contained and portable**. It uses an embedded SQLite database (bun:sqlite) - no external database required. Built to handle 100k+ players with real-time updates.

### Features

- **Multi-Server Management** — Create and manage Paper, Folia, Purpur, and Velocity servers
- **Real-time Monitoring** — Live CPU, RAM, TPS, and player count charts via WebSocket + SSE
- **Player Management** — OP status, bans, whitelists, IP history, playtime tracking, freeze, warn
- **Embedded Database** — SQLite with bun:sqlite (built into Bun); no external database needed
- **100k Player Scale** — Batch operations, cursor pagination, in-memory caching, composite indexes
- **File Manager** — Upload, download, edit server files with Monaco editor
- **Console Access** — Execute RCON commands from web UI
- **Backups** — Automated scheduled backups with zip compression
- **Network Tunneling** — Cloudflare Tunnel for exposing local servers
- **Store & Payments** — Polar.sh integration for purchases
- **Social Features** — Friends, follows, player search, reports
- **Trading** — Trade hub, auctions with bidding system
- **Tickets** — Support ticket system with assignment and resolution
- **User Profiles** — Users can edit their profile, phone number, Discord username
- **Role-Based Access** — Owner, Admin, God, Helper, Member roles
- **Security** — Rate limiting, suspicious path blocking, hardened headers (COOP/CORP/COEP)

---

## Quick Start (3 Steps)

### Windows
```powershell
# 1. Run setup (installs Bun, Java, dependencies)
setup.bat

# 2. Configure Discord OAuth and Polar.sh (see below)
notepad .env.local

# 3. Start server
start-dev.bat    # Development
start.bat         # Production
```

### Linux/Mac
```bash
# 1. Install Bun
curl -fsSL https://bun.sh/install | bash

# 2. Install dependencies
bun install

# 3. Configure and start
cp .env.example .env.local
bun run dev
```

Visit: **http://localhost:3000**

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `setup.bat` | Complete setup - installs Bun, Java, packages, firewall rules |
| `start-dev.bat` | Development server with hot reload + Cloudflare tunnel |
| `start.bat` | Production build and server + Cloudflare tunnel |
| `bun run start` | Production server (Bun) |
| `bun run dev` | Development server |
| `bun run db:init` | Initialize/reset database schema |

---

## Authentication Setup (Discord OAuth)

### Step 1: Create Discord Application

1. Go to **https://discord.com/developers/applications**
2. Create a new application
3. Go to "OAuth2" section
4. Add redirect URI: `http://localhost:3000/api/auth/callback`
5. Copy Client ID and Client Secret

### Step 2: Update .env.local

```env
DISCORD_CLIENT_ID="your-client-id"
DISCORD_CLIENT_SECRET="your-client-secret"
DISCORD_REDIRECT_URI="http://localhost:3000/api/auth/callback"
JWT_SECRET="<64-char-random-string>"
APP_URL="http://localhost:3000"
ADMIN_USERNAMES="your-discord-username"
```

### Step 3: Get Your Discord User ID

Enable Developer Mode in Discord, right-click your username, and copy the ID. Add this to ADMIN_USERNAMES to get admin access.

---

## Payment Setup (Polar.sh)

### Step 1: Create Polar.sh Account

1. Go to **https://polar.sh**
2. Create an organization
3. Create an access token

### Step 2: Add to .env.local

```env
POLAR_ACCESS_TOKEN="your-polar-access-token"
POLAR_WEBHOOK_SECRET="your-webhook-secret"
POLAR_SERVER="sandbox"  # Change to "production" for live
```

### Step 3: Configure Products

1. Create products in Polar.sh dashboard
2. Add store items via Admin > Store Editor
3. Link Polar product IDs to store items

---

## Plugin Integration (ServerStar)

The ServerStar Minecraft plugin provides live server data. Install it on your Minecraft server:

1. Build the plugin: `cd plugins/Serverstats && ./gradlew shadowJar`
2. Copy `build/libs/ServerStar-*.jar` to your Minecraft server's `plugins/` folder
3. Restart the Minecraft server
4. The plugin starts HTTP API on port 8088 and WebSocket on port 8089

### Plugin Capabilities

| Feature | API Endpoint | Status |
|---------|-------------|--------|
| Player list | `GET /api/players` | Used |
| Player inventory | `GET /api/inventory` | Used |
| Inventory transfer | `POST /api/inventory` | Used |
| Ban/Unban | `POST /api/moderation` | Used |
| Kick | `POST /api/moderation` | Used |
| Freeze | `POST /api/moderation` | Used |
| Warn | `POST /api/moderation` | Used |
| Player search | `GET /api/search` | Used |
| Friend requests | `POST /api/social` | Used |
| Follow player | `POST /api/social` | Used |
| Submit report | `POST /api/social` | Used |
| Create auction | `POST /api/trading` | Used |
| Bid on auction | `POST /api/auctions/bid` | Used |
| Admin bans | `GET /api/admin/bans` | Used |
| Admin reports | `GET /api/admin/reports` | Used |
| WebSocket real-time | `ws://localhost:8089` | Used |

---

## Architecture

```
Browser (port 3000)
    │
    ▼
Next.js App ──── SQLite (bun:sqlite, embedded)
    │                     │
    ├─ API Routes         ├─ 20+ tables
    ├─ SSE Realtime       ├─ WAL mode
    ├─ In-memory Cache    ├─ Batch operations
    │                     └─ Cursor pagination
    │
    ├─ Proxy ──── Minecraft Plugin (port 8088)
    │                     │
    ├─ WebSocket ── Plugin WS (port 8089)
    │
    └─ Auth ──── Discord OAuth
                  │
                  └─ Polar.sh (payments)
```

---

## Project Structure

```
nc-mineman/
├── start.bat              # Production launcher (Windows)
├── start-dev.bat          # Development launcher (Windows)
├── setup.bat              # Full setup installer
├── Caddyfile              # Reverse proxy config
│
├── app/                   # Next.js 15 routes
│   ├── (public)/          # Public pages (home, store, status, wiki, etc.)
│   ├── (admin)/           # Admin panel (servers, roles, branding, store editor)
│   └── api/               # 60+ API routes
│       ├── auth/          # Discord OAuth authentication
│       ├── servers/       # Server management (CRUD, start/stop, console, backups)
│       ├── users/         # User management (friends, follows, search, roles, ban)
│       ├── store/         # Store (items, purchases)
│       ├── checkout/      # Polar.sh checkout
│       ├── webhooks/      # Polar.sh webhooks
│       ├── realtime/      # SSE real-time events
│       └── serverstats/   # Plugin proxy (players, moderation, inventory, trading)
│
├── components/            # React components (layout, UI, site)
├── hooks/                 # React hooks (useAuth, useServerStats, useWebSocket)
├── lib/                   # Core libraries
│   ├── auth.ts            # Session management & Discord OAuth
│   ├── session.ts         # JWT token handling
│   ├── db-frontend.ts     # User/Store/Tickets database operations
│   ├── spacetimedb-data.ts # SQLite database (bun:sqlite) - schema, CRUD, batch ops
│   ├── server-manager.ts  # Minecraft process manager
│   ├── cache.ts           # In-memory cache layer
│   ├── events.ts          # Event bus for real-time updates
│   ├── rate-limit.ts      # Rate limiting per IP
│   ├── realtime.ts        # SSE client helper
│   ├── polar.ts           # Polar.sh client
│   └── site.config.ts     # Site configuration
│
├── plugins/Serverstats/   # Minecraft plugin (Java/Gradle)
├── scripts/               # Build & start scripts
├── docs/                  # Documentation
├── wiki/                  # User wiki
└── data/                  # SQLite database (auto-created)
```

---

## Security

| Layer | Protection |
|-------|-----------|
| Rate Limiting | 100 req/min API, 10 req/min auth, configurable per endpoint |
| Path Blocking | `.env`, `.git`, `wp-admin`, `phpmyadmin` return 404 |
| Headers | HSTS, COOP, CORP, COEP, X-Frame-Options DENY, nosniff |
| Auth | Discord OAuth2 with JWT sessions |
| API | All endpoints require auth (except store browsing, homepage) |
| Admin | Role-based (owner/admin/god/helper/member) |
| RSC | No CORS leakage on auth redirects |

---

## Ports Used

| Port | Service | External |
|------|---------|----------|
| 3000 | Web App | Via Caddy/Tunnel |
| 8088 | MC Plugin API | No (internal) |
| 8089 | MC Plugin WebSocket | No (internal) |
| 25565 | Minecraft | Yes |
| 25575 | RCON | No |

---

## Environment Variables

### Required
```env
APP_URL="https://your-domain.com"
JWT_SECRET="<64-char-random>"
DISCORD_CLIENT_ID="your-client-id"
DISCORD_CLIENT_SECRET="your-client-secret"
DISCORD_REDIRECT_URI="https://your-domain.com/api/auth/callback"
ADMIN_USERNAMES="username1,username2"
```

### Payments (Polar.sh)
```env
POLAR_ACCESS_TOKEN="your-polar-token"
POLAR_WEBHOOK_SECRET="your-webhook-secret"
POLAR_SERVER="sandbox"
```

### Plugin Integration
```env
SERVER_STATS_PORT="8088"
WEBSOCKET_PORT="8089"
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Charts | Recharts |
| State | Zustand + SWR |
| Database | SQLite (bun:sqlite) — WAL mode, batch ops, cursor pagination |
| Auth | Discord OAuth2 (jose JWT) |
| Payments | Polar.sh |
| Real-time | SSE + WebSocket relay |
| Cache | In-memory TTL cache |
| Rate Limiting | Per-IP in-memory |
| Runtime | Bun |
| Proxy | Caddy / Cloudflare Tunnel |

---

## Documentation

- **Quick Start**: `docs/QUICK-START.md`
- **DNS/Network**: `docs/DNS-NETWORK-SETUP.md`
- **Architecture**: `docs/architecture.md`
- **API Reference**: `docs/api-reference.md`
- **Wiki**: `wiki/`

---

## License

MIT
