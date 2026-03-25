import { NextRequest, NextResponse } from 'next/server';
import { getCustomRoles, getCustomRole, createCustomRole } from '@/lib/db-frontend';
import { getSession } from '@/lib/auth';
import { logPermissionChange } from '@/lib/permissions';

export async function GET() {
  try {
    const roles = await getCustomRoles();
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Get custom roles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { name, color, description } = body;

    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 30) {
      return NextResponse.json({ error: 'Invalid name (2-30 chars)' }, { status: 400 });
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json({ error: 'Invalid color (must be hex like #ff0000)' }, { status: 400 });
    }

    // Check for duplicate role name
    const existing = await getCustomRole(name);
    if (existing) {
      return NextResponse.json({ error: 'Role name already exists' }, { status: 409 });
    }

    await createCustomRole({ name, color, description: description || '' });
    await logPermissionChange(session.id, 'create_custom_role', name);

    return NextResponse.json({ success: true, name }, { status: 201 });
  } catch (error) {
    console.error('Create custom role error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
