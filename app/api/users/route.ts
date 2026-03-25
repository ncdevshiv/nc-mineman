import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getAllUsers } from '@/lib/db-frontend';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const users = await getAllUsers();
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
