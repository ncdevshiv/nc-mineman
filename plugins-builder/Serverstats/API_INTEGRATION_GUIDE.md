# ServerStar Plugin API Integration Guide

## Overview

ServerStar is a comprehensive Minecraft server plugin that provides real-time player tracking, inventory management, moderation tools, social features, and trading systems. This guide explains how frontend and backend teams can integrate with the plugin's APIs.

### Server Compatibility

ServerStar is designed to work with multiple Minecraft server platforms:

- **Paper** (1.20.0+) - Full feature support with Paper-specific optimizations
- **Folia** (1.20.0+) - Regionized threading support for high-performance servers
- **Spigot** (1.20.0+) - Basic compatibility with some advanced features limited
- **Velocity** (3.3.0+) - Proxy support for multi-server networks

The plugin automatically detects your server type and adapts its behavior accordingly.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Minecraft Server                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Plugin      │  │   Plugin      │  │   Plugin      │      │
│  │  (Tracking)   │  │  (Inventory)  │  │ (Moderation)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│  ┌──────┴──────────────────┴──────────────────┴───────┐     │
│  │              Message Queue (Redis/Kafka)            │     │
│  └──────────────────────┬─────────────────────────────┘     │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                    Backend Services                          │
│  ┌──────────────┐  ┌────┴─────────┐  ┌──────────────┐      │
│  │   API Server  │  │  WebSocket   │  │  Worker Pool │      │
│  │  (REST/HTTP)  │  │   Server     │  │  (Async Jobs)│      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│  ┌──────┴──────────────────┴──────────────────┴───────┐     │
│  │              SpaceTimeDB / PostgreSQL               │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                    Frontend (Web)                            │
│  ┌──────────────┐  ┌────┴─────────┐  ┌──────────────┐      │
│  │ Admin Panel   │  │ Player Portal│  │ Mod Interface│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Base URL
- REST API: `http://your-server:8088/api/`
- WebSocket: `ws://your-server:8089/`
- GraphQL: `http://your-server:8088/graphql`
- Health Check: `http://your-server:8088/health`

### Authentication
All admin/moderation endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Server Compatibility Features

#### Paper-Specific Features
- Advanced event handling
- Async task scheduling
- Enhanced player data access

#### Folia-Specific Features
- Regionized task scheduling for optimal performance
- Thread-safe operations across server regions
- Automatic workload distribution

#### Velocity Proxy Support
- Multi-server network support
- Proxy-aware player tracking
- Cross-server data synchronization

#### Automatic Feature Detection
The plugin automatically enables/disables features based on your server:
```json
{
  "server_type": "PAPER",
  "minecraft_version": "1.20.4",
  "folia_supported": true,
  "proxy_mode": false
}
```

## REST API Endpoints

### Players

#### GET /api/players
Get all online players with full data.

**Response:**
```json
{
  "players": [
    {
      "uuid": "string",
      "name": "string",
      "ping": 45,
      "role": "VIP",
      "health": 20.0,
      "food": 20,
      "gamemode": "SURVIVAL",
      "location": {
        "world": "world",
        "x": 100,
        "y": 64,
        "z": 200
      },
      "lastSeen": "2024-01-01T12:00:00Z",
      "totalPlaytime": 3600000,
      "roles": ["VIP", "Member"],
      "stats": {
        "health": 20.0,
        "food": 20,
        "saturation": 5.0,
        "experienceLevel": 10,
        "experienceProgress": 0.75,
        "gamemode": "SURVIVAL",
        "ping": 45
      },
      "inventory": [...],
      "recentActivities": [...]
    }
  ]
}
```

#### GET /api/player?uuid=<uuid>
Get detailed information for a specific player.

### Inventory Management

#### GET /api/inventory?uuid=<uuid>
Get player's inventory.

**Response:**
```json
{
  "inventory": [
    {
      "id": "123",
      "itemType": "DIAMOND_SWORD",
      "amount": 1,
      "displayName": "Sharp Sword",
      "lore": "A very sharp sword",
      "enchantments": "sharpness:5,unbreaking:3",
      "locked": false,
      "slot": 0
    }
  ]
}
```

#### POST /api/inventory
Perform inventory actions.

