import { NextResponse } from 'next/server';
import { getPermissionsByCategory } from '@/lib/permissions';

export async function GET() {
  try {
    const perms = await getPermissionsByCategory();
    return NextResponse.json(perms);
  } catch (error) {
    console.error('Get permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
