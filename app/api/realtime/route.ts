import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/database';
import { nodeManager } from '@/lib/server-manager';
import { eventBus, EVENTS } from '@/lib/events';
import siteConfig from '@/lib/site.config';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ServerSnapshot {
  id: string;
  name: string;
  status: string;
  cpu: number;
  ram: number;
  players: number;
  tps: number;
  playerList: string[];
}

interface DashboardSnapshot {
  timestamp: string;
  type: 'snapshot' | 'event';
  event?: string;
  data?: any;
  servers: ServerSnapshot[];
  totalPlayers: number;
  totalServers: number;
}

async function getSnapshot(): Promise<DashboardSnapshot> {
  const cached = cache.getSync<DashboardSnapshot>('realtime_snapshot');
  if (cached) return cached;

  const servers: ServerSnapshot[] = [];
  for (const [id, instance] of nodeManager.servers) {
    const latestMetric = instance.metrics.length > 0
      ? instance.metrics[instance.metrics.length - 1]
      : null;
    servers.push({
      id, name: instance.config.name, status: instance.status,
      cpu: latestMetric?.cpu ?? 0, ram: latestMetric?.ram ?? 0,
      players: instance.players.size, tps: instance.tps,
      playerList: Array.from(instance.players),
    });
  }

  try {
    const dbServers = await sql('SELECT id, name, status FROM servers');
    if (dbServers.length > 0) {
      for (const row of dbServers[0].rows) {
        const s = row as any;
        if (!servers.find(x => x.id === s.id)) {
          servers.push({ id: s.id, name: s.name, status: s.status || 'stopped', cpu: 0, ram: 0, players: 0, tps: 20, playerList: [] });
        }
      }
    }
  } catch {}

  const totalPlayers = servers.reduce((sum, s) => sum + s.players, 0);
  const result: DashboardSnapshot = {
    timestamp: new Date().toISOString(), type: 'snapshot',
    servers, totalPlayers, totalServers: servers.length,
  };
  cache.set('realtime_snapshot', result, 2000);
  return result;
}

// Relay plugin WebSocket events to our event bus
let pluginWsConnected = false;
async function connectPluginWebSocket() {
  if (pluginWsConnected) return;
  const wsPort = siteConfig.ports.websocket || 8089;
  try {
    const wsModule = await import('ws');
    const WebSocket = wsModule.default || wsModule;
    const ws = new WebSocket(`ws://127.0.0.1:${wsPort}`);
    ws.on('open', () => {
      pluginWsConnected = true;
      console.log('[Realtime] Connected to plugin WebSocket');
    });
    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type) {
          eventBus.emit(msg.type, msg.data || msg);
        }
      } catch {}
    });
    ws.on('close', () => {
      pluginWsConnected = false;
      setTimeout(connectPluginWebSocket, 5000);
    });
    ws.on('error', () => {
      pluginWsConnected = false;
    });
  } catch {
    // ws not available, plugin WebSocket relay disabled
  }
}

// Try to connect on startup (non-blocking)
setTimeout(() => connectPluginWebSocket(), 1000);

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const interval = Math.max(1000, parseInt(searchParams.get('interval') || '3000'));
  const events = searchParams.get('events')?.split(',') || ['snapshot'];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const cleanups: (() => void)[] = [];

      const send = (data: any) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { closed = true; }
      };

      request.signal.addEventListener('abort', () => {
        closed = true;
        cleanups.forEach(c => c());
        try { controller.close(); } catch {}
      });

      // Subscribe to real-time events
      for (const event of events) {
        if (event === 'snapshot') continue; // Snapshots are polled
        const unsub = eventBus.subscribe(event, (data) => {
          send({ timestamp: new Date().toISOString(), type: 'event', event, data });
        });
        cleanups.push(unsub);
      }

      // Send initial snapshot
      send(await getSnapshot());

      // Keep SSE alive with heartbeat (no polling - rely on event-driven updates)
      while (!closed) {
        await new Promise(r => setTimeout(r, interval));
        if (closed) break;
        // Send heartbeat comment to keep connection alive
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
          try { controller.close(); } catch {}
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
