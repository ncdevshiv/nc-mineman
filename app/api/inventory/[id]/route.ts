import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { deleteInventoryItem, updateInventoryItemQuantity, setInventoryItemFrozen, setInventoryItemHidden, getFullInventory } from '@/lib/db-frontend';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: userId } = await params;
  const isMod = session.roles?.some(r => ['owner', 'admin', 'god', 'helper'].includes(r));
  const isOwn = session.id === userId;

  if (!isOwn && !isMod) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const inventory = isMod ? await getFullInventory(userId) : await getFullInventory(userId);
    return NextResponse.json(inventory);
  } catch {
    return NextResponse.json([]);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isMod = session.roles?.some(r => ['owner', 'admin', 'god', 'helper'].includes(r));
  if (!isMod) return NextResponse.json({ error: 'Moderator access required' }, { status: 403 });

  const { id: itemId } = await params;
  try {
    const body = await request.json();
    if (body.action === 'freeze') {
      await setInventoryItemFrozen(itemId, body.frozen);
    } else if (body.action === 'hide') {
      await setInventoryItemHidden(itemId, body.hidden);
    } else if (body.action === 'delete') {
      await deleteInventoryItem(itemId);
    } else if (body.action === 'update_quantity') {
      await updateInventoryItemQuantity(itemId, body.quantity);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
