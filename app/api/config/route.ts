import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql, escapeStr } from '@/lib/database';

export const dynamic = 'force-dynamic';

const DEFAULT_CONFIG: Record<string, { value: string; description: string }> = {
  SITE_NAME_SHORT: { value: 'Hideout', description: 'Short brand name displayed in collapsed sidebar and small spaces' },
  SITE_NAME_FULL: { value: 'Hideout SMP', description: 'Full brand name displayed in page titles and headers' },
  SITE_DOMAIN: { value: 'hideoutsmp.com', description: 'Primary domain for the website (used in sitemap, SEO)' },
  SITE_TAGLINE: { value: 'Free-to-Play Minecraft Server', description: 'Tagline shown below the brand name on landing page' },
  SITE_DESCRIPTION: { value: 'Join our Minecraft server for an amazing experience.', description: 'SEO meta description for search engines' },
  SERVER_IP: { value: 'play.hideoutsmp.com', description: 'Minecraft server IP address shown to players' },
  LOGO_LETTER: { value: 'H', description: 'Single letter displayed in the logo square' },
  LOGO_COLOR_FROM: { value: '#10b981', description: 'Starting gradient color for logo (hex)' },
  LOGO_COLOR_TO: { value: '#059669', description: 'Ending gradient color for logo (hex)' },
  YOUTUBE_URL: { value: 'https://youtube.com/@YourChannel', description: 'YouTube channel URL for social links' },
  DISCORD_URL: { value: 'https://discord.gg/your-invite', description: 'Discord invite URL for social links' },
  DISCORD_INVITE: { value: 'your-invite', description: 'Discord invite code (the part after discord.gg/)' },
  STORE_URL: { value: 'https://store.hideoutsmp.com', description: 'Store URL for purchase links' },
  SUPPORT_EMAIL: { value: 'support@hideoutsmp.com', description: 'Support email address for contact page' },
  COOKIE_NAME: { value: 'app_session', description: 'Cookie name for session storage' },
  THEME_KEY: { value: 'app-theme', description: 'LocalStorage key for theme preference' },
  SERVER_STATS_PORT: { value: '8088', description: 'Port for Minecraft server stats API' },
  WEBSOCKET_PORT: { value: '8089', description: 'Port for real-time WebSocket connections' },
  DATABASE_TYPE: { value: 'sqlite', description: 'Database type (sqlite - embedded, no external server)' },
};

async function getConfigFromDB(): Promise<Record<string, string>> {
  try {
    const result = await sql('SELECT key, value FROM site_config');
    if (result.length > 0 && result[0].rows.length > 0) {
      const config: Record<string, string> = {};
      for (const row of result[0].rows) {
        config[(row as any).key] = (row as any).value;
      }
      return config;
    }
  } catch {}
  return {};
}

async function setConfigInDB(key: string, value: string): Promise<void> {
  const description = DEFAULT_CONFIG[key]?.description || '';
  await sql(`
    INSERT INTO site_config (key, value, description, updated_at)
    VALUES ('${escapeStr(key)}', '${escapeStr(value)}', '${escapeStr(description)}', datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value='${escapeStr(value)}', updated_at=datetime('now')
  `);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const dbConfig = await getConfigFromDB();
  const config: Record<string, { value: string; description: string; source: 'db' | 'default' }> = {};
  
  for (const [key, data] of Object.entries(DEFAULT_CONFIG)) {
    config[key] = {
      value: dbConfig[key] ?? data.value,
      description: data.description,
      source: dbConfig[key] ? 'db' : 'default',
    };
  }
  
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.roles.some(r => ['owner', 'admin'].includes(r))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof value !== 'string') {
      return NextResponse.json({ error: 'Key and value required' }, { status: 400 });
    }

    if (!DEFAULT_CONFIG[key]) {
      return NextResponse.json({ error: 'Unknown config key' }, { status: 400 });
    }

    await setConfigInDB(key, value);
    return NextResponse.json({ success: true, key, value });
  } catch (error: any) {
    console.error('[CONFIG] Error saving:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || !session.roles.some(r => ['owner', 'admin'].includes(r))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const results: { key: string; success: boolean }[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (DEFAULT_CONFIG[key] && typeof value === 'string') {
        await setConfigInDB(key, value);
        results.push({ key, success: true });
      }
    }

    return NextResponse.json({ success: true, updated: results });
  } catch (error: any) {
    console.error('[CONFIG] Error bulk saving:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}


