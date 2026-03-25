import { NextRequest, NextResponse } from 'next/server';
import { updateCustomRole, deleteCustomRole } from '@/lib/db-frontend';
import { getSession } from '@/lib/auth';
import { logPermissionChange } from '@/lib/permissions';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name } = await params;
  const body = await request.json();
  const { color, description, is_active } = body;

  await updateCustomRole(name, { color, description, is_active });
  await logPermissionChange(session.id, 'update_custom_role', name);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name } = await params;
  await deleteCustomRole(name);
  await logPermissionChange(session.id, 'delete_custom_role', name);

  return NextResponse.json({ success: true });
}
