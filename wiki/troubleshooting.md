# Troubleshooting

## Database won't initialize

**Check data directory exists:**
```
ls data/
```

The SQLite database is created automatically at `data/minemanager.db` on first run.

**Check permissions:**
Make sure the `data/` directory is writable by the application.

**Force re-initialization:**
```bash
bun run db:init
```

## Schema init fails

If you see "Schema init failed":
- Check that the `data/` directory exists and is writable
- Run `bun run db:init` to manually initialize the schema
- Check the terminal output for specific error messages

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
```bash
# Find and kill the process using port 3000
netstat -ano | findstr :3000
taskkill /F /PID <PID>
```

Or change the port in `.env.local`:
```env
PORT=3001
```

## Build fails

```bash
bun run clean
bun install
bun run build
```

## Player data missing

Player data is tracked when:
1. The database is initialized (automatic on first run)
2. The server is running and logging to stdout

Player join/leave events are parsed from server log output. If the server doesn't output standard Minecraft log format, tracking won't work.
