import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getUserTickets, getAllTickets, createTicket } from '@/lib/db-frontend';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';

    let tickets = [];
    if (all && session.roles.some(r => ['admin', 'owner', 'helper'].includes(r))) {
      tickets = await getAllTickets();
    } else {
      tickets = await getUserTickets(session.id);
    }
    
    return NextResponse.json(tickets);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

    const id = 'TKT-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    await createTicket({
      id,
      user_id: session.id,
      title: body.title
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
