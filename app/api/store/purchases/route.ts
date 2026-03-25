import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserPurchases, createPurchase, getStoreItems, addInventoryItem } from '@/lib/db-frontend';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const purchases = await getUserPurchases(session.id);
    return NextResponse.json(purchases);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const items = body.items || [];
    const storeItems = await getStoreItems();

    const purchaseIds = [];
    for (const cartItem of items) {
      const storeItem = storeItems.find((i: any) => i.id === cartItem.id);
      if (!storeItem) continue;

      const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const qty = cartItem.quantity || 1;
      const amount = storeItem.price * qty;

      await createPurchase({
        id,
        user_id: session.id,
        item_id: cartItem.id,
        item_name: storeItem.name,
        quantity: qty,
        amount,
      });

      const invId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      await addInventoryItem({
        id: invId,
        user_id: session.id,
        item_name: storeItem.name,
        item_type: storeItem.category?.toLowerCase() || 'item',
        quantity: qty,
        metadata: JSON.stringify(storeItem.metadata || {}),
        acquired_from: 'store_purchase',
      });

      purchaseIds.push(id);
    }

    return NextResponse.json({ success: true, purchases: purchaseIds });
  } catch {
    return NextResponse.json({ error: 'Purchase failed' }, { status: 500 });
  }
}
