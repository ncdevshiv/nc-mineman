# NCDev Deployment Guide

**Version:** 0.0.1 | **Last Updated:** 2026-03-25

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Single Server Setup](#single-server-setup)
4. [Multi-Server Setup](#multi-server-setup)
5. [Database Configuration](#database-configuration)
6. [Redis Setup](#redis-setup)
7. [Reverse Proxy Configuration](#reverse-proxy-configuration)
8. [Security](#security)
9. [Performance Tuning](#performance-tuning)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements

| Component | Minimum | Recommended |
|-----------|---------|------------|
| Java | 21 | 21 LTS |
| RAM | 512 MB | 2 GB |
| CPU | 1 Core | 4 Cores |
| Disk | 1 GB | 10 GB SSD |
| Minecraft Server | Paper 1.20+ | Paper 1.21+ |

### Software Requirements

- **Minecraft Server**: Paper, Spigot, or Folia 1.20+
- **Database**: H2 (embedded), PostgreSQL 14+, or MySQL 8+
- **Optional**: Redis 7+ for multi-server support

---

## Installation

### Step 1: Build the Plugin

```bash
# Clone repository
git clone https://github.com/ncdev/ncdev-plugin.git
cd ncdev-plugin

# Build
./gradlew shadowJar

# Output: build/libs/ncdev-0.0.1.jar
```

### Step 2: Install on Server

```bash
# Stop your Minecraft server
systemctl stop minecraft

# Create plugin directory
mkdir -p /opt/minecraft/plugins

# Copy JAR
cp build/libs/ncdev-0.0.1.jar /opt/minecraft/plugins/

# Set permissions
chown minecraft:minecraft /opt/minecraft/plugins/ncdev-0.0.1.jar
chmod 644 /opt/minecraft/plugins/ncdev-0.0.1.jar

# Start server
systemctl start minecraft
```

### Step 3: Initial Configuration

After first run, the plugin creates `plugins/ncdev/config.yml`:

```bash
# Edit configuration
nano /opt/minecraft/plugins/ncdev/config.yml
```

---

## Single Server Setup

For servers with up to ~3,000 players.

### Recommended Configuration

```yaml
# config.yml

database:
  type: "h2"  # Embedded database

redis:
  enabled: false  # Not needed for single server

websocket:
  enabled: true
  port: 8089
  max_connections: 5000

socketio:
  enabled: false  # Use WebSocket only

currency:
  enabled: true
  starting_balance: 1000

marketplace:
  enabled: true

moderation:
  enabled: true

lifecycle:
  enabled: true
  retention:
    activity:
      enabled: true
      days: 7
```

### Service Configuration

```bash
# Create systemd service
cat > /etc/systemd/system/ncdev-api.service << EOF
[Unit]
Description=NCDev API Server
After=network.target

[Service]
Type=simple
User=minecraft
WorkingDirectory=/opt/minecraft
ExecStart=/usr/bin/java -jar /opt/minecraft/plugins/ncdev-api.jar
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ncdev-api
```

---

## Multi-Server Setup

For networks with multiple Minecraft servers requiring real-time synchronization.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                             │
│                   (HAProxy / Nginx)                             │
│                         :8088                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────┐      ┌───────────┐      ┌───────────┐
│  Server 1 │      │  Server 2 │      │  Server 3 │
│ Paper 1.21│      │ Paper 1.21│      │ Paper 1.21│
│ ncdev     │      │ ncdev     │      │ ncdev     │
└─────┬─────┘      └─────┬─────┘      └─────┬─────┘
      │                  │                  │
      └──────────────────┼──────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │       Redis          │
              │   (Pub/Sub + Cache)  │
              └─────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    PostgreSQL        │
              │   (Primary DB)       │
              └─────────────────────┘
```

### Server Configuration

Each Minecraft server needs:

```yaml
# Server 1 config.yml
server:
  velocity:
    enabled: true
    server_id: "server-1"

redis:
  enabled: true
  host: "redis-cluster.example.com"
  port: 6379
  password: "REDIS_PASSWORD"

database:
  type: "postgresql"
  postgresql:
    host: "db-primary.example.com"
    port: 5432
    database: "ncdev"
    username: "ncdev"
    password: "DB_PASSWORD"

websocket:
  enabled: true
  port: 8089

socketio:
  enabled: true
  port: 8090
```

### Redis Cluster Setup

```bash
# Install Redis
apt install redis-server

# Configure Redis
cat > /etc/redis/redis.conf << EOF
bind 0.0.0.0
protected-mode yes
port 6379
requirepass REDIS_PASSWORD
maxmemory 2gb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
EOF

systemctl restart redis-server
```

---

## Database Configuration

### PostgreSQL Setup

```bash
# Install PostgreSQL
apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE ncdev;
CREATE USER ncdev WITH ENCRYPTED PASSWORD 'DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE ncdev TO ncdev;
\c ncdev
GRANT ALL ON SCHEMA public TO ncdev;
EOF
```

### Database Tuning

```sql
-- PostgreSQL tuning for NCDev

-- Connection pool settings (in config.yml)
pool:
  size: 30
  min_idle: 10

-- PostgreSQL postgresql.conf tuning
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB

-- Enable query caching
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### MySQL Setup

```bash
# Install MySQL
apt install mysql-server

# Create database
mysql << EOF
CREATE DATABASE ncdev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ncdev'@'%' IDENTIFIED BY 'DB_PASSWORD';
GRANT ALL PRIVILEGES ON ncdev.* TO 'ncdev'@'%';
FLUSH PRIVILEGES;
EOF

# Configure MySQL
cat >> /etc/mysql/mysql.conf.d/ncdev.cnf << EOF
[mysqld]
max_connections = 200
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
query_cache_size = 0
EOF

systemctl restart mysql
```

---

## Redis Setup

### Redis Sentinel (High Availability)

```bash
# Install Redis on 3 nodes
# Node 1: redis1.example.com
# Node 2: redis2.example.com
# Node 3: redis3.example.com

# Configure Redis on each node
cat > /etc/redis/redis.conf << EOF
bind 0.0.0.0
protected-mode no
port 6379
requirepass REDIS_PASSWORD
maxmemory 2gb
appendonly yes
EOF

# Configure Sentinel on each node
cat > /etc/redis/sentinel.conf << EOF
port 26379
sentinel monitor ncdev redis1.example.com 6379 2
sentinel down-after-milliseconds ncdev 5000
sentinel parallel-syncs ncdev 1
sentinel failover-timeout ncdev 10000
sentinel auth-pass ncdev REDIS_PASSWORD
EOF
```

---

## Reverse Proxy Configuration

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/ncdev

# API Server
upstream ncdev_api {
    server 127.0.0.1:8088;
}

# WebSocket Server
upstream ncdev_ws {
    server 127.0.0.1:8089;
}

# Socket.IO Server
upstream ncdev_socketio {
    server 127.0.0.1:8090;
}

server {
    listen 80;
    server_name api.ncdev.io;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.ncdev.io;
    
    ssl_certificate /etc/letsencrypt/live/api.ncdev.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.ncdev.io/privkey.pem;
    
    # API endpoints
    location /api/ {
        proxy_pass http://ncdev_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://ncdev_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
    
    # Socket.IO
    location /socket.io/ {
        proxy_pass http://ncdev_socketio;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### HAProxy Configuration

```haproxy
# /etc/haproxy/haproxy.cfg

frontend ncdev_http
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/ncdev.pem
    mode http
    
    # API
    acl api path_beg /api
    use_backend ncdev_api if api
    
    # WebSocket
    acl ws hdr_upgrade -1 Upgrade
    acl ws hdr(Connection) -i upgrade
    use_backend ncdev_ws if ws
    
    default_backend ncdev_api

backend ncdev_api
    mode http
    balance roundrobin
    server server1 127.0.0.1:8088 check

backend ncdev_ws
    mode http
    balance leastconn
    option httpchk
    http-check expect status 200
    server server1 127.0.0.1:8089 check inter 10s fall 2 rise 1
```

---

## Security

### Firewall Rules

```bash
# UFW rules
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 25565/tcp # Minecraft
ufw allow 8088/tcp  # Config API
ufw allow 8089/tcp  # WebSocket
ufw allow 8090/tcp  # Socket.IO
```

### API Authentication

```yaml
# config.yml
config_api:
  auth:
    enabled: true
    jwt_secret: "YOUR_LONG_SECURE_SECRET_HERE"
    jwt_expiration_hours: 24
    require_admin_for_write: true
```

### Database Security

```bash
# Use SSL for database connections
database:
  postgresql:
    ssl: true
    ssl_mode: require

# Rotate passwords regularly
# Use strong passwords (16+ characters)
```

### Rate Limiting

```yaml
# config.yml
config_api:
  rate_limit:
    enabled: true
    requests_per_minute: 100
    burst: 20
```

---

## Performance Tuning

### JVM Arguments

```bash
# In server startup script
java -Xms2G -Xmx4G \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=50 \
  -XX:+ParallelRefProcEnabled \
  -XX:+AlwaysPreTouch \
  -XX:+DisableExplicitGC \
  -jar paper.jar
```

### Connection Pool Tuning

```yaml
# config.yml
database:
  pool:
    size: 30
    min_idle: 10
    connection_timeout_ms: 30000
    idle_timeout_ms: 600000
    max_lifetime_ms: 1800000
```

### Caching Configuration

```yaml
# config.yml
redis:
  enabled: true
  features:
    cache_enabled: true
    pubsub_enabled: true

performance:
  cache:
    player_data_ttl_seconds: 300
    server_stats_ttl_seconds: 5
    marketplace_listings_ttl_seconds: 60
```

---

## Monitoring

### Health Check Endpoint

```bash
# Check API health
curl http://localhost:8088/api/health

# Check WebSocket status
curl http://localhost:8089/health

# Check Socket.IO status
curl http://localhost:8090/health
```

### Prometheus Metrics

```yaml
# Enable metrics in config
performance:
  metrics:
    enabled: true
    port: 9090
    path: /metrics
```

### Log Monitoring

```bash
# Monitor plugin logs
tail -f /opt/minecraft/logs/latest.log | grep ncdev

# Monitor structured JSON logs
tail -f /opt/minecraft/plugins/ncdev/logs/ncdev.log | jq
```

---

## Troubleshooting

### Common Issues

#### Plugin Won't Load

```bash
# Check Java version
java -version

# Should be Java 21+

# Check for errors
grep -i error /opt/minecraft/logs/latest.log
```

#### Database Connection Failed

```bash
# Test PostgreSQL connection
psql -h localhost -U ncdev -d ncdev

# Check firewall
ufw status

# Verify credentials in config.yml
```

#### Redis Connection Failed

```bash
# Test Redis connection
redis-cli -h localhost -p 6379 -a REDIS_PASSWORD ping

# Should return: PONG
```

#### WebSocket Connection Issues

```bash
# Check ports are open
netstat -tlnp | grep 8089

# Test WebSocket connection
wscat -c ws://localhost:8089
```

### Performance Issues

#### High TPS Lag

```yaml
# Reduce activity logging
tracking:
  sampling:
    enabled: true
    rate: 0.1  # Log 10% of events

lifecycle:
  retention:
    activity:
      days: 3  # Shorter retention
```

#### Memory Issues

```bash
# Monitor memory usage
jcmd $(pgrep java) VM.native_memory summary

# Increase heap
java -Xmx4G -Xms4G ...
```

---

## Support

- **Documentation**: [docs.ncdev.io](https://docs.ncdev.io)
- **Discord**: [discord.ncdev.io](https://discord.ncdev.io)
- **GitHub Issues**: [github.com/ncdev/ncdev-plugin/issues](https://github.com/ncdev/ncdev-plugin/issues)
