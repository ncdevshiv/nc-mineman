# Getting Started

## Prerequisites

- **Bun** 1.1+ (runtime)
- **Java 17+** (for Minecraft servers)
- **Windows** (primary target; Linux/macOS may work with adjustments)

## Installation

```bash
git clone https://github.com/ncdevshiv/nc-mineman.git
cd nc-mineman
bun install
```

## Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:

```env
# Required - App URL
APP_URL="http://localhost:3000"

# Required - Generate a secure random string (64+ chars)
JWT_SECRET="your-super-secure-random-string-min-64-chars"

# Required - Discord OAuth
DISCORD_CLIENT_ID="your-discord-client-id"
DISCORD_CLIENT_SECRET="your-discord-client-secret"
DISCORD_REDIRECT_URI="http://localhost:3000/api/auth/callback"

# Required - Your Discord username(s) for admin access (comma-separated)
ADMIN_USERNAMES="your-discord-username"

# Optional - Site branding (can be changed in admin panel)
SITE_NAME_SHORT="Hideout"
SITE_NAME_FULL="Hideout SMP"
```

### Getting Discord OAuth Credentials

1. Go to https://discord.com/developers/applications
2. Create a new application
3. In "OAuth2" > "General":
   - Add Redirect: `http://localhost:3000/api/auth/callback`
   - Copy Client ID and Client Secret
4. Get your Discord ID (enable Developer Mode, right-click username, "Copy User ID")
5. Add it to ADMIN_USERNAMES in .env.local

## Running

### Development

```bash
bun run dev
```

This starts the dev server on port 3000 with hot reload. Open `http://localhost:3000`.

### Production

```bash
bun run build
bun run start
```

### Windows Batch Files

```powershell
# Development mode
start-dev.bat

# Production mode  
start.bat
```

## First Run

1. Open `http://localhost:3000`
2. Click **Login with Discord** to authenticate
3. If this is your first login and you're in ADMIN_USERNAMES, you'll have admin access
4. Click **Servers** in the sidebar to see the server list
5. Click **+ Create Server** to add your first Minecraft server
6. The server JAR will auto-download from PaperMC
7. Click **Start** to launch the server

## User Profile Setup

After first login, users should:
1. Go to **Profile** page
2. Link their Minecraft username (required to play)
3. Optionally add phone number and Discord username

**Note**: Minecraft username can only be changed by Admins/Moderators to prevent account takeover.

## Verifying Database

Click **Database** in the admin sidebar. You should see:
- Status: Connected
- Type: SQLite (bun:sqlite)
- Tables: All tables created automatically on first run

## Troubleshooting

### Login fails
- Verify DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET are correct
- Check that redirect URI matches exactly in Discord Dev Portal
- Ensure ADMIN_USERNAMES contains your Discord username (without # discriminator)

### Port already in use
```powershell
netstat -ano | findstr :3000
taskkill /F /PID <PID>
```