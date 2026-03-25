# Complete DNS and Network Configuration Guide

## Overview

This guide explains how to make your NC-Mineman server publicly accessible.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NETWORK ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────┘

                    INTERNET
                        │
                        ▼
              ┌─────────────────┐
              │  YOUR DOMAIN    │
              │  (DNS Records)  │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  YOUR PUBLIC IP │
              │  (from ISP)     │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │    ROUTER       │
              │  Port Forward   │
              │  80 → 80        │
              │  443 → 443      │
              │  25565 → 25565  │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  YOUR SERVER    │
              │  ┌───────────┐  │
              │  │   Caddy   │  │ Port 80, 443
              │  │(Reverse   │  │
              │  │ Proxy)    │  │
              │  └─────┬─────┘  │
              │        │        │
              │        ▼        │
              │  ┌───────────┐  │
              │  │NC-Mineman │  │ Port 3000
              │  │(Next.js)  │  │
              │  └───────────┘  │
              │                 │
              │  ┌───────────┐  │
              │  │Minecraft  │  │ Port 25565
              │  │Server     │  │
              │  └───────────┘  │
              └─────────────────┘
```

---

## Step 1: Get Your Public IP

### Method A: Visit a website
- Go to: https://whatismyip.com
- Or: https://ipinfo.io
- Or: https://ifconfig.me

### Method B: Command line
```powershell
# Windows PowerShell
(Invoke-WebRequest -Uri "https://ifconfig.me/ip").Content

# Or use nslookup
nslookup myip.opendns.com resolver1.opendns.com
```

```bash
# Linux/Mac
curl ifconfig.me
curl ipinfo.io/ip
```

**Write down your public IP:** `_________________`

---

## Step 2: Choose Your Domain

### Option A: Purchase a domain
- Namecheap: https://namecheap.com
- Cloudflare: https://cloudflare.com (includes free DNS)
- Porkbun: https://porkbun.com
- Google Domains: https://domains.google

### Option B: Use free dynamic DNS
- No-IP: https://noip.com (free subdomain)
- DuckDNS: https://duckdns.org (free)
- DynDNS: https://dyn.com/dns/

### Option C: Use Cloudflare Tunnel (no port forwarding needed!)
- Install cloudflared
- No public IP needed
- Better security

---

## Step 3: Configure DNS Records

Go to your domain registrar's DNS management panel and add these records:

### Required Records (Web Access)

| Type | Host/Name | Value/Points to | TTL | Purpose |
|------|-----------|-----------------|-----|---------|
| **A** | `@` | YOUR_PUBLIC_IP | 300 | Main website |
| **A** | `www` | YOUR_PUBLIC_IP | 300 | WWW redirect |

### Required Records (Minecraft)

| Type | Host/Name | Value | TTL | Purpose |
|------|-----------|-------|-----|---------|
| **SRV** | `_minecraft._tcp` | `0 5 25565 your-domain.com` | 300 | Minecraft connection |

### Example (replace with your values):

```
Domain: example.com
Public IP: 203.0.113.50

A      @        203.0.113.50      300
A      www      203.0.113.50      300
SRV    _minecraft._tcp    0 5 25565 example.com    300
```

### SRV Record Explanation

The SRV record format:
```
_service._proto.name    TTL    class    SRV    priority    weight    port    target
_minecraft._tcp         300    IN       SRV    0           5         25565   your-domain.com
```

- **Priority**: 0 (lowest = highest priority)
- **Weight**: 5 (for load balancing, use 5 if single server)
- **Port**: 25565 (default Minecraft port)
- **Target**: your-domain.com (the A record)

This allows players to connect with just `your-domain.com` instead of `your-domain.com:25565`

---

## Step 4: Configure Router Port Forwarding

### Access Router Admin Panel
1. Open browser and go to:
   - `192.168.1.1` (most common)
   - `192.168.0.1`
   - `10.0.0.1`
   - Check router manual

2. Login with admin credentials (on router label)

### Find Port Forwarding Section
Usually under:
- "Port Forwarding"
- "Virtual Server"
- "NAT"
- "Gaming" (some routers)

### Add Port Forwarding Rules

| Service | External Port | Internal Port | Internal IP | Protocol |
|---------|---------------|---------------|-------------|----------|
| HTTP | 80 | 80 | YOUR_SERVER_LOCAL_IP | TCP |
| HTTPS | 443 | 443 | YOUR_SERVER_LOCAL_IP | TCP |
| Minecraft | 25565 | 25565 | YOUR_SERVER_LOCAL_IP | TCP |

### Find Your Server's Local IP

```powershell
# Windows
ipconfig
# Look for "IPv4 Address" under your network adapter
# Usually: 192.168.1.xxx or 192.168.0.xxx
```

```bash
# Linux
ip addr show
# Or
hostname -I
```

**Write down your local IP:** `_________________`

### Set Static Local IP (Recommended)

To prevent IP changes after reboot:

1. Reserve IP in router DHCP settings
2. Or set static IP on server:
   - Windows: Network Settings → Adapter → Properties → IPv4
   - Linux: Edit `/etc/network/interfaces` or use Netplan

---

## Step 5: Update Environment Configuration

Edit `.env.local`:

```env
# Replace localhost with your domain
APP_URL="https://your-domain.com"

# Update Discord OAuth redirect URI
DISCORD_REDIRECT_URI="https://your-domain.com/api/auth/callback"

