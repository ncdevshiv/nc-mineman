import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  try {
    const getJsonFile = (filename: string) => {
      const filePath = server.getSafePath(`/${filename}`);
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
      return [];
    };

    return NextResponse.json({
      ops: getJsonFile('ops.json'),
      whitelist: getJsonFile('whitelist.json'),
      bannedPlayers: getJsonFile('banned-players.json'),
      bannedIps: getJsonFile('banned-ips.json'),
      activity: server.playerActivity || []
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
    const { action, player } = await req.json();
    
    if (server.status === 'running') {
      server.sendCommand(`${action} ${player}`);
    } else {
      return NextResponse.json({ error: 'Server must be running to manage players' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