**Transfer Items:**
```json
{
  "action": "transfer",
  "playerUuid": "uuid-here",
  "toUuid": "recipient-uuid",
  "itemType": "DIAMOND",
  "amount": 10
}
```

**Sell Items:**
```json
{
  "action": "sell",
  "playerUuid": "uuid-here",
  "itemType": "DIAMOND",
  "amount": 5,
  "price": 100.0
}
```

**Lock/Unlock Items:**
```json
{
  "action": "lock",
  "playerUuid": "uuid-here",
  "itemId": "123",
  "locked": true
}
```

### Moderation

#### POST /api/moderation
Perform moderation actions.

**Ban Player:**
```json
{
  "action": "ban",
  "moderatorUuid": "mod-uuid",
  "targetUuid": "player-uuid",
  "reason": "Griefing",
  "durationMinutes": 1440
}
```

**Kick Player:**
```json
{
  "action": "kick",
  "moderatorUuid": "mod-uuid",
  "targetUuid": "player-uuid",
  "reason": "Inappropriate behavior"
}
```

**Freeze Player:**
```json
{
  "action": "freeze",
  "moderatorUuid": "mod-uuid",
  "targetUuid": "player-uuid",
  "frozen": true
}
```

**Warn Player:**
```json
{
  "action": "warn",
  "moderatorUuid": "mod-uuid",
  "targetUuid": "player-uuid",
  "message": "Please follow server rules"
}
```

#### GET /api/admin/bans
Get all active bans (admin only).

#### GET /api/admin/reports?status=open
Get reports (admin/mod only).

### Social Features

#### POST /api/social
Perform social actions.

**Send Friend Request:**
```json
{
  "action": "sendFriendRequest",
  "playerUuid": "your-uuid",
  "receiverUuid": "friend-uuid"
}
```

**Accept Friend Request:**
```json
{
  "action": "acceptFriendRequest",
  "playerUuid": "your-uuid",
  "requesterUuid": "friend-uuid"
}
```

**Follow Player:**
```json
{
  "action": "followPlayer",
  "playerUuid": "your-uuid",
  "targetUuid": "target-uuid"
}
```

**Submit Report:**
```json
{
  "action": "submitReport",
  "playerUuid": "your-uuid",
  "targetUuid": "bad-player-uuid",
  "reason": "Harassment"
}
```

### Trading

#### POST /api/trading
Perform trading actions.

**Create Auction:**
```json
{
  "action": "createAuction",
  "sellerUuid": "seller-uuid",
  "itemType": "DIAMOND_SWORD",
  "amount": 1,
  "startingPrice": 1000.0,
  "durationHours": 24
}
```

**Bid on Auction:**
```json
{
  "action": "bidOnAuction",
  "auctionId": "123",
  "bidderUuid": "bidder-uuid",
  "bidAmount": 1200.0
}
```

### Search

#### GET /api/search?q=<query>&type=players
Search for players by name.

**Response:**
```json
{
  "results": [
    {
      "uuid": "player-uuid",
      "name": "PlayerName",
      "ping": 30,
      "role": "VIP"
    }
  ]
}
```

## WebSocket Real-Time Updates

### Connection
```javascript
const ws = new WebSocket('ws://your-server:8089', {
  headers: {
    'client-id': 'frontend-client-123'
  }
});
```

### Message Format
All WebSocket messages follow this format:
```json
{
  "type": "event_type",
  "data": { /* event-specific data */ },
  "timestamp": 1640995200000
}
```

### Subscribing to Updates
```javascript
// Subscribe to a specific player's updates
ws.send(JSON.stringify({
  type: 'subscribe_player',
  uuid: 'player-uuid-here'
}));

// Unsubscribe
ws.send(JSON.stringify({
  type: 'unsubscribe_player',
  uuid: 'player-uuid-here'
}));
```

### Event Types

#### Player Updates
```json
{
  "type": "player_update",
  "data": {
    "uuid": "player-uuid",
    "name": "PlayerName",
    "ping": 45,
    "role": "VIP",
    "health": 18.5,
    "food": 19,
    "gamemode": "SURVIVAL",
    "location": {
      "world": "world",
      "x": 123.5,
      "y": 67.0,
      "z": 456.8
    },
    "last_update": 1640995200000
  }
}
```

