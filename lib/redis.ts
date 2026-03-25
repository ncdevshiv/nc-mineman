import Redis from 'ioredis';

// Redis connection singleton
let redis: Redis | null = null;
let isConnecting = false;

// Event emitter for pub/sub callbacks
type EventCallback = (data: unknown) => void;
const eventCallbacks: Map<string, Set<EventCallback>> = new Map();
let subscriber: Redis | null = null;

export interface ServerState {
  status: string;
  cpu: number;
  ram: number;
  players: number;
  tps: number;
  updatedAt: string;
}

// Redis key prefixes
const KEYS = {
  serverStatus: (id: string) => `servers:${id}:status`,
  serverPlayers: (id: string) => `servers:${id}:players`,
  serverMetrics: (id: string) => `servers:${id}:metrics`,
  realtimeChannel: 'realtime:channel',
  cache: (key: string) => `cache:${key}`,
};

const METRICS_MAX_LENGTH = 60;
const METRICS_TTL = 3600; // 1 hour

/**
 * Get Redis client instance (creates connection if needed)
 */
function getClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected');
    });

    redis.on('ready', () => {
      console.log('[Redis] Ready');
    });
  }
  return redis;
}

/**
 * Connect to Redis
 */
export async function connect(): Promise<void> {
  if (isConnecting) return;
  isConnecting = true;

  try {
    const client = getClient();
    if (client.status !== 'ready') {
      await client.connect();
    }
  } finally {
    isConnecting = false;
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnect(): Promise<void> {
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/**
 * Check if connected to Redis
 */
export function isConnected(): boolean {
  return redis?.status === 'ready';
}

// ==================== Server State ====================

/**
 * Set server state in Redis hash
 */
export async function setServerStatus(
  serverId: string,
  state: Partial<ServerState>
): Promise<void> {
  const client = getClient();
  const key = KEYS.serverStatus(serverId);

  await client.hset(key, {
    status: state.status ?? 'unknown',
    cpu: state.cpu ?? 0,
    ram: state.ram ?? 0,
    players: state.players ?? 0,
    tps: state.tps ?? 20,
    updatedAt: state.updatedAt ?? new Date().toISOString(),
  });

  // Set expiry on server status (1 hour)
  await client.expire(key, 3600);
}

/**
 * Get server state from Redis
 */
export async function getServerStatus(
  serverId: string
): Promise<ServerState | null> {
  const client = getClient();
  const key = KEYS.serverStatus(serverId);

  const data = await client.hgetall(key);

  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return {
    status: data.status ?? 'unknown',
    cpu: parseFloat(data.cpu ?? '0'),
    ram: parseFloat(data.ram ?? '0'),
    players: parseInt(data.players ?? '0', 10),
    tps: parseFloat(data.tps ?? '20'),
    updatedAt: data.updatedAt ?? '',
  };
}

/**
 * Get all server states
 */
export async function getAllServersStatus(): Promise<
  Map<string, ServerState>
> {
  const client = getClient();
  const servers: Map<string, ServerState> = new Map();

  // Scan for all server status keys
  let cursor = '0';
  do {
    const [newCursor, keys] = await client.scan(
      cursor,
      'MATCH',
      'servers:*:status',
      'COUNT',
      100
    );
    cursor = newCursor;

    for (const key of keys) {
      const serverId = key.split(':')[1];
      const state = await getServerStatus(serverId);
      if (state) {
        servers.set(serverId, state);
      }
    }
  } while (cursor !== '0');

  return servers;
}

// ==================== Player Tracking ====================

/**
 * Add player to server's online set
 */
export async function setPlayerOnline(
  serverId: string,
  playerName: string
): Promise<void> {
  const client = getClient();
  const key = KEYS.serverPlayers(serverId);

  await client.sadd(key, playerName);
  // Set expiry on player set (2 hours)
  await client.expire(key, 7200);
}

/**
 * Remove player from server's online set
 */
export async function setPlayerOffline(
  serverId: string,
  playerName: string
): Promise<void> {
  const client = getClient();
  const key = KEYS.serverPlayers(serverId);

  await client.srem(key, playerName);
}

/**
 * Get all online players on a server
 */
export async function getOnlinePlayers(serverId: string): Promise<string[]> {
  const client = getClient();
  const key = KEYS.serverPlayers(serverId);

  return client.smembers(key);
}

/**
 * Get total online count across all servers
 */
export async function getTotalOnlineCount(): Promise<number> {
  const client = getClient();
  let total = 0;

  // Scan for all server player keys
  let cursor = '0';
  do {
    const [newCursor, keys] = await client.scan(
      cursor,
      'MATCH',
      'servers:*:players',
      'COUNT',
      100
    );
    cursor = newCursor;

    for (const key of keys) {
      total += await client.scard(key);
    }
  } while (cursor !== '0');

  return total;
}

// ==================== Metrics ====================

/**
 * Push metric to server's metrics list (keeps last 60)
 */
export async function pushMetric(
  serverId: string,
  metric: Record<string, unknown>
): Promise<void> {
  const client = getClient();
  const key = KEYS.serverMetrics(serverId);

  // Push metric as JSON string
  await client.lpush(key, JSON.stringify(metric));

  // Trim to keep only last 60 metrics
  await client.ltrim(key, 0, METRICS_MAX_LENGTH - 1);

  // Set TTL on metrics list
  await client.expire(key, METRICS_TTL);
}

/**
 * Get recent metrics for a server
 */
export async function getMetrics(
  serverId: string,
  limit: number = 60
): Promise<Record<string, unknown>[]> {
  const client = getClient();
  const key = KEYS.serverMetrics(serverId);

  const rawMetrics = await client.lrange(key, 0, limit - 1);

  return rawMetrics.map((m) => JSON.parse(m) as Record<string, unknown>);
}

// ==================== Pub/Sub ====================

/**
 * Publish event to realtime channel
 */
export async function publish(
  event: string,
  data: unknown
): Promise<void> {
  const client = getClient();

  await client.publish(
    KEYS.realtimeChannel,
    JSON.stringify({ event, data, timestamp: Date.now() })
  );
}

/**
 * Subscribe to realtime channel events
 */
export async function subscribe(
  event: string,
  callback: EventCallback
): Promise<void> {
  // Add callback to our local map
  if (!eventCallbacks.has(event)) {
    eventCallbacks.set(event, new Set());
  }
  eventCallbacks.get(event)!.add(callback);

  // Initialize subscriber if needed
  if (!subscriber) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    subscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    await subscriber.connect();

    await subscriber.subscribe(KEYS.realtimeChannel);

    subscriber.on('message', (channel, message) => {
      if (channel !== KEYS.realtimeChannel) return;

      try {
        const parsed = JSON.parse(message) as {
          event: string;
          data: unknown;
        };
        const callbacks = eventCallbacks.get(parsed.event);
        if (callbacks) {
          callbacks.forEach((cb) => cb(parsed.data));
        }
      } catch (err) {
        console.error('[Redis] Failed to parse pub/sub message:', err);
      }
    });
  } else {
    // Already subscribed, just re-register callback
  }
}

/**
 * Unsubscribe from realtime channel events
 */
export async function unsubscribe(event: string): Promise<void> {
  eventCallbacks.delete(event);

  // If no more callbacks, unsubscribe from Redis
  if (eventCallbacks.size === 0 && subscriber) {
    await subscriber.unsubscribe(KEYS.realtimeChannel);
    await subscriber.quit();
    subscriber = null;
  }
}

// ==================== Cache ====================

/**
 * Set cache value with TTL
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const client = getClient();
  const redisKey = KEYS.cache(key);

  await client.set(redisKey, JSON.stringify(value), 'EX', ttlSeconds);
}

/**
 * Get cache value and parse JSON
 */
export async function cacheGet<T>(
  key: string
): Promise<T | null> {
  const client = getClient();
  const redisKey = KEYS.cache(key);

  const value = await client.get(redisKey);

  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Delete cache key
 */
export async function cacheDelete(key: string): Promise<void> {
  const client = getClient();
  const redisKey = KEYS.cache(key);

  await client.del(redisKey);
}

// Export singleton instance getter for direct access if needed
export function getRedisInstance(): Redis {
  return getClient();
}
