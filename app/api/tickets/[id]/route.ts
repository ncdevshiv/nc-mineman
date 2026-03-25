import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getTicketMessages, addTicketMessage, updateTicketStatus, getTicket } from '@/lib/db-frontend';

export async function GET(request: Request, context: any) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const urlParts = request.url.split('/');
  const ticketId = urlParts[urlParts.length - 1];

  try {
    const ticket = await getTicket(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const isOwner = ticket.user_id === session.id;
    const isStaff = session.roles.some(r => ['owner', 'admin', 'god', 'helper'].includes(r));
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await getTicketMessages(ticketId);
    return NextResponse.json({ messages, ticket });
  } catch (error) {
    console.error('[API] Error fetching ticket:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: Request, context: any) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const urlParts = request.url.split('/');
  const ticketId = urlParts[urlParts.length - 1];

  try {
    const body = await request.json();
    if (!body.message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    const ticket = await getTicket(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const isOwner = ticket.user_id === session.id;
    const isStaff = session.roles.some(r => ['owner', 'admin', 'god', 'helper'].includes(r));
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = 'MSG-' + Math.random().toString(36).substring(2, 10);
    await addTicketMessage({
      id,
      ticket_id: ticketId,
      sender_id: session.id,
      message: body.message
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('[API] Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: any) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const urlParts = request.url.split('/');
  const ticketId = urlParts[urlParts.length - 1];

  const isStaff = session.roles.some(r => ['owner', 'admin', 'god', 'helper'].includes(r));
  if (!isStaff) {
    return NextResponse.json({ error: 'Forbidden - staff only' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { status } = body;

    if (!['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const ticket = await getTicket(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    await updateTicketStatus(ticketId, status);
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('[API] Error updating ticket:', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}