# Keep secrets secure
JWT_SECRET="your-64-char-secret-here"
```

---

## Step 6: Configure Caddy (HTTPS/Reverse Proxy)

### Update Caddyfile

Replace `your-domain.com` with your actual domain:

```caddyfile
your-domain.com {
    encode gzip zstd
    
    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        flush_interval -1
    }
    
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }
}

www.your-domain.com {
    redir https://your-domain.com{uri} permanent
}

# Minecraft TCP proxy (optional)
# your-domain.com:25565 {
#     reverse_proxy 127.0.0.1:25565
# }
```

### Start Caddy

```powershell
# Windows (run as Admin)
caddy run --config Caddyfile

# Or install as Windows service
nssm install Caddy "caddy" "run" "--config" "C:\path\to\Caddyfile"
nssm start Caddy
```

```bash
# Linux
sudo caddy run --config Caddyfile

# Or with systemd
sudo systemctl enable caddy
sudo systemctl start caddy
```

### Caddy Auto-HTTPS

Caddy automatically:
1. Obtains SSL certificates from Let's Encrypt
2. Renews certificates before expiry
3. Redirects HTTP to HTTPS
4. Enables HTTP/2 and HTTP/3

---

## Step 7: Discord OAuth Authentication Setup

### Create Discord Application

1. Go to: https://discord.com/developers/applications
2. Click "New Application"
3. Go to "OAuth2" section

### Configure Redirect URIs

In Discord Dev Portal → Your App → OAuth2 → Redirects:

| Environment | URI |
|-------------|-----|
| Development | `http://localhost:3000/api/auth/callback` |
| Production | `https://your-domain.com/api/auth/callback` |

### Get API Credentials

From Discord Dev Portal → Your App → OAuth2:

```
Client ID:     your-client-id
Client Secret: your-client-secret
```

### Update .env.local

```env
DISCORD_CLIENT_ID="your-client-id"
DISCORD_CLIENT_SECRET="your-client-secret"
DISCORD_REDIRECT_URI="https://your-domain.com/api/auth/callback"
ADMIN_USERNAMES="your-discord-username"
```

### Test Authentication

1. Start the server: `start.bat` or `start-dev.bat`
2. Visit: `http://localhost:3000`
3. Click "Login"
4. You should be redirected to Discord OAuth
5. After login, you'll be redirected back

---

## Troubleshooting

### DNS Not Resolving

```powershell
# Check DNS propagation
nslookup your-domain.com
dig your-domain.com

# Use online tools
# https://dnschecker.org
# https://whatsmydns.net
```

### Port Not Accessible

```powershell
# Check if port is listening
netstat -an | findstr :3000
netstat -an | findstr :25565

# Test from external
# https://yougetsignal.com/tools/open-ports/
```

### Firewall Blocking

```powershell
# Windows - check firewall rules
netsh advfirewall firewall show rule name=all | findstr "NC-Mineman"

# Temporarily disable for testing (not recommended for production)
netsh advfirewall set allprofiles state off
# Re-enable after testing
netsh advfirewall set allprofiles state on
```

### SSL Certificate Issues

```powershell
# Check Caddy logs
caddy validate --config Caddyfile

# Force certificate renewal
caddy reload --config Caddyfile
```

### Can't Connect to Minecraft

1. Check server is running: `http://your-domain.com/admin`
2. Verify port 25565 is forwarded
3. Check firewall allows port 25565
4. Test with direct connection: `your-domain.com:25565`
5. Test with SRV: just `your-domain.com`

---

## Quick Reference

### Port Summary

| Port | Service | External | Internal | Protocol |
|------|---------|----------|----------|----------|
| 80 | HTTP | Required | Caddy | TCP |
| 443 | HTTPS | Required | Caddy | TCP |
| 3000 | NC-Mineman | No | Internal | TCP |
| 25565 | Minecraft | Required | Minecraft | TCP |
| 25575 | RCON | No | Internal | TCP |

### DNS Record Summary

| Type | Host | Value |
|------|------|-------|
| A | @ | PUBLIC_IP |
| A | www | PUBLIC_IP |
| SRV | _minecraft._tcp | 0 5 25565 your-domain.com |

### URLs Summary

| Service | Local URL | Public URL |
|---------|-----------|------------|
| Dashboard | http://localhost:3000 | https://your-domain.com |
| Admin | http://localhost:3000/admin | https://your-domain.com/admin |
| Minecraft | localhost:25565 | your-domain.com |

---

## Alternative: Cloudflare Tunnel (No Port Forwarding)

If you can't forward ports or want better security:

### 1. Install cloudflared

```powershell
# Windows (with Chocolatey)
choco install cloudflared

# Or download from:
# https://github.com/cloudflare/cloudflared/releases
```

### 2. Authenticate

```powershell
cloudflared tunnel login
```

### 3. Create Tunnel

```powershell
cloudflared tunnel create nc-mineman
```

### 4. Configure Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: nc-mineman
credentials-file: C:\Users\YourUser\.cloudflared\nc-mineman.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:3000
  - hostname: play.your-domain.com
    service: tcp://localhost:25565
  - service: http_status:404
```

### 5. Add DNS

```powershell
cloudflared tunnel route dns nc-mineman your-domain.com
cloudflared tunnel route dns nc-mineman play.your-domain.com
```

### 6. Run Tunnel

```powershell
cloudflared tunnel run nc-mineman
```

### Benefits of Cloudflare Tunnel
- No port forwarding needed
- DDoS protection
- Hide server IP
- Works behind NAT/CGNAT
