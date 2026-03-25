/**
 * Polar.sh client helper for server-side operations.
 * Uses the Polar SDK for API calls.
 */

import { Polar } from '@polar-sh/sdk';

let polarClient: Polar | null = null;

export function getPolarClient(): Polar {
	if (!polarClient) {
		const accessToken = process.env.POLAR_ACCESS_TOKEN;
		if (!accessToken) {
			throw new Error('POLAR_ACCESS_TOKEN is not set. Configure it in .env.local');
		}
		const isSandbox = process.env.POLAR_SERVER === 'sandbox';
		polarClient = new Polar({
			accessToken,
			server: isSandbox ? 'sandbox' : 'production',
		});
	}
	return polarClient;
}

export function isPolarConfigured(): boolean {
	return !!process.env.POLAR_ACCESS_TOKEN;
}

export function getPolarServer(): string {
	return process.env.POLAR_SERVER || 'production';
}
