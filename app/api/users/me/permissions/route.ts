import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRolePermissions } from '@/lib/permissions';
import { loadCustomRolePermissions } from '@/lib/permissions';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allPerms = new Set<string>();

    // Load preset role permissions
    for (const role of session.roles || []) {
      const perms = await getRolePermissions(role);
      for (const p of perms) allPerms.add(p);
    }

    // Load custom role permissions
    const customPerms = await loadCustomRolePermissions(session.id);
    for (const p of customPerms) allPerms.add(p);

    return NextResponse.json(Array.from(allPerms));
  } catch (error) {
    console.error('Get user permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
