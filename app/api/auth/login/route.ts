import { NextResponse, NextRequest } from 'next/server';
import { getClientId, getAppUrl } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check if this is an RSC prefetch request
    const isRscRequest = request.headers.get('rsc') === '1' ||
      request.nextUrl.searchParams.has('_rsc');

    const clientId = getClientId();
    // Always use APP_URL for redirect URI — behind Cloudflare tunnel,
    // request origin/host points to internal service.
    const appUrl = getAppUrl() || 'https://hideoutsmp.com';
    const redirectUri = `${appUrl}/api/auth/callback`;

    // Full OAuth scopes for Discord
    const scopes = [
      'identify',
      'email',
      'guilds',
      'guilds.members.read',
      'role_connections.write',
    ].join(' ');

    const searchParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
    });

    const authorizationUrl = `https://discord.com/oauth2/authorize?${searchParams.toString()}`;

    if (isRscRequest) {
      return NextResponse.json({ url: authorizationUrl });
    }

    return NextResponse.redirect(authorizationUrl);
  } catch (error: any) {
    const appUrl = getAppUrl() || 'https://hideoutsmp.com';
    return NextResponse.redirect(new URL('/?error=login_failed', appUrl));
  }
}
