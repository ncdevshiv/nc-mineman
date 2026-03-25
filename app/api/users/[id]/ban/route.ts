import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { banUser } from '@/lib/db-frontend';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const body = await request.json();
    const banId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await banUser({
      id: banId,
      user_id: id,
      reason: body.reason || '',
      duration: body.duration || '7d',
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to ban user' }, { status: 500 });
  }
}
