/**
 * WebSocket Server for real-time updates.
 * Runs as a standalone server on port 3001.
 *
 * Features:
 * - Accepts WebSocket connections
 * - Subscribes to Redis Pub/Sub for real-time events
 * - Broadcasts events to all connected clients
 * - Sends initial state snapshot on connect
 * - Ping/pong keepalive mechanism
 *
 * Usage:
 *   bun run lib/websocket-server.ts
 */

import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import { getAllServersStatus, getTotalOnlineCount, ServerState } from './redis';

// ==================== Types ====================

interface WSMessage {
  type: 'event' | 'snapshot';
  event?: string;
  data?: unknown;
  timestamp: string;
}

interface ServerSnapshot {
  id: string;
  name: string;
  status: string;
  cpu: number;
  ram: number;
  players: number;
  tps: number;
  updatedAt: string;
}

interface DashboardSnapshot {
  type: 'snapshot';
  timestamp: string;
  servers: ServerSnapshot[];
  totalPlayers: number;
}

// ==================== Configuration ====================

const PORT = 3001;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_CHANNEL = 'realtime:channel';
const PING_INTERVAL = 30000; // 30 seconds
const PING_TIMEOUT = 5000; // 5 seconds

// ==================== State ====================

// Track connected clients: WebSocket -> clientId
const clients = new Map<WebSocket, string>();
let clientIdCounter = 0;
let redisSubscriber: Redis | null = null;
let pingInterval: NodeJS.Timeout | null = null;

// ==================== Helper Functions ====================

function generateClientId(): string {
  return `client_${++clientIdCounter}_${Date.now()}`;
}

function send(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

async function buildSnapshot(): Promise<DashboardSnapshot> {
  const serversStatus = await getAllServersStatus();
  const servers: ServerSnapshot[] = [];

  serversStatus.forEach((state: ServerState, serverId: string) => {
    servers.push({
      id: serverId,
      name: serverId, // Server ID is used as name in the simple status
      status: state.status,
      cpu: state.cpu,
      ram: state.ram,
      players: state.players,
      tps: state.tps,
      updatedAt: state.updatedAt,
    });
  });

  const totalPlayers = await getTotalOnlineCount();

  return {
    type: 'snapshot',
    timestamp: new Date().toISOString(),
    servers,
    totalPlayers,
  };
}

function broadcast(message: WSMessage): void {
  const payload = JSON.stringify(message);
  clients.forEach((_clientId, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

function broadcastToAll(message: DashboardSnapshot): void {
  const payload = JSON.stringify(message);
  clients.forEach((_clientId, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

// ==================== Redis Pub/Sub ====================

async function setupRedisSubscriber(): Promise<void> {
  redisSubscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await redisSubscriber.connect();

  await redisSubscriber.subscribe(REDIS_CHANNEL);

  redisSubscriber.on('message', (channel: string, message: string) => {
    if (channel !== REDIS_CHANNEL) return;

    try {
      const parsed = JSON.parse(message) as {
        event: string;
        data: unknown;
        timestamp: number;
      };

      const wsMessage: WSMessage = {
        type: 'event',
        event: parsed.event,
        data: parsed.data,
        timestamp: new Date(parsed.timestamp).toISOString(),
      };

      broadcast(wsMessage);
    } catch (err) {
      console.error('[WebSocket] Failed to parse Redis message:', err);
    }
  });

  console.log(`[WebSocket] Subscribed to Redis channel: ${REDIS_CHANNEL}`);
}

// ==================== Connection Handling ====================

function handleConnection(ws: WebSocket): void {
  const clientId = generateClientId();
  clients.set(ws, clientId);
  console.log(`[WebSocket] Client connected: ${clientId} (total: ${clients.size})`);

  // Send initial snapshot
  buildSnapshot()
    .then((snapshot) => {
      send(ws, snapshot as unknown as WSMessage);
    })
    .catch((err) => {
      console.error('[WebSocket] Failed to build snapshot:', err);
    });

  // Handle messages from client
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString()) as { type?: string };

      // Handle pong response
      if (message.type === 'pong') {
        // Client responded to ping, connection is alive
      }
    } catch (err) {
      console.error('[WebSocket] Failed to parse client message:', err);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    const id = clients.get(ws);
    clients.delete(ws);
    console.log(`[WebSocket] Client disconnected: ${id} (total: ${clients.size})`);
  });

  // Handle errors
  ws.on('error', (err) => {
    const id = clients.get(ws);
    console.error(`[WebSocket] Client error (${id}):`, err.message);
    clients.delete(ws);
  });

  // Setup ping/pong for keepalive
  ws.on('ping', () => {
    ws.pong();
  });
}

// ==================== Server Lifecycle ====================

async function startPingInterval(): Promise<void> {
  pingInterval = setInterval(() => {
    const now = Date.now();
    clients.forEach((clientId, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping();
        } catch (err) {
          console.error(`[WebSocket] Ping failed for ${clientId}:`, err);
          ws.terminate();
          clients.delete(ws);
        }
      }
    });
  }, PING_INTERVAL);
}

async function shutdown(): Promise<void> {
  console.log('[WebSocket] Shutting down...');

  // Stop ping interval
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }

  // Close all client connections
  clients.forEach((clientId, ws) => {
    try {
      ws.close(1001, 'Server shutting down');
    } catch (err) {
      console.error(`[WebSocket] Error closing client ${clientId}:`, err);
    }
  });
  clients.clear();

  // Unsubscribe and disconnect from Redis
  if (redisSubscriber) {
    try {
      await redisSubscriber.unsubscribe(REDIS_CHANNEL);
      await redisSubscriber.quit();
    } catch (err) {
      console.error('[WebSocket] Error disconnecting from Redis:', err);
    }
    redisSubscriber = null;
  }

  console.log('[WebSocket] Shutdown complete');
}

// ==================== Main ====================

async function main(): Promise<void> {
  console.log('[WebSocket] Starting WebSocket server...');

  // Setup Redis subscriber
  await setupRedisSubscriber();

  // Create WebSocket server
  const wss = new WebSocketServer({ port: PORT });

  wss.on('connection', handleConnection);

  wss.on('error', (err) => {
    console.error('[WebSocket] Server error:', err);
  });

  // Start ping interval for keepalive
  await startPingInterval();

  console.log(`[WebSocket] Server listening on port ${PORT}`);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await shutdown();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[WebSocket] Fatal error:', err);
  process.exit(1);
});
