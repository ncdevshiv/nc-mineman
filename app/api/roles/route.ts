import { NextResponse } from 'next/server';
import { getAllRoleDefinitions } from '@/lib/permissions';

export async function GET() {
  try {
    const roles = await getAllRoleDefinitions();
    // Convert Set to Array for JSON serialization
    const serializable = roles.map(r => ({ ...r, permissions: Array.from(r.permissions) }));
    return NextResponse.json(serializable);
  } catch (error) {
    console.error('Get roles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
