import { NextRequest, NextResponse } from 'next/server';
import { updateRolePermissions, getRoleDefinition, logPermissionChange, resetRoleToDefaults } from '@/lib/permissions';
import { getSession } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { role } = await params;
    if (['owner'].includes(role)) return NextResponse.json({ error: 'Cannot modify owner role' }, { status: 400 });

    const body = await request.json();
    const { permissions } = body; // Record<string, boolean>

    if (!permissions || typeof permissions !== 'object') {
      return NextResponse.json({ error: 'Invalid permissions object' }, { status: 400 });
    }

    await updateRolePermissions(role, permissions);
    await logPermissionChange(session.id, 'update_role_permissions', role);

    const updated = await getRoleDefinition(role);
    return NextResponse.json({ ...updated, permissions: Array.from(updated!.permissions) });
  } catch (error) {
    console.error('Update role permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { role } = await params;
    if (role === 'owner') return NextResponse.json({ error: 'Cannot reset owner role' }, { status: 400 });

    await resetRoleToDefaults(role);
    await logPermissionChange(session.id, 'reset_role_to_defaults', role);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset role to defaults error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
