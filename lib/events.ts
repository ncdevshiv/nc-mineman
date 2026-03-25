/**
 * Event-driven real-time system.
 * Replaces polling with push-based updates for 100k player scale.
 *
 * Usage:
 *   import { eventBus } from '@/lib/events';
 *   eventBus.emit('player_update', { name: 'Steve', ... });
 *
 *   // In SSE endpoint:
 *   eventBus.subscribe('player_update', callback);
 */

import { publish, subscribe as redisSubscribe } from './redis';

type EventCallback = (data: any) => void;

class EventBus {
	private listeners = new Map<string, Set<EventCallback>>();
	private history = new Map<string, any[]>();
	private maxHistory = 100;
	private redisSubscribedEvents = new Set<string>();

	/** Subscribe to an event type */
	subscribe(event: string, callback: EventCallback): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(callback);

		// Also subscribe to Redis channel for cross-instance broadcasting
		// Use singleton pattern - only subscribe once per event
		if (!this.redisSubscribedEvents.has(event)) {
			this.redisSubscribedEvents.add(event);
			// Re-emit Redis messages to local subscribers
			redisSubscribe(event, (data: unknown) => {
				this.emit(event, data);
			});
		}

		// Return unsubscribe function
		return () => {
			this.listeners.get(event)?.delete(callback);
		};
	}

	/** Emit an event to all subscribers */
	emit(event: string, data: any): void {
		// Store in history
		if (!this.history.has(event)) {
			this.history.set(event, []);
		}
		const hist = this.history.get(event)!;
		hist.push({ ...data, _timestamp: Date.now() });
		if (hist.length > this.maxHistory) hist.shift();

		// Notify local subscribers
		const callbacks = this.listeners.get(event);
		if (callbacks) {
			for (const cb of callbacks) {
				try { cb(data); } catch {}
			}
		}

		// Publish to Redis for cross-instance broadcasting
		// Errors are handled internally by redis.ts
		publish(event, data).catch((err) => {
			console.error('[EventBus] Failed to publish to Redis:', err);
		});
	}

	/** Get recent event history */
	getHistory(event: string, limit = 20): any[] {
		const hist = this.history.get(event) || [];
		return hist.slice(-limit);
	}

	/** Get subscriber count for an event */
	subscriberCount(event: string): number {
		return this.listeners.get(event)?.size ?? 0;
	}
}

export const eventBus = new EventBus();

// Event type definitions
export const EVENTS = {
	PLAYER_UPDATE: 'player_update',
	PLAYER_JOIN: 'player_join',
	PLAYER_QUIT: 'player_quit',
	SERVER_UPDATE: 'server_update',
	ACTIVITY: 'activity',
	INVENTORY_UPDATE: 'inventory_update',
	CHAT: 'chat',
	MODERATION: 'moderation',
	AUCTION_BID: 'auction_bid',
	NOTIFICATION: 'notification',
} as const;
