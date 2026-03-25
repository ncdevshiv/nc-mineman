import { Webhooks } from '@polar-sh/nextjs';
import { sql } from '@/lib/database';

export const POST = Webhooks({
	webhookSecret: process.env.POLAR_WEBHOOK_SECRET || '',
	onCheckoutCreated: async (payload) => {
		console.log('[Polar] Checkout created:', payload.data.id);
	},
	onCheckoutUpdated: async (payload) => {
		const checkout = payload.data;
		console.log('[Polar] Checkout updated:', checkout.id, checkout.status);
		if (checkout.status === 'confirmed') {
			try {
				await sql(`INSERT INTO purchases (id, user_id, items, total, status, created_at) VALUES ('${checkout.id}', '${checkout.customerId || 'unknown'}', '${JSON.stringify(checkout.products)}', ${checkout.totalAmount || 0}, 'completed', datetime('now'))`);
			} catch (err) {
				console.error('[Polar] Failed to record purchase:', err);
			}
		}
	},
	onOrderCreated: async (payload) => {
		console.log('[Polar] Order created:', payload.data.id);
	},
	onOrderUpdated: async (payload) => {
		console.log('[Polar] Order updated:', payload.data.id, payload.data.status);
	},
});
