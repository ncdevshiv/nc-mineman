import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import siteConfig from '@/lib/site.config';
import { cache, CACHE_KEYS } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const PLUGIN_BASE = `http://127.0.0.1:${siteConfig.ports.serverStats}`;

async function fetchPlugin(path: string, timeout = 5000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${PLUGIN_BASE}${path}`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function postPlugin(path: string, body: any, timeout = 5000): Promise<{ data: any; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${PLUGIN_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => null);
    return { data, status: res.status };
  } catch {
    clearTimeout(timer);
    return { data: { error: 'Plugin offline' }, status: 503 };
  }
}

function transformPlayer(pluginPlayer: any): any {
  return {
    name: pluginPlayer.name || '',
    uuid: pluginPlayer.uuid || '',
    health: pluginPlayer.stats?.health ?? pluginPlayer.health ?? 20,
    food: pluginPlayer.stats?.food ?? pluginPlayer.food ?? 20,
    gamemode: pluginPlayer.stats?.gamemode ?? pluginPlayer.gamemode ?? 'SURVIVAL',
    x: pluginPlayer.location?.x ?? 0,
    y: pluginPlayer.location?.y ?? 64,
    z: pluginPlayer.location?.z ?? 0,
    world: pluginPlayer.location?.world ?? 'world',
    is_online: pluginPlayer.status !== 'offline',
    is_banned: pluginPlayer.status === 'banned',
    ban_reason: pluginPlayer.ban_reason || pluginPlayer.banReason || '',
    is_whitelisted: true,
    is_frozen: pluginPlayer.frozen || false,
    total_playtime_seconds: Math.floor((pluginPlayer.totalPlaytime || pluginPlayer.total_playtime || 0) / 1000),
    first_seen: pluginPlayer.first_join || '',
    last_seen: pluginPlayer.lastSeen || pluginPlayer.last_seen || '',
    ping: pluginPlayer.ping || pluginPlayer.stats?.ping || 0,
    role: pluginPlayer.role || 'Member',
  };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || 'snapshot';

  try {
    // Full server snapshot (used by Status, Dashboard, God view)
    if (path === 'snapshot') {
      const cached = cache.getSync<any>(CACHE_KEYS.serverStats());
      if (cached) return NextResponse.json(cached);

      const pluginData = await fetchPlugin('/api/players');
      if (!pluginData) {
        return NextResponse.json({ offline: true, error: 'Minecraft Serverstats API is offline' }, { status: 200 });
      }

      const pluginPlayers: any[] = pluginData.players || [];
      const players = pluginPlayers.map(transformPlayer);

      // Get real server data from plugin if available
      const serverInfo = await fetchPlugin('/api/server').catch(() => null);

      const server = {
        tps_1min: serverInfo?.tps?.[0] ?? (pluginPlayers.length > 0 ? 20.0 : 0),
        tps_5min: serverInfo?.tps?.[1] ?? (pluginPlayers.length > 0 ? 20.0 : 0),
        tps_15min: serverInfo?.tps?.[2] ?? (pluginPlayers.length > 0 ? 20.0 : 0),
        online_players: pluginPlayers.length,
        max_players: serverInfo?.maxPlayers ?? serverInfo?.max_players ?? 100,
        average_ping: pluginPlayers.length > 0
          ? Math.round(pluginPlayers.reduce((s: number, p: any) => s + (p.ping || 0), 0) / pluginPlayers.length)
          : 0,
        uptime_seconds: serverInfo?.uptime ?? 0,
        version: serverInfo?.version ?? serverInfo?.minecraft_version ?? 'Unknown',
      };

      const activities = pluginPlayers.flatMap((p: any) =>
        (p.recentActivities || p.recent_activities || []).map((a: any) => ({
          type: (a.action || '').toLowerCase().replace('_', ''),
          player: p.name,
          message: `${(a.action || '').toLowerCase().replace('_', ' ')} ${a.target || ''}`.trim(),
          timestamp: a.timestamp || new Date().toISOString(),
        }))
      ).slice(0, 50);

      const result = { components: { server, players, activities } };
      cache.set(CACHE_KEYS.serverStats(), result, 3000); // Cache 3s
      return NextResponse.json(result);
    }

    // Player list
    if (path === 'players') {
      const data = await fetchPlugin('/api/players');
      if (!data) return NextResponse.json({ offline: true }, { status: 200 });
      return NextResponse.json(data);
    }

    // Activities
    if (path === 'activities') {
      const data = await fetchPlugin('/api/players');
      if (!data) return NextResponse.json([], { status: 200 });
      const pluginPlayers: any[] = data.players || [];
      const activities = pluginPlayers.flatMap((p: any) =>
        (p.recentActivities || p.recent_activities || []).map((a: any) => ({
          type: (a.action || '').toLowerCase().replace('_', ''),
          player: p.name,
          message: `${(a.action || '').toLowerCase().replace('_', ' ')} ${a.target || ''}`.trim(),
          timestamp: a.timestamp || new Date().toISOString(),
        }))
      );
      return NextResponse.json(activities);
    }

    // Player inventory
    if (path.startsWith('inventory')) {
      const uuid = searchParams.get('uuid');
      if (!uuid) return NextResponse.json({ error: 'uuid required' }, { status: 400 });
      const data = await fetchPlugin(`/api/inventory?uuid=${encodeURIComponent(uuid)}`);
      return NextResponse.json(data || { inventory: [] });
    }

    // Health check
    if (path === 'health') {
      const data = await fetchPlugin('/health');
      return NextResponse.json(data || { status: 'offline' });
    }

    // Admin bans
    if (path.startsWith('admin/bans')) {
      const data = await fetchPlugin('/api/admin/bans');
      return NextResponse.json(data || { bans: [] });
    }

    // Admin reports
    if (path.startsWith('admin/reports')) {
      const status = searchParams.get('status') || 'open';
      const data = await fetchPlugin(`/api/admin/reports?status=${encodeURIComponent(status)}`);
      return NextResponse.json(data || { reports: [] });
    }

    // Player search
    if (path.startsWith('search')) {
      const q = searchParams.get('q') || '';
      const data = await fetchPlugin(`/api/search?q=${encodeURIComponent(q)}&type=players`);
      return NextResponse.json(data || { results: [] });
    }

    // Auction bids
    if (path.startsWith('auctions/bids')) {
      const auctionId = searchParams.get('auctionId');
      if (!auctionId) return NextResponse.json({ error: 'auctionId required' }, { status: 400 });
      const data = await fetchPlugin(`/api/auctions/bids?auctionId=${encodeURIComponent(auctionId)}`);
      return NextResponse.json(data || { bids: [] });
    }

    return NextResponse.json({ error: 'Unknown path' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ offline: true, error: 'Minecraft Serverstats API is offline' }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '';

  try {
    const body = await request.json();
    let pluginPath = '';

    // Moderation actions
    if (['moderation', 'kick', 'ban', 'freeze', 'jail', 'timeout', 'slap', 'warn', 'unban'].includes(path)) {
      pluginPath = '/api/moderation';
    }
    // Inventory actions
    else if (path === 'inventory') {
      pluginPath = '/api/inventory';
    }
    // Social actions
    else if (path === 'social') {
      pluginPath = '/api/social';
    }
    // Trading actions
    else if (path === 'trading') {
      pluginPath = '/api/trading';
    }
    // Auction bidding
    else if (path === 'auctions/bid') {
      pluginPath = '/api/auctions/bid';
    }
    // Auction creation
    else if (path === 'auctions/create') {
      pluginPath = '/api/auctions';
    }
    else {
      return NextResponse.json({ error: 'Unknown path' }, { status: 400 });
    }

    const { data, status } = await postPlugin(pluginPath, body);
    return NextResponse.json(data, { status });
  } catch (error: any) {
    return NextResponse.json({ error: 'Plugin API offline' }, { status: 503 });
  }
}