#### Server Updates
```json
{
  "type": "server_update",
  "data": {
    "online_players": 25,
    "max_players": 100,
    "tps": 19.8,
    "average_ping": 35,
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

#### Activity Updates
```json
{
  "type": "activity",
  "data": {
    "player_id": "uuid",
    "action": "BLOCK_BREAK",
    "target": "STONE",
    "amount": 1,
    "location": {
      "world": "world",
      "x": 100,
      "y": 64,
      "z": 200
    },
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

#### Inventory Updates
```json
{
  "type": "inventory_update",
  "data": {
    "uuid": "player-uuid",
    "inventory": [
      {
        "id": "123",
        "itemType": "DIAMOND",
        "amount": 10,
        "locked": false
      }
    ]
  }
}
```

#### Connection Events
```json
{
  "type": "connection_established",
  "data": {
    "client_id": "frontend-client-123"
  }
}
```

## GraphQL API

The plugin provides a GraphQL endpoint for complex queries. Here's an example schema usage:

```graphql
query GetPlayerData($uuid: String!) {
  player(uuid: $uuid) {
    uuid
    name
    ping
    role
    health
    inventory {
      id
      itemType
      amount
      locked
    }
    friends {
      uuid
      name
    }
    recentActivities(limit: 10) {
      action
      target
      timestamp
    }
  }
}

mutation SendFriendRequest($receiverUuid: String!) {
  sendFriendRequest(receiverUuid: $receiverUuid)
}
```

## Frontend Integration Examples

### React Player Dashboard

```javascript
import React, { useState, useEffect } from 'react';

function PlayerDashboard({ playerUuid }) {
  const [playerData, setPlayerData] = useState(null);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // Fetch initial data
    fetch(`/api/player?uuid=${playerUuid}`)
      .then(res => res.json())
      .then(setPlayerData);

    // Setup WebSocket
    const websocket = new WebSocket('ws://your-server:8089');
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'player_update' && message.data.uuid === playerUuid) {
        setPlayerData(prev => ({ ...prev, ...message.data }));
      }
    };
    setWs(websocket);

    // Subscribe to updates
    websocket.onopen = () => {
      websocket.send(JSON.stringify({
        type: 'subscribe_player',
        uuid: playerUuid
      }));
    };

    return () => websocket.close();
  }, [playerUuid]);

  const transferItem = (toUuid, itemType, amount) => {
    fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'transfer',
        playerUuid,
        toUuid,
        itemType,
        amount
      })
    });
  };

  if (!playerData) return <div>Loading...</div>;

  return (
    <div className="player-dashboard">
      <h1>{playerData.name}</h1>
      <div className="stats">
        <span>Role: {playerData.role}</span>
        <span>Ping: {playerData.ping}ms</span>
        <span>Health: {playerData.health}/20</span>
      </div>
      <div className="inventory">
        {playerData.inventory.map(item => (
          <div key={item.id} className="inventory-item">
            <span>{item.itemType} x{item.amount}</span>
            <button onClick={() => transferItem('friend-uuid', item.itemType, 1)}>
              Gift
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Admin Moderation Panel

```javascript
function AdminPanel() {
  const [bans, setBans] = useState([]);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    fetch('/api/admin/bans', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(res => res.json()).then(data => setBans(data.bans));

    fetch('/api/admin/reports?status=open', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(res => res.json()).then(data => setReports(data.reports));
  }, []);

  const banPlayer = (targetUuid, reason, duration) => {
    fetch('/api/moderation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        action: 'ban',
        moderatorUuid: adminUuid,
        targetUuid,
        reason,
        durationMinutes: duration
      })
    });
  };

  return (
    <div className="admin-panel">
      <div className="bans-section">
        <h2>Active Bans</h2>
        {bans.map(ban => (
          <div key={ban.id} className="ban-item">
            <span>{ban.playerName} ({ban.playerUuid})</span>
            <span>Reason: {ban.reason}</span>
            <span>Expires: {ban.expiresAt || 'Permanent'}</span>
          </div>
        ))}
      </div>

      <div className="moderation-actions">
        <button onClick={() => banPlayer('target-uuid', 'Griefing', 1440)}>
          Ban Player (24h)
        </button>
        <button onClick={() => banPlayer('target-uuid', 'Severe violation', null)}>
          Permaban Player
        </button>
      </div>
    </div>
  );
}
```

## Backend Integration Examples

### Node.js Proxy Service

```javascript
const express = require('express');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const app = express();
const server = app.listen(3000);

