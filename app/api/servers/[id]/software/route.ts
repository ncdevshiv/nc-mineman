import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { url } = await req.json();
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  try {
    await server.downloadSoftware(url);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
