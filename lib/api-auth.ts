import { NextResponse } from 'next/server';
import { getSession, SessionUser } from '@/lib/auth';

export async function requireAdmin(): Promise<{ user: SessionUser } | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const isAdmin = session.role === 'admin' || (session.roles && session.roles.some(r => ['owner', 'admin'].includes(r)));
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  return { user: session };
}

export async function requireMod(): Promise<{ user: SessionUser } | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const isMod = session.role === 'admin' || (session.roles && session.roles.some(r => ['owner', 'admin', 'god', 'helper'].includes(r)));
  if (!isMod) {
    return NextResponse.json({ error: 'Moderator access required' }, { status: 403 });
  }
  return { user: session };
}

export async function requireAuth(): Promise<{ user: SessionUser } | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return { user: session };
}

export async function requireGod(): Promise<{ user: SessionUser } | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const isGod = session.role === 'admin' || (session.roles && session.roles.some(r => ['owner', 'admin', 'god'].includes(r)));
  if (!isGod) {
    return NextResponse.json({ error: 'God view access required' }, { status: 403 });
  }
  return { user: session };
}

export function hasRole(user: SessionUser, roles: string[]): boolean {
  if (user.role === 'admin') return true;
  return roles.some(r => user.roles?.includes(r));
}

export { hasPermission, hasAnyPermission } from './permissions';
