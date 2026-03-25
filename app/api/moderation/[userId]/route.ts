import { NextResponse } from 'next/server';
import { requireMod } from '@/lib/api-auth';
import { getModerationActions, getActiveModerationActions, deactivateModerationAction, unbanUser } from '@/lib/db-frontend';

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireMod();
  if (auth instanceof NextResponse) return auth;

  const { userId } = await params;
  try {
    const actions = await getModerationActions(userId);
    const active = await getActiveModerationActions(userId);
    return NextResponse.json({ actions, active });
  } catch {
    return NextResponse.json({ actions: [], active: [] });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireMod();
  if (auth instanceof NextResponse) return auth;

  const { userId } = await params;
  try {
    const body = await request.json();
    if (body.action === 'unban') {
      await unbanUser(userId);
    } else if (body.action === 'deactivate' && body.moderation_id) {
      await deactivateModerationAction(body.moderation_id);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update moderation' }, { status: 500 });
  }
}
