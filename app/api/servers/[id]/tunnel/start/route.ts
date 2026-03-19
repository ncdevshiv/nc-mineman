import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  try {
    const config = await req.json();
    
    if (!config.serverAddr || !config.serverPort || !config.tunnelPort || !config.authToken) {
      return NextResponse.json({ 
        error: 'Missing required fields: serverAddr, serverPort, tunnelPort, authToken' 
      }, { status: 400 });
    }

    await server.startTunnel({
      serverAddr: config.serverAddr,
      serverPort: parseInt(config.serverPort),
      tunnelPort: parseInt(config.tunnelPort),
      authToken: config.authToken,
      subdomain: config.subdomain,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
