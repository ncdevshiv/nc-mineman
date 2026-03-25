import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuction, getAuctions, placeBid } from '@/lib/db-frontend';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;

  try {
    const auctions = await getAuctions(status);
    return NextResponse.json(auctions);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    if (body.action === 'bid') {
      await placeBid(body.auction_id, session.id, session.mc_username || session.email, Number(body.amount));
      return NextResponse.json({ success: true });
    }

    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await createAuction({
      id,
      seller_id: session.id,
      seller_name: session.mc_username || session.email,
      item_name: body.item_name,
      item_description: body.item_description || '',
      starting_price: Number(body.starting_price),
      ends_at: body.ends_at,
    });
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create auction' }, { status: 500 });
  }
}
