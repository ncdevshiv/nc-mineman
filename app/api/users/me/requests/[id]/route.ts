import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSocialRequest, updateSocialRequestStatus, addFriend } from '@/lib/db-frontend';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const req = await getSocialRequest(id);
    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    // Allow cancel/withdraw if the current user is the sender
    const isCancel = body.status === 'withdrawn';
    if (isCancel && req.from_id !== session.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    // Allow accept/reject only to the recipient
    if (!isCancel && req.to_id !== session.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await updateSocialRequestStatus(id, body.status);

    if (body.status === 'accepted' && req.type === 'friend') {
      await addFriend(req.from_id, req.to_id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
}
