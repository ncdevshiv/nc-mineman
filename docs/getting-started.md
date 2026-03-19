# Getting Started

## Prerequisites

- **Bun** 1.1+ (or Node.js 18+)
- **Java 17+** (for Minecraft servers)
- **Windows** (primary target; Linux/macOS may work with minor adjustments)

## Installation

```bash
git clone https://github.com/ncdevshiv/nc-mineman.git
cd MineServer2
bun install
```

## Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
APP_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-string-here"
NEXTAUTH_URL="http://localhost:3000"

# Optional
GEMINI_API_KEY="your-key"

# SpacetimeDB (enabled by default)
SPACETIMEDB_ENABLED="true"
SPACETIMEDB_PORT="3001"
SPACETIMEDB_HOST="127.0.0.1"
```

## Running

### Development

```bash
bun run dev
```

This starts SpacetimeDB on port 3001 and Next.js on port 3000. Open `http://localhost:3000`.

### Production

```bash
bun run build
bun run start
```

### Fresh Start (kill everything, clean build)

```bash
bun run start:fresh
```

This kills all Java/Node/Bun/FRP/SpacetimeDB processes, clears build artifacts, rebuilds, and starts everything.

## First Run

1. Open `http://localhost:3000`
2. The app auto-starts SpacetimeDB and initializes the database schema
3. Click **Servers** in the sidebar to see the server list
4. Click **+ Create Server** to add your first Minecraft server
5. The server JAR will auto-download from PaperMC
6. Click **Start** to launch the server

## Verifying SpacetimeDB

Click **Database** in the sidebar. You should see:
- Status: Running
- Port: 3001
- Tables: 8 (servers, players, player_sessions, player_ip_history, server_logs, metrics, automation_rules, scheduled_tasks)
