# PRODUCTION SETUP GUIDE - hideoutsmp.com

## Current Status

| Component | Status | Action Needed |
|-----------|--------|---------------|
| DNS (hideoutsmp.com) | ✅ Correct (122.161.162.184) | None |
| Port 3000 (Next.js) | ✅ Running | None |
| Port 80 (HTTP) | ✅ Open externally | Start Caddy |
| Port 443 (HTTPS) | ✅ Open externally | Start Caddy |
| Port 25565 (Minecraft) | ❌ Not needed yet | Open when SMP starts |
| Discord OAuth Config | ✅ Correct | None |

## Quick Start - 3 Terminals

### Terminal 1: Start Next.js App
```powershell
cd C:\Users\Cartoon\Desktop\MINEMANAGER\nc-mineman
bun run start
```

### Terminal 2: Start Caddy (Admin PowerShell)
```powershell
cd C:\Users\Cartoon\Desktop\MINEMANAGER\nc-mineman
caddy run --config Caddyfile
```

### OR: Use Combined Script (Admin)
```powershell
.\start-production.bat
```

---

## Access URLs

| URL | Port | Status |
|-----|------|--------|
| http://localhost:3000 | 3000 | ✅ Working |
| http://122.161.162.184 | 80 | Needs Caddy |
| https://hideoutsmp.com | 443 | Needs Caddy + SSL |

---

## Discord OAuth Login Flow

1. Visit: http://localhost:3000
2. Click "Login"
3. Redirects to Discord OAuth
4. Login with your Discord account
5. Redirects back to the app (admin if username matches ADMIN_USERNAMES)

---

## What Each Script Does

| Script | Purpose |
|--------|---------|
| `start-dev.bat` | Development with hot reload |
| `start.bat` | Production build + start |
| `start-caddy.bat` | Start only Caddy |
| `start-production.bat` | Start everything (Admin required) |

---

## DNS Records (Already Correct)

| Type | Name | Content |
|------|------|---------|
| A | hideoutsmp.com | 122.161.162.184 |
| A | mc | 122.161.162.184 |
| A | www | 122.161.162.184 (add if missing) |
| SRV | _minecraft._tcp | 0 5 25565 mc.hideoutsmp.com |

---

## Router Port Forwarding

| Port | Service | Status |
|------|---------|--------|
| 80 | HTTP | ✅ Forwarded |
| 443 | HTTPS | ✅ Forwarded |
| 25565 | Minecraft | Forward when needed |

---

## Troubleshooting

### Can't access via domain/IP
1. Check Caddy is running: `tasklist | findstr caddy`
2. Check port 80/443 listening: `netstat -an | findstr ":80"`
3. Check firewall allows ports

### Login not working
1. Check .env.local has correct Discord OAuth credentials
2. Check Discord redirect URI matches exactly in Discord Dev Portal
3. Clear browser cookies and try again

### SSL Certificate fails
1. DNS must be propagated (check: `nslookup hideoutsmp.com`)
2. Port 80 must be accessible from internet
3. Caddy will auto-retry, wait 5 minutes

---

## Manual Caddy Start

```powershell
# Run as Administrator
cd C:\Users\Cartoon\Desktop\MINEMANAGER\nc-mineman

# Validate config
caddy validate --config Caddyfile

# Start Caddy
caddy run --config Caddyfile
```

---

## Expected Console Output

When Caddy starts successfully:
```
{"level":"info","ts":...,"msg":"serving initial configuration"}
{"level":"info","ts":...,"msg":"autosaved config (load with --resume)"}
{"level":"info","ts":...,"msg":"serving listeners on :80"}
{"level":"info","ts":...,"msg":"serving listeners on :443"}
```
