# Player Management

## Overview

MineServer2 tracks players in two ways:

1. **RCON commands** — OP, ban, whitelist via the Players tab (live Minecraft server)
2. **SpacetimeDB** — Persistent records with IP history, sessions, playtime, notes

## RCON Player Management

The **Players** tab shows real-time data from the Minecraft server:
- **Operators** — View and manage OP players
- **Whitelist** — Add/remove from whitelist
- **Banned Players** — Ban/pardon players
- **Recent Logins** — Player join activity

Every RCON action (op, ban, whitelist, kick) is also persisted to SpacetimeDB automatically.

## SpacetimeDB Player Tracking

The **Database → Players** tab provides comprehensive player data:

### Player Record Fields
- **Status badges**: Online, OP, Banned, Whitelisted, Waitlisted
- **IP Address**: Last known IP
- **First Seen / Last Seen**: Timestamps
- **Permission Level**: 0-4
- **Ban Reason**: Text
- **Total Playtime**: Cumulative seconds
- **Current Session**: Active session start time
- **Notes**: Admin-editable notes

### Actions (inline buttons on hover)
- OP / Deop
- Ban / Unban
- Waitlist / Remove from Waitlist
- View IP History
- Edit Notes
- Delete Record

### IP History

Click the globe icon on any player row to see all IP addresses they've used. This is tracked automatically on every join.

### Sessions

The **Recent Sessions** table shows:
- Player name
- IP used
- Join time
- Leave time
- Duration

### Filters
- **All** — All known players
- **Online** — Currently online
- **Operators** — Has OP status
- **Banned** — Is banned
- **Whitelisted** — Is whitelisted
- **Waitlisted** — Is waitlisted
- **Search** — By name or IP

### Adding Players Manually

Click **Add Player** to create a record without the player joining:
- Name (required)
- IP address
- Notes
- Checkboxes: Operator, Whitelisted, Waitlisted

### Clearing Data

Click **Clear All** to delete all player records, sessions, and IP history for a server.
