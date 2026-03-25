import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserInventory, addInventoryItem, transferInventoryItem } from '@/lib/db-frontend';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const inventory = await getUserInventory(session.id);
    return NextResponse.json(inventory);
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
    await addInventoryItem({
      id,
      user_id: session.id,
      item_name: body.item_name,
      item_type: body.item_type || 'item',
      quantity: body.quantity || 1,
      metadata: body.metadata || '{}',
      acquired_from: body.acquired_from || '',
    });
    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    if (body.action === 'transfer') {
      await transferInventoryItem(body.item_id, session.id, body.to_user_id, body.quantity || 1);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Transfer failed' }, { status: 500 });
  }
}
