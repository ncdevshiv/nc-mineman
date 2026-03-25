/**
 * Redis-backed distributed cache for hot data.
 * Reduces SQLite queries for frequently accessed data at 100k player scale.
 *
 * Usage:
 *   import { cache } from '@/lib/cache';
 *   const players = await cache.get('online_players', () => fetchPlayers(), 5000);
 */

import { cacheGet, cacheSet, cacheDelete, isConnected, getRedisInstance } from './redis';

// Convert ms TTL to seconds (minimum 1 second)
function msToSeconds(ttlMs: number): number {
	return Math.max(1, Math.ceil(ttlMs / 1000));
}

export const cache = {
	/**
	 * Get cached data or fetch fresh data.
	 * @param key Cache key
	 * @param fetcher Function to fetch data if not cached
	 * @param ttlMs Time-to-live in milliseconds (default 5s)
	 */
	async get<T>(key: string, fetcher: () => Promise<T>, ttlMs = 5000): Promise<T> {
		// Try to get from Redis first
		if (isConnected()) {
			try {
				const cached = await cacheGet<T>(key);
				if (cached !== null) {
					return cached;
				}
			} catch (err) {
				console.warn('[Cache] Redis get failed, falling back to fetcher:', err);
			}
		}

		// Fetch fresh data
		const data = await fetcher();

		// Store in Redis if connected
		if (isConnected()) {
			try {
				await cacheSet(key, data, msToSeconds(ttlMs));
			} catch (err) {
				console.warn('[Cache] Redis set failed:', err);
			}
		}

		return data;
	},

	/** Get cached data synchronously (returns null if miss) - not supported with Redis */
	getSync<T>(_key: string): T | null {
		// Redis does not support synchronous get, so we return null
		// The async get() method should be used instead
		return null;
	},

	/** Set cache entry manually */
	async set<T>(key: string, data: T, ttlMs = 5000): Promise<void> {
		if (!isConnected()) return;
		try {
			await cacheSet(key, data, msToSeconds(ttlMs));
		} catch (err) {
			console.warn('[Cache] Redis set failed:', err);
		}
	},

	/** Invalidate a cache key */
	async invalidate(key: string): Promise<void> {
		if (!isConnected()) return;
		try {
			await cacheDelete(key);
		} catch (err) {
			console.warn('[Cache] Redis delete failed:', err);
		}
	},

	/** Invalidate all keys matching a prefix */
	async invalidatePrefix(prefix: string): Promise<void> {
		if (!isConnected()) return;
		try {
			const client = getRedisInstance();
			let cursor = '0';
			const fullPrefix = `cache:${prefix}`;
			do {
				const [newCursor, keys] = await client.scan(
					cursor,
					'MATCH',
					`${fullPrefix}*`,
					'COUNT',
					100
				);
				cursor = newCursor;
				if (keys.length > 0) {
					await client.del(...keys);
				}
			} while (cursor !== '0');
		} catch (err) {
			console.warn('[Cache] Redis invalidatePrefix failed:', err);
		}
	},

	/** Clear entire cache */
	async clear(): Promise<void> {
		if (!isConnected()) return;
		try {
			const client = getRedisInstance();
			let cursor = '0';
			do {
				const [newCursor, keys] = await client.scan(
					cursor,
					'MATCH',
					'cache:*',
					'COUNT',
					100
				);
				cursor = newCursor;
				if (keys.length > 0) {
					await client.del(...keys);
				}
			} while (cursor !== '0');
		} catch (err) {
			console.warn('[Cache] Redis clear failed:', err);
		}
	},

	/** Get cache stats */
	async stats(): Promise<{ size: number; keys: string[] }> {
		if (!isConnected()) {
			return { size: 0, keys: [] };
		}
		try {
			const client = getRedisInstance();
			const keys: string[] = [];
			let cursor = '0';
			do {
				const [newCursor, foundKeys] = await client.scan(
					cursor,
					'MATCH',
					'cache:*',
					'COUNT',
					100
				);
				cursor = newCursor;
				keys.push(...foundKeys);
			} while (cursor !== '0');
			// Strip 'cache:' prefix from keys for consistency with old API
			return {
				size: keys.length,
				keys: keys.map((k) => k.replace(/^cache:/, '')),
			};
		} catch (err) {
			console.warn('[Cache] Redis stats failed:', err);
			return { size: 0, keys: [] };
		}
	},
};

// Cache key generators for consistent naming
export const CACHE_KEYS = {
	onlinePlayers: (serverId: string) => `online_players:${serverId}`,
	playerDetail: (name: string) => `player:${name}`,
	userProfile: (id: string) => `user:${id}`,
	serverList: () => 'server_list',
	storeItems: () => 'store_items',
	serverStats: () => 'server_stats',
	dbStatus: () => 'db_status',
};
