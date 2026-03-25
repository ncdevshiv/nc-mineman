import { NextResponse } from 'next/server';
import { requireMod } from '@/lib/api-auth';
import { getModerationActions, createModerationAction, deactivateModerationAction, unbanUser } from '@/lib/db-frontend';

export async function GET() {
  const auth = await requireMod();
  if (auth instanceof NextResponse) return auth;

  try {
    const actions = await getModerationActions();
    return NextResponse.json(actions);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const auth = await requireMod();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);

    const validActions = ['ban', 'unban', 'kick', 'mute', 'freeze', 'jail', 'slap', 'timeout'];
    if (!validActions.includes(body.action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await createModerationAction({
      id,
      target_user_id: body.target_user_id,
      performed_by: auth.user.id,
      action: body.action,
      reason: body.reason || '',
      duration_seconds: body.duration_seconds,
      metadata: body.metadata || '{}',
    });

    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: 'Failed to create moderation action' }, { status: 500 });
  }
}
