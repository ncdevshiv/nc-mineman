# NCDev Plugin

**Version:** 0.0.1 | **API:** 1.20+ | **Servers:** Paper, Folia, Spigot, Velocity

Advanced Minecraft server plugin with real-time tracking, economy system, marketplace, moderation tools, and social features. Built for scalability with Redis Pub/Sub and Socket.IO support.

---

## Features

### 🔄 Real-Time Updates
- Live player tracking with WebSocket and Socket.IO
- Player location, health, ping, and status updates
- Real-time dashboard integration

### 💰 Economy System
- Virtual currency with configurable decimals
- Daily login bonuses with streak rewards
- Transaction history and statistics
- Wealth distribution tracking

### 🛒 Marketplace
- Direct item sales
- Auction system with bidding
- Player-to-player exchanges
- Category-based listings
- Automatic expiration handling

### 🛡️ Moderation Tools
- **Ban/Mute System**: Temporary and permanent punishments
- **Jail System**: Teleport players to designated areas
- **Freeze System**: Prevent player movement
- **Warn System**: Progressive punishment automation
- **Fun Commands**: /slap, /strike, /heal, /feed

### 👥 Social Features
- Friend system with notifications
- Follow/Unfollow players
- Player reports

### ⚡ Data Lifecycle
- Configurable data retention periods
- Automatic cleanup of old records
- Archive support for important data

### 🔧 Scalability
- **Redis Pub/Sub**: Multi-server synchronization
- **Socket.IO**: Advanced real-time features
- **Batch Processing**: Optimized database writes

---

## Quick Start

### Installation

1. Download the latest `ncdev-X.X.X.jar` from releases
2. Place in your server's `plugins/` folder
3. Restart the server
4. Configure via `plugins/ncdev/config.yml`

### Basic Configuration

```yaml
# Enable/disable features
currency:
  enabled: true
  starting_balance: 1000

marketplace:
  enabled: true

moderation:
  enabled: true
```

### API Ports

| Service | Port | Purpose |
|---------|------|---------|
| Config API | 8088 | Configuration management |
| WebSocket | 8089 | Real-time updates |
| Socket.IO | 8090 | Advanced real-time features |

---

## Documentation

- [API Integration Guide](API_INTEGRATION_GUIDE.md)
- [Configuration Guide](CONFIGURATION_GUIDE.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)

---

## Commands

### Player Commands
```
/balance         - Check your balance
/pay <player> <amount> - Pay another player
/market          - Open marketplace GUI
/friend          - Friend management
```

### Admin Commands
```
/ncdev reload   - Reload configuration
/ncdev stats    - View server statistics
/ban <player>   - Ban a player
/jail <player>  - Jail a player
/market admin   - Admin marketplace management
```

---

## Permissions

| Permission | Description | Default |
|------------|-------------|---------|
| `ncdev.*` | All permissions | OP |
| `ncdev.player` | Basic player features | All |
| `ncdev.economy.*` | Economy features | All |
| `ncdev.marketplace.*` | Marketplace access | All |
| `ncdev.moderation.*` | Moderation tools | OP |
| `ncdev.admin` | Full admin access | OP |

---

## API Integration

Connect your dashboard or external services:

```javascript
// WebSocket connection
const ws = new WebSocket('ws://localhost:8089');

// Subscribe to player updates
ws.send(JSON.stringify({
    type: 'subscribe',
    room: 'player:UUID-HERE'
}));

// Listen for updates
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(data);
};
```

See [API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md) for full documentation.

---

## System Requirements

- **Java**: 21+
- **Server**: Paper/Spigot/Folia 1.20+
- **Database**: H2 (embedded), PostgreSQL, or MySQL
- **Memory**: 512MB minimum, 1GB recommended

---

## Support

- **Documentation**: [docs.ncdev.io](https://docs.ncdev.io)
- **Discord**: [discord.ncdev.io](https://discord.ncdev.io)
- **Issues**: [GitHub Issues](https://github.com/ncdev/ncdev-plugin/issues)

---

## License

This project is proprietary software. All rights reserved.

---

## Changelog

### Version 0.0.1
- Initial release
- Real-time tracking with WebSocket/Socket.IO
- Economy and currency system
- Marketplace with sales, auctions, exchanges
- Advanced moderation tools
- Redis Pub/Sub for multi-server support
- Configurable data lifecycle management
