import { NextRequest, NextResponse } from 'next/server';
import { getClientId, getClientSecret, createSession, getAppUrl } from '@/lib/auth';
import { upsertSiteUser, getSiteUser } from '@/lib/db-frontend';
import {
  getDiscordUser,
  getUserDiscordRoles,
  mapDiscordRolesToSiteRoles,
  isGuildMember,
  verifyGuildMembershipWithToken,
  getGuildRoles,
} from '@/lib/discord';

function getDiscordGuildName(): string {
  return process.env.DISCORD_GUILD_NAME || 'the Discord server';
}

function getDiscordInviteUrl(): string {
  return process.env.DISCORD_INVITE_URL || 'https://discord.gg';
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  // Always use APP_URL — behind Cloudflare tunnel, request origin/host
  // points to the internal service, not the public URL.
  const appUrl = getAppUrl() || 'https://hideoutsmp.com';
  const redirectUri = `${appUrl}/api/auth/callback`;

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', appUrl));
  }

  try {
    const clientId = getClientId();
    const clientSecret = getClientSecret();

    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    // Fetch full Discord user data with avatar and guild member info
    const { user: discordUser, avatarUrl, guildMember } = await getDiscordUser(access_token);

    // Check guild membership (enforce Elsahideout membership)
    const isMember = guildMember !== null;

    if (!isMember) {
      // Try to verify with token-based check
      const memberVerified = await verifyGuildMembershipWithToken(discordUser.id, access_token);
      if (!memberVerified) {
        return NextResponse.redirect(
          new URL(
            `/?error=not_in_guild&guild=${encodeURIComponent(getDiscordGuildName())}&invite=${encodeURIComponent(getDiscordInviteUrl())}`,
            appUrl
          )
        );
      }
    }

    // Get user's Discord roles
    const discordRoleIds = guildMember?.roles || [];
    const discordRoles = await getUserDiscordRoles(discordUser.id);

    // Map Discord roles to site roles
    const siteRoles = await mapDiscordRolesToSiteRoles(discordRoles);

    // Build discord username (handle new Discord username system)
    const discordUsername = discordUser.global_name
      ? `@${discordUser.global_name}`
      : `${discordUser.username}#${discordUser.discriminator || '0'}`;

    // Get existing user to preserve Minecraft username if set
    const existingUser = await getSiteUser(discordUser.id);
    const mcUsername = existingUser?.mc_username || null;

    // Upsert user with all data including avatar
    await upsertSiteUser({
      id: discordUser.id,
      email: discordUser.email || `${discordUser.username}@discord.local`,
      discord_username: discordUsername,
      mc_username: mcUsername,
      roles: siteRoles,
      avatar_url: avatarUrl,
    });

    // Create session with full profile
    const sessionUser = await createSession({
      id: discordUser.id,
      email: discordUser.email || `${discordUser.username}@discord.local`,
      firstName: discordUser.global_name || discordUser.username,
      lastName: '',
      username: discordUser.username,
      discord_username: discordUsername,
      roles: siteRoles,
      avatarUrl,
    });

    // Redirect based on whether Minecraft username is set
    const redirectUrl = sessionUser.mc_username ? '/' : '/signup';
    return NextResponse.redirect(new URL(redirectUrl, appUrl));
  } catch (error: any) {
    console.error('Auth error:', error);
    const details = encodeURIComponent(error.message || String(error));
    return NextResponse.redirect(
      new URL(`/?error=auth_failed&details=${details}`, appUrl)
    );
  }
}
