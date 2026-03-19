import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (server) server.stop();
  return NextResponse.json({ success: true });
}
