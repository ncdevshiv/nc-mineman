import { requireAdmin } from '@/lib/api-auth';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getStoreItems, upsertStoreItem, deleteStoreItem } from '@/lib/db-frontend';

// GET is public - anyone can browse store items
export async function GET() {
  try {
    const items = await getStoreItems();
    // Only return active items to public
    const activeItems = items.filter((item: any) => item.is_active !== false);
    return NextResponse.json(activeItems);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch store items' }, { status: 500 });
  }
}

// POST requires admin - manage store items
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const id = body.id || Math.random().toString(36).substring(7);
    
    await upsertStoreItem({
      id,
      name: body.name,
      price: Number(body.price),
      category: body.category || 'General',
      display_image: body.display_image || '',
      is_active: body.is_active !== false,
      metadata: body.metadata || {}
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save store item' }, { status: 500 });
  }
}

// DELETE requires admin - remove store items
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  try {
    await deleteStoreItem(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete store item' }, { status: 500 });
  }
}
