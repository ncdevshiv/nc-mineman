import { NextRequest, NextResponse } from 'next/server';
import { destroySession, getAppUrl } from '@/lib/auth';

export async function GET(request: NextRequest) {
  await destroySession();
  // Use APP_URL instead of request origin — behind Cloudflare tunnel,
  // request.nextUrl.origin returns the internal localhost:3000
  const appUrl = getAppUrl() || 'https://hideoutsmp.com';
  return NextResponse.redirect(new URL('/', appUrl));
}
