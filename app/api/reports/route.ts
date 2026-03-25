import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createReport, getReports, updateReportStatus } from '@/lib/db-frontend';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isMod = session.roles?.some(r => ['owner', 'admin', 'god', 'helper'].includes(r));
  if (!isMod) return NextResponse.json({ error: 'Moderator access required' }, { status: 403 });

  try {
    const reports = await getReports();
    return NextResponse.json(reports);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    if (body.reported_id === session.id) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });
    }
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await createReport({
      id,
      reporter_id: session.id,
      reported_id: body.reported_id,
      reason: body.reason,
      description: body.description || '',
    });
    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isMod = session.roles?.some(r => ['owner', 'admin', 'god', 'helper'].includes(r));
  if (!isMod) return NextResponse.json({ error: 'Moderator access required' }, { status: 403 });

  try {
    const body = await request.json();
    await updateReportStatus(body.id, body.status, session.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}
