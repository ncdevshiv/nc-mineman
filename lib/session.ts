import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getCookieName } from './site.config';

function getJwtSecretKey() {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    console.error('[SESSION] JWT_SECRET environment variable is not set. Session validation will fail.');
    return null;
  }
  return new TextEncoder().encode(JWT_SECRET);
}

export interface SessionUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'member';
  roles: string[];
  mc_username?: string | null;
  discord_username?: string | null;
  username?: string;
  avatarUrl?: string | null;
}

export async function getSession(): Promise<SessionUser | null> {
  const jwtSecretKey = getJwtSecretKey();
  if (!jwtSecretKey) {
    return null;
  }
  
  try {
    const cookieStore = await cookies();
    const cookieName = getCookieName();
    const token = cookieStore.get(cookieName)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, jwtSecretKey);
    return {
      id: payload.sub as string,
      email: payload.email as string,
      firstName: payload.firstName as string | undefined,
      lastName: payload.lastName as string | undefined,
      role: payload.role as 'admin' | 'member',
      roles: (payload.roles as string[]) || ['member'],
      mc_username: payload.mc_username as string | undefined | null,
      discord_username: payload.discord_username as string | undefined | null,
      username: payload.username as string | undefined,
      avatarUrl: payload.avatarUrl as string | undefined | null,
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error('[SESSION] Token verification failed:', error.message);
    }
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  const cookieName = getCookieName();
  cookieStore.delete(cookieName);
}
