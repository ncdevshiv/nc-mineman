import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import fs from 'fs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  try {
    const propsPath = server.getSafePath('/server.properties');
    let properties = '';
    if (fs.existsSync(propsPath)) {
      properties = fs.readFileSync(propsPath, 'utf-8');
    }

    return NextResponse.json({
      config: server.config,
      properties
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  try {
    const { config, properties } = await req.json();
    
    if (config) {
      server.updateConfig(config);
    }

    if (properties !== undefined) {
      const propsPath = server.getSafePath('/server.properties');
      fs.writeFileSync(propsPath, properties, 'utf-8');
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
