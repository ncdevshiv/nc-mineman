import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getCookieName } from './site.config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[FATAL] Required environment variable ${name} is not set. Cannot start application.`);
  }
  return value;
}

const clientId = requireEnv('DISCORD_CLIENT_ID');
const clientSecret = requireEnv('DISCORD_CLIENT_SECRET');
const redirectUri = requireEnv('DISCORD_REDIRECT_URI');
const jwtSecret = new TextEncoder().encode(requireEnv('JWT_SECRET'));
const adminUsernames = requireEnv('ADMIN_USERNAMES').split(',').map(u => u.trim().toLowerCase());
const appUrl = requireEnv('APP_URL');

import { SessionUser } from './session';
export type { SessionUser };

export function getClientId() {
  return clientId;
}

export function getClientSecret() {
  return clientSecret;
}

export function getRedirectUri() {
  return redirectUri;
}

export function getAppUrl() {
  return appUrl;
}

function resolveRole(username: string): 'admin' | 'member' {
  if (adminUsernames.includes(username.toLowerCase())) return 'admin';
  return 'member';
}

const ensureDbUser = async (profile: any, fallbackRole: string) => {
  try {
    const { upsertSiteUser, getSiteUser } = await import('./db-frontend');
    
    let dbUser = await getSiteUser(profile.id);
    if (!dbUser) {
      // If Admin email, pre-fill roles with 'admin' and 'owner' logic
      let initialRoles = ['member'];
      if (fallbackRole === 'admin') initialRoles = ['owner', 'admin', 'god', 'helper', 'member'];
      
      await upsertSiteUser({
        id: profile.id,
        email: profile.email,
        roles: initialRoles
      });
      dbUser = await getSiteUser(profile.id);
    } else if (fallbackRole === 'admin') {
      // Ensure existing admin users always have full admin roles
      const requiredRoles = ['owner', 'admin', 'god', 'helper', 'member'];
      const currentRoles = dbUser.roles || [];
      const hasAllRoles = requiredRoles.every(r => currentRoles.includes(r));
      if (!hasAllRoles) {
        await upsertSiteUser({
          id: profile.id,
          email: profile.email,
          roles: [...new Set([...currentRoles, ...requiredRoles])]
        });
        dbUser = await getSiteUser(profile.id);
      }
    }
    return dbUser;
  } catch (err: any) {
    console.error('[AUTH WARNING] Database is offline or failed to connect:', err.message);
    // Graceful fallback if database is dead so the user can still log in
    let initialRoles = ['member'];
    if (fallbackRole === 'admin') initialRoles = ['owner', 'admin', 'god', 'helper', 'member'];
    return { roles: initialRoles, mc_username: null };
  }
};

export async function createSession(profile: {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  mc_username?: string;
  discord_username?: string;
  roles?: string[];
  avatarUrl?: string | null;
}) {
  const resolvedRole = profile.roles?.includes('admin') ? 'admin' : resolveRole(profile.username || '');
  const dbUser = await ensureDbUser(profile, resolvedRole);
  const cookieName = getCookieName();

  // Build the roles array: Discord OAuth roles take precedence (if set).
  // Otherwise fall back to DB roles. If this is a first login, ensure
  // admin usernames get their full admin role set.
  let tokenRoles = profile.roles;
  if (!tokenRoles || tokenRoles.length === 0) {
    tokenRoles = dbUser?.roles || ['member'];
    // Admin usernames always get their full role set
    if (resolvedRole === 'admin' && !tokenRoles.includes('admin')) {
      tokenRoles = ['owner', 'admin', 'god', 'helper', 'member'];
      // Persist the admin roles to DB on next login
      const { upsertSiteUser } = await import('./db-frontend');
      await upsertSiteUser({ id: profile.id, email: profile.email, roles: tokenRoles });
    }
  }

  const token = await new SignJWT({
    sub: profile.id,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    role: resolvedRole,
    roles: tokenRoles,
    mc_username: profile.mc_username || dbUser?.mc_username || undefined,
    discord_username: profile.discord_username || (dbUser as any)?.discord_username || undefined,
    username: profile.username,
    avatarUrl: profile.avatarUrl || (dbUser && 'avatar_url' in dbUser ? dbUser.avatar_url : undefined),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(jwtSecret);

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return { ...profile, role: resolvedRole, avatarUrl: profile.avatarUrl } as SessionUser;
}

export { getSession, destroySession } from './session';
