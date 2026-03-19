# Troubleshooting

## SpacetimeDB won't start

**Check binary exists:**
```
ls Bin/SpacetimeDB/spacetimedb-standalone.exe
```

**Check port conflict:**
SpacetimeDB uses port 3001. Make sure nothing else is using it:
```bash
netstat -ano | findstr :3001
```

**Check logs:**
Click Database → check the status bar for error messages.

**Force restart:**
```bash
taskkill /F /IM spacetimedb-standalone.exe
bun run dev
```

## Schema init fails

If you see "Schema init failed: Unable to connect":
- SpacetimeDB takes 5-15 seconds to be HTTP-ready after starting
- The app polls `/v1/ping` for up to 30 seconds before giving up
- If it still fails, check `Bin/SpacetimeDB/` binary isn't corrupted

## Server won't start

**Check Java:**
```bash
java -version
```
Java 17+ is required.

**Check server.jar:**
```
ls servers/{server-id}/server.jar
```

**Check logs:**
The Console tab shows real-time server output. Look for errors.

## RCON not connecting

RCON is configured in `server.properties`:
```
enable-rcon=true
rcon.port=25575
rcon.password=your-password
```

The app reads `server.properties` and configures RCON automatically.

## Port already in use

If port 3000 is taken:
```env
PORT=3001
```
In `.env.local`, then change `SPACETIMEDB_PORT` to something else (e.g., 3002).

## Build fails

```bash
bun run clean
bun install
bun run build
```

## Data not persisting

Check `SPACETIMEDB_ENABLED` is not `"false"` in `.env.local`. If SpacetimeDB is disabled, data is only stored in-memory and `servers.json`.

## Player data missing

Player data is only tracked when:
1. SpacetimeDB is running
2. The server is running and logging to stdout

Player join/leave events are parsed from server log output. If the server doesn't output standard Minecraft log format, tracking won't work.
