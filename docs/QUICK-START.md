# Quick Start Guide - NC-Mineman

## TL;DR - Quick Start

```powershell
# 1. Run setup
setup.bat

# 2. Configure Discord OAuth in .env.local
#    - Go to https://discord.com/developers/applications
#    - Create app, add redirect URI
#    - Copy Client ID and Secret

# 3. Start server
start-dev.bat    # Development with hot reload
start.bat        # Production build
```

---

## Prerequisites

| Requirement | Install Command | Needed For |
|-------------|-----------------|------------|
| Bun | `powershell -Command "irm bun.sh/install.ps1 \| iex"` | App runtime |
| Java 21 | `choco install microsoft-openjdk21` | Minecraft servers |
| Git | `choco install git` | Updates |

---

## Step-by-Step Setup

### Step 1: Install Dependencies

Double-click `setup.bat` or run:
```powershell
.\setup.bat
```

This automatically installs:
- Bun (JavaScript runtime)
- Java 21 (for Minecraft)
- Cloudflare Tunnel client
- All npm packages
- Configures firewall (port 3000, 25565, 80, 443)

### Step 2: Configure Discord OAuth

1. Go to **https://discord.com/developers/applications**
2. Create a new application
3. Go to "OAuth2" section
4. Add Redirect URI:
   ```
   http://localhost:3000/api/auth/callback
   ```
5. Copy **Client ID** and **Client Secret**
6. Update `.env.local`:
   ```env
   DISCORD_CLIENT_ID="your-client-id"
   DISCORD_CLIENT_SECRET="your-client-secret"
   DISCORD_REDIRECT_URI="http://localhost:3000/api/auth/callback"
   JWT_SECRET="<generate-a-64-char-random-string>"
   APP_URL="http://localhost:3000"
   ADMIN_USERNAMES="your-discord-username"
   ```

### Step 3: (Optional) Configure Polar.sh Payments

1. Go to **https://polar.sh**
2. Create account and organization
3. Create an access token
4. Add to `.env.local`:
   ```env
   POLAR_ACCESS_TOKEN="your-polar-token"
   POLAR_WEBHOOK_SECRET="your-webhook-secret"
   POLAR_SERVER="sandbox"
   ```

### Step 4: Start Development Server

```powershell
.\start-dev.bat
```

Visit: **http://localhost:3000**

### Step 5: Production Deployment

For public access, see: `docs/DNS-NETWORK-SETUP.md`

---

## What Each Script Does

| Script | Purpose |
|--------|---------|
| `setup.bat` | Installs all dependencies, creates config, firewall rules |
| `start-dev.bat` | Development mode with hot reload + Cloudflare tunnel |
| `start.bat` | Production build and server + Cloudflare tunnel |
| `bun run start` | Production server only |
| `bun run dev` | Development server only |
| `bun run db:init` | Initialize/reset database schema |

---

## Ports Used

| Port | Service | External Access |
|------|---------|-----------------|
| 3000 | Web App | Via Caddy/Tunnel |
| 8088 | MC Plugin API | No (internal) |
| 8089 | MC Plugin WebSocket | No (internal) |
| 25565 | Minecraft | Yes |
| 25575 | RCON | No (internal) |

---

## Troubleshooting

### "bun not found"
```powershell
powershell -Command "irm bun.sh/install.ps1 | iex"
```

### "Java not found"
```powershell
choco install microsoft-openjdk21
```

### "Port 3000 in use"
```powershell
netstat -ano | findstr :3000
taskkill /F /PID <PID>
```

### Login doesn't work
1. Check Discord OAuth credentials in `.env.local`
2. Verify redirect URI matches exactly in Discord Dev Portal
3. Check browser console for errors

### Server stats not showing
1. Install ServerStar plugin on your Minecraft server
2. Check plugin is running on port 8088
3. Verify `SERVER_STATS_PORT=8088` in `.env.local`

---

## Next Steps

1. **Login**: Visit http://localhost:3000 and click Login
2. **Create Minecraft Server**: http://localhost:3000/admin/servers
3. **Configure Branding**: http://localhost:3000/admin/branding
4. **Setup DNS** (for public access): `docs/DNS-NETWORK-SETUP.md`
5. **Install Plugin**: Build and install ServerStar on your MC server

---

## File Structure

```
nc-mineman/
├── start.bat          # Production launcher
├── start-dev.bat      # Development launcher
├── setup.bat          # Initial setup
├── Caddyfile          # Reverse proxy config
├── .env.local         # Your configuration (not in git)
├── .env.example       # Configuration template
│
├── Bin/               # Self-contained binaries
│   ├── cloudflared.exe  # Cloudflare Tunnel client
│   └── FRP/           # Tunnel binaries
│
├── servers/           # Minecraft server files
├── backups/           # Server backups
├── logs/              # Application logs
├── data/              # SQLite database (auto-created)
│
├── app/               # Next.js app routes
├── components/        # React components
├── lib/               # Core libraries (auth, db, cache, events)
├── plugins/Serverstats/ # Minecraft plugin (Java)
├── docs/              # Documentation
└── wiki/              # User wiki
```
