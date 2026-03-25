import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { updateUserRoles } from '@/lib/db-frontend';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const body = await request.json();
    await updateUserRoles(id, body.roles || []);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update roles' }, { status: 500 });
  }
}
