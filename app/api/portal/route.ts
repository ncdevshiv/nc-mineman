import { CustomerPortal } from '@polar-sh/nextjs';
import { getSession } from '@/lib/auth';
import { NextResponse, NextRequest } from 'next/server';

export const GET = async (request: NextRequest) => {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
	}

	const handler = CustomerPortal({
		accessToken: process.env.POLAR_ACCESS_TOKEN || '',
		server: (process.env.POLAR_SERVER as 'sandbox' | 'production') || 'sandbox',
		getCustomerId: async () => session.id,
	});

	return handler(request);
};
