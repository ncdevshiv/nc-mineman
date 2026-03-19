import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const server = nodeManager.getServer(id);

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: server.config.id,
    name: server.config.name,
    software: server.config.software,
    version: server.config.version,
    ram: server.config.ram,
    cpuLimit: server.config.cpuLimit,
    status: server.status,
    tunnelStatus: server.tunnelStatus,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const server = nodeManager.getServer(id);

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  try {
    const deleted = nodeManager.deleteServer(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
