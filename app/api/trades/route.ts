import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTrades, createTrade } from '@/lib/db-frontend';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const trades = await getTrades();
    return NextResponse.json(trades);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await createTrade({
      id,
      seller_id: session.id,
      seller_name: session.mc_username || session.email,
      type: body.type || 'in-game',
      item_name: body.item_name,
      item_description: body.item_description || '',
      asking_price: body.asking_price,
    });
    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 });
  }
}
