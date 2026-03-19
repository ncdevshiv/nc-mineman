import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import * as stdb from '@/lib/spacetimedb-data';
import fs from 'fs';
import path from 'path';

const STDB_ENABLED = process.env.SPACETIMEDB_ENABLED !== 'false';

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

    if (STDB_ENABLED) {
      try {
        switch (action) {
          case 'op':
            await stdb.setPlayerOp(id, player, true, 4);
            await stdb.upsertPlayer({ server_id: id, name: player, is_op: true, permission_level: 4 });
            break;
          case 'deop':
            await stdb.setPlayerOp(id, player, false, 0);
            await stdb.upsertPlayer({ server_id: id, name: player, is_op: false, permission_level: 0 });
            break;
          case 'ban':
            await stdb.setPlayerBan(id, player, true, 'Banned by operator');
            await stdb.upsertPlayer({ server_id: id, name: player, is_banned: true, ban_reason: 'Banned by operator' });
            break;
          case 'pardon':
            await stdb.setPlayerBan(id, player, false);
            await stdb.upsertPlayer({ server_id: id, name: player, is_banned: false });
            break;
          case 'whitelist add':
            await stdb.setPlayerWhitelist(id, player, true);
            await stdb.upsertPlayer({ server_id: id, name: player, is_whitelisted: true });
            break;
          case 'whitelist remove':
            await stdb.setPlayerWhitelist(id, player, false);
            await stdb.upsertPlayer({ server_id: id, name: player, is_whitelisted: false });
            break;
          case 'kick':
            await stdb.setPlayerOnline(id, player, '', false);
            break;
        }
      } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
