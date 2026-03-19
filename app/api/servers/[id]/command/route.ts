import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { command } = await req.json();
  const server = nodeManager.getServer(id);

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  if (!command) {
    return NextResponse.json({ error: 'Command is required' }, { status: 400 });
  }

  await server.sendCommand(command);
  return NextResponse.json({ success: true });
}
