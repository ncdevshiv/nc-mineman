import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/database';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.roles?.includes('admin') && !session.roles?.includes('owner')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 100);
    const offset = parseInt(searchParams.get('offset') || '0') || 0;

    const r = await sql({
      sql: `SELECT * FROM permission_audit_log ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      args: [limit, offset]
    });

    return NextResponse.json(r[0]?.rows ?? []);
  } catch (error) {
    console.error('Audit log GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
