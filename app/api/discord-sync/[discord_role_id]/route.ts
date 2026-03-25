import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/database';
import { getSession } from '@/lib/auth';
import { logPermissionChange } from '@/lib/permissions';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ discord_role_id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { discord_role_id } = await params;
    await sql({ sql: `DELETE FROM discord_role_mappings WHERE discord_role_id = ?`, args: [discord_role_id] });
    await logPermissionChange(session.id, 'delete_discord_sync', undefined);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete discord sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