// Proxy API requests with authentication
app.use('/api/*', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Proxy to ServerStar API
    const proxyReq = require('http').request({
      hostname: 'minecraft-server',
      port: 8088,
      path: req.path,
      method: req.method,
      headers: {
        ...req.headers,
        authorization: undefined // Remove original auth header
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    req.pipe(proxyReq);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// WebSocket proxy for real-time updates
const wss = new WebSocket.Server({ server });

wss.on('connection', (clientWs) => {
  const serverWs = new WebSocket('ws://minecraft-server:8089');

  serverWs.on('message', (data) => {
    clientWs.send(data);
  });

  clientWs.on('message', (data) => {
    serverWs.send(data);
  });
});
```

### Authentication Service

```javascript
// JWT token generation for login
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  // Verify credentials against Minecraft server or database
  const player = await verifyPlayerCredentials(username, password);

  if (player) {
    const token = jwt.sign({
      uuid: player.uuid,
      name: player.name,
      roles: player.roles,
      type: 'player'
    }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, player });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (!req.user.roles.includes('admin') && !req.user.roles.includes('moderator')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Protected admin routes
app.get('/admin/dashboard', requireAdmin, (req, res) => {
  // Return admin dashboard data
});
```

## Configuration

### Plugin Configuration (config.yml)

```yaml
api:
  port: 8088
  cors_origins: ["https://your-frontend.com"]
  rate_limit_requests_per_minute: 100

websocket:
  port: 8089
  max_connections: 1000

database:
  type: "postgresql"
  url: "jdbc:postgresql://localhost:5432/serverstar"
  username: "serverstar"
  password: "secure-password"

security:
  jwt_secret: "your-super-secret-jwt-key"
  jwt_expiration_hours: 24
```

### Frontend Environment Variables

```javascript
// .env
REACT_APP_API_BASE_URL=http://your-server:8088/api
REACT_APP_WS_URL=ws://your-server:8089
REACT_APP_JWT_SECRET=your-jwt-secret
```

## Error Handling

### HTTP Status Codes

- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (missing/invalid JWT)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

### WebSocket Error Messages

```json
{
  "type": "error",
  "data": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

## Performance Considerations

### Rate Limiting
- API requests are rate limited per client
- WebSocket connections have connection limits
- Database queries use connection pooling

### Caching
- Player data cached in Redis (optional)
- Frequently accessed data cached for 5-10 minutes
- Real-time updates bypass cache

### Scalability
- Horizontal scaling supported via Redis pub/sub
- Multiple WebSocket server instances possible
- Database read replicas for high traffic

## Security Best Practices

1. **Use HTTPS/WSS** in production
2. **Validate JWT tokens** on every request
3. **Role-based access control** for all endpoints
4. **Input validation** on all API inputs
5. **Rate limiting** to prevent abuse
6. **Audit logging** for moderation actions
7. **Secure database credentials**
8. **Regular security updates**

## Troubleshooting

### Common Issues

**WebSocket connection fails:**
- Check firewall settings
- Verify WebSocket port (8089) is open
- Ensure client sends proper headers

**API authentication fails:**
- Verify JWT token format
- Check token expiration
- Ensure correct secret key

**Database connection issues:**
- Verify database credentials
- Check database server status
- Ensure JDBC driver is available

**Real-time updates not working:**
- Check WebSocket subscription messages
- Verify player UUID format
- Check server logs for errors

### Monitoring

Monitor these metrics:
- API response times
- WebSocket connection count
- Database connection pool usage
- Error rates
- Player activity levels

### Logs

ServerStar logs all activities to the console in structured JSON format. Key log events:
- Player joins/quits
- Moderation actions
- Trading activities
- API errors
- WebSocket connections

This guide provides the foundation for integrating frontend and backend systems with the ServerStar plugin. For specific implementation details or additional features, refer to the plugin's source code documentation.