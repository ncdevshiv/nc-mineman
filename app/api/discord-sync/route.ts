import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/database';
import { getSession } from '@/lib/auth';
import { logPermissionChange } from '@/lib/permissions';

export async function GET() {
  try {
    const r = await sql('SELECT * FROM discord_role_mappings ORDER BY discord_role_name');
    return NextResponse.json(r[0]?.rows ?? []);
  } catch (error) {
    console.error('Get discord sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { discord_role_id, discord_role_name, site_role, sync_direction } = body;

    if (!discord_role_id || !site_role) {
      return NextResponse.json({ error: 'discord_role_id and site_role required' }, { status: 400 });
    }

    await sql({
      sql: `INSERT OR REPLACE INTO discord_role_mappings (discord_role_id, discord_role_name, site_role, sync_direction) VALUES (?, ?, ?, ?)`,
      args: [discord_role_id, discord_role_name || '', site_role, sync_direction || 'both']
    });
    await logPermissionChange(session.id, 'create_discord_sync', site_role);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Create discord sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
