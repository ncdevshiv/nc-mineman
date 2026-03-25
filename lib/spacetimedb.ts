/**
 * Database manager — previously managed SpacetimeDB process, now wraps bun:sqlite.
 * This module is imported by server-manager.ts and other legacy code paths.
 * All actual database operations go through database.ts.
 */

import { initDatabase } from './database';

let _initialized = false;

export interface DatabaseStatus {
	running: boolean;
	type: string;
	engine: string;
}

export const databaseManager = {
	get isRunning() { return _initialized; },
	get baseUrl() { return 'sqlite://embedded'; },

	async ensureRunning(): Promise<boolean> {
		if (_initialized) return true;
		try {
			const ok = await initDatabase();
			if (ok) _initialized = true;
			return ok;
		} catch {
			return false;
		}
	},

	getStatus(): DatabaseStatus {
		return {
			running: _initialized,
			type: 'sqlite',
			engine: 'bun:sqlite',
		};
	},

	getLogs(): string[] {
		return [];
	},
};

// Legacy export for backward compatibility
export const spacetimeDB = databaseManager;
