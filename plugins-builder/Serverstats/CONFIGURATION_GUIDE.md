# NCDev Configuration Guide

**Version:** 0.0.1 | **Last Updated:** 2026-03-25

---

## Table of Contents

1. [Configuration API](#configuration-api)
2. [Dashboard Controls](#dashboard-controls)
3. [Config Categories](#config-categories)
4. [Visual Controls Reference](#visual-controls-reference)
5. [Configuration Examples](#configuration-examples)

---

## Configuration API

The NCDev plugin exposes a REST API for configuration management at `http://localhost:8088/api/config`.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get all configuration |
| GET | `/api/config?path=xxx` | Get specific config value |
| PUT | `/api/config` | Update configuration |
| POST | `/api/config/validate` | Validate before saving |

### Example: Update via API

```bash
# Update currency starting balance
curl -X PUT http://localhost:8088/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "path": "currency.startingBalance",
    "value": 5000
  }'

# Enable marketplace
curl -X PUT http://localhost:8088/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "path": "marketplace.enabled",
    "value": true
  }'
```

### Example: Get Value

```bash
curl "http://localhost:8088/api/config?path=currency.startingBalance"
```

**Response:**
```json
{
    "path": "currency.startingBalance",
    "value": 5000
}
```

---

## Dashboard Controls

The configuration API is designed to integrate with web dashboards, providing visual controls for server administrators.

### Control Types

| Type | Description | JSON Value |
|------|-------------|------------|
| Toggle | Enable/disable features | `true` / `false` |
| Slider | Numeric values with range | `number` |
| Dropdown | Select from options | `string` |
| Text Input | Free-form text | `string` |
| Number Input | Numeric only | `number` |
| Color Picker | Hex color selection | `"#RRGGBB"` |

### Dashboard Implementation Example

```html
<!-- Toggle Control -->
<div class="config-control">
    <label>Enable Currency System</label>
    <input type="checkbox" 
           id="currency.enabled"
           onchange="updateConfig('currency.enabled', this.checked)">
</div>

<!-- Slider Control -->
<div class="config-control">
    <label>Starting Balance: <span id="balance-value">1000</span></label>
    <input type="range" 
           id="currency.startingBalance"
           min="0" 
           max="100000" 
           step="100"
           oninput="updateSliderValue('balance-value', this.value)"
           onchange="updateConfig('currency.startingBalance', parseInt(this.value))">
</div>

<!-- Dropdown Control -->
<div class="config-control">
    <label>Database Type</label>
    <select id="database.type"
            onchange="updateConfig('database.type', this.value)">
        <option value="h2">H2 (Embedded)</option>
        <option value="postgresql">PostgreSQL</option>
        <option value="mysql">MySQL</option>
    </select>
</div>

<script>
async function updateConfig(path, value) {
    const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, value })
    });
    
    const result = await response.json();
    if (result.success) {
        showNotification('Configuration saved');
    }
}
</script>
```

---

## Config Categories

### 1. Server Settings

```yaml
server:
  type: "auto"  # auto, paper, folia, spigot, velocity
  minecraft_version_min: "1.20.0"
  
  folia:
    enabled: true
    use_regionized_scheduling: true
    async_tasks: true
  
  velocity:
    enabled: false
    server_id: "main"
```

**Dashboard Controls:**
- `server.type`: Dropdown (auto, paper, folia, spigot, velocity)
- `server.folia.enabled`: Toggle
- `server.velocity.enabled`: Toggle

---

### 2. Database Configuration

```yaml
database:
  type: "h2"  # h2, postgresql, mysql
  
  h2:
    path: "./plugins/ncdev/database"
    auto_server: true
  
  postgresql:
    host: "localhost"
    port: 5432
    database: "ncdev"
    username: "ncdev"
    password: "CHANGE_THIS"
    ssl: false
  
  pool:
    size: 20
    min_idle: 5
    connection_timeout_ms: 30000
```

**Dashboard Controls:**
- `database.type`: Dropdown (h2, postgresql, mysql)
- `database.pool.size`: Slider (5-100)
- `database.postgresql.host`: Text Input
- `database.postgresql.port`: Number Input (1-65535)

---

### 3. Redis Configuration

```yaml
redis:
  enabled: true
  host: "localhost"
  port: 6379
  password: ""
  database: 0
  
  channels:
    player_updates: "ncdev:players:updates"
    server_stats: "ncdev:server:stats"
    activity: "ncdev:activity:stream"
    moderation: "ncdev:moderation:events"
    economy: "ncdev:economy:transactions"
    marketplace: "ncdev:marketplace:listings"
  
  features:
    pubsub_enabled: true
    cache_enabled: true
    distributed_locks: true
    session_sharing: false
```

**Dashboard Controls:**
- `redis.enabled`: Toggle
- `redis.host`: Text Input
- `redis.port`: Number Input
- `redis.features.pubsub_enabled`: Toggle

---

### 4. WebSocket Configuration

```yaml
websocket:
  enabled: true
  port: 8089
  max_connections: 10000
  connection_timeout_ms: 60000
  ping_interval_seconds: 30
  compression:
    enabled: true
    min_threshold_bytes: 1024
```

**Dashboard Controls:**
- `websocket.enabled`: Toggle
- `websocket.port`: Number Input (1024-65535)
- `websocket.max_connections`: Slider (1000-50000)
- `websocket.ping_interval_seconds`: Slider (10-120)

---

### 5. Socket.IO Configuration

```yaml
socketio:
  enabled: true
  port: 8090
  ping_interval_ms: 25000
  ping_timeout_ms: 20000
  namespaces:
    - name: "/player"
      description: "Player updates"
      auth_required: false
    - name: "/admin"
      description: "Admin events"
      auth_required: true
    - name: "/marketplace"
      description: "Marketplace events"
      auth_required: false
    - name: "/economy"
      description: "Economy events"
      auth_required: false
```

**Dashboard Controls:**
- `socketio.enabled`: Toggle
- `socketio.port`: Number Input
- `socketio.ping_interval_ms`: Slider (10000-60000)

---

### 6. Currency Configuration

```yaml
currency:
  enabled: true
  
  primary:
    name: "Coins"
    symbol: "⛁"
    plural_name: "Coins"
    singular_name: "Coin"
    decimal_places: 2
    format: "symbol_before"
  
  starting_balance: 1000.0
  max_balance: 0  # 0 = unlimited
  min_transaction: 0.01
  
  daily_bonus:
    enabled: true
    amount: 100.0
    streak_multiplier: 0.1
    max_streak_days: 7
  
  transaction:
    max_single: 1000000.0
    daily_limit: 10000000.0
    hourly_limit: 1000000.0
  
  allow_negative: false
  
  interest:
    enabled: false
    rate_percent: 1.0
    compound: true
```

**Dashboard Controls:**
- `currency.enabled`: Toggle
- `currency.starting_balance`: Slider (0-100000)
- `currency.primary.symbol`: Text Input
- `currency.primary.decimal_places`: Dropdown (0-8)
- `currency.daily_bonus.enabled`: Toggle
- `currency.daily_bonus.amount`: Slider (0-10000)
- `currency.allow_negative`: Toggle

---

### 7. Marketplace Configuration

```yaml
marketplace:
  enabled: true
  
  listings:
    item_sale:
      enabled: true
      tax_percent: 5.0
      min_price: 1.0
      max_price: 10000000.0
      max_per_player: 50
      duration_days: 7
    
    auction:
      enabled: true
      tax_percent: 5.0
      min_starting_bid: 100.0
      max_duration_hours: 168
      min_duration_hours: 1
      extension_on_bid_minutes: 5
      buyout_enabled: true
    
    exchange:
      enabled: true
      tax_percent: 2.0
      duration_days: 3
  
  categories:
    - name: "All"
      icon: "CHEST"
      enabled: true
    - name: "Tools"
      icon: "DIAMOND_PICKAXE"
      enabled: true
```

**Dashboard Controls:**
- `marketplace.enabled`: Toggle
- `marketplace.listings.item_sale.enabled`: Toggle
- `marketplace.listings.item_sale.tax_percent`: Slider (0-50)
- `marketplace.listings.auction.enabled`: Toggle
- `marketplace.listings.auction.max_duration_hours`: Slider (24-720)

---

### 8. Moderation Configuration

```yaml
moderation:
  enabled: true
  
  logging:
    enabled: true
    log_to_file: true
    log_to_discord: false
    discord_webhook: ""
  
  auto_moderation:
    enabled: true
    chat_filter:
      enabled: true
      mode: "replace"
      blocked_words:
        - "spam"
        - "advertisement"
    spam_detection:
      enabled: true
      max_messages_per_minute: 5
  
  ban:
    default_reason: "Violation of server rules"
    permanent_by_default: false
    default_duration_minutes: 1440
  
  mute:
    default_duration_minutes: 30
  
  freeze:
    notify_on_freeze: true
    allow_movement: false
  
  jail:
    enabled: true
    default_location: "world,0,64,0"
  
  warn:
    max_warns: 3
    auto_actions:
      - { warns: 1, action: "mute", duration_minutes: 30 }
      - { warns: 3, action: "kick" }
```

**Dashboard Controls:**
- `moderation.enabled`: Toggle
- `moderation.logging.enabled`: Toggle
- `moderation.auto_moderation.enabled`: Toggle
- `moderation.ban.default_duration_minutes`: Slider (60-43200)
- `moderation.warn.max_warns`: Slider (1-10)

---

### 9. Lifecycle Configuration

```yaml
lifecycle:
  enabled: true
  
  retention:
    activity:
      enabled: true
      days: 7
    
    transactions:
      enabled: true
      days: 90
    
    chat_logs:
      enabled: true
      days: 14
    
    moderation_logs:
      enabled: true
      days: 0  # 0 = forever
  
  cleanup:
    schedule: "0 3 * * *"  # Daily at 3 AM
    dry_run: false
  
  archive:
    enabled: false
    path: "./plugins/ncdev/archive"
```

**Dashboard Controls:**
- `lifecycle.enabled`: Toggle
- `lifecycle.retention.activity.enabled`: Toggle
- `lifecycle.retention.activity.days`: Slider (1-365)
- `lifecycle.retention.transactions.days`: Slider (7-365)
- `lifecycle.cleanup.schedule`: Text Input (cron)
- `lifecycle.cleanup.dry_run`: Toggle

---

## Visual Controls Reference

### Toggle (Boolean)
```html
<input type="checkbox" 
       id="config.path"
       onchange="updateConfig('config.path', this.checked)">
```

### Slider (Number Range)
```html
<label>Value: <span id="value-display">1000</span></label>
<input type="range"
       min="0" 
       max="10000" 
       step="100"
       oninput="updateDisplay('value-display', this.value)"
       onchange="updateConfig('config.path', parseInt(this.value))">
```

### Dropdown (Enum)
```html
<select id="config.path" onchange="updateConfig('config.path', this.value)">
    <option value="option1">Option 1</option>
    <option value="option2">Option 2</option>
</select>
```

### Number Input
```html
<input type="number" 
       id="config.path"
       min="0" 
       max="65535"
       onchange="updateConfig('config.path', parseInt(this.value))">
```

### Color Picker
```html
<input type="color" 
       id="config.path"
       onchange="updateConfig('config.path', this.value)">
```

---

## Configuration Examples

### Minimal Configuration (Development)

```yaml
server:
  type: "auto"

database:
  type: "h2"

redis:
  enabled: false

websocket:
  enabled: true
  port: 8089

socketio:
  enabled: false

currency:
  enabled: true
  starting_balance: 100

marketplace:
  enabled: false

moderation:
  enabled: true

lifecycle:
  enabled: false
```

### Production Configuration

```yaml
server:
  type: "paper"

database:
  type: "postgresql"
  postgresql:
    host: "db.example.com"
    port: 5432
    database: "ncdev"
    username: "ncdev"
    password: "SECURE_PASSWORD"
    ssl: true
  pool:
    size: 30

redis:
  enabled: true
  host: "redis.example.com"
  port: 6379
  password: "REDIS_PASSWORD"
  ssl: true

websocket:
  enabled: true
  port: 8089
  max_connections: 10000
  compression:
    enabled: true

socketio:
  enabled: true
  port: 8090

currency:
  enabled: true
  starting_balance: 5000
  daily_bonus:
    enabled: true
    amount: 500

marketplace:
  enabled: true
  listings:
    auction:
      max_duration_hours: 168

moderation:
  enabled: true
  logging:
    enabled: true
    log_to_discord: true
    discord_webhook: "https://discord.com/api/webhooks/..."

lifecycle:
  enabled: true
  retention:
    activity:
      days: 30
    transactions:
      days: 365
```

---

For more information, visit [docs.ncdev.io](https://docs.ncdev.io)
