import { Checkout } from '@polar-sh/nextjs';
import { isPolarConfigured, getPolarServer } from '@/lib/polar';

export const GET = Checkout({
	accessToken: process.env.POLAR_ACCESS_TOKEN || '',
	successUrl: `${process.env.APP_URL || 'http://localhost:3000'}/store?success=true`,
	returnUrl: `${process.env.APP_URL || 'http://localhost:3000'}/store`,
	server: (process.env.POLAR_SERVER as 'sandbox' | 'production') || 'sandbox',
	theme: 'dark',
});
