import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/database';
import { getSession } from '@/lib/auth';
import siteConfig from '@/lib/site.config';

export async function GET() {
  try {
    // Return the current site config as JSON
    // In a real app, this would fetch from a database, but for now we return the compiled config
    const config = {
      general: {
        siteName: siteConfig.name.short,
        siteFullName: siteConfig.name.full,
        description: siteConfig.seo.description,
        domain: siteConfig.name.domain,
        logoUrl: '',
        faviconUrl: '',
      },
      discord: {
        guildName: '',
        inviteUrl: siteConfig.social.discordInvite,
        botStatus: 'unknown',
      },
      features: {
        wikiEnabled: true,
        rulesEnabled: true,
        activityEnabled: true,
        socialEnabled: true,
      },
    };

    // Try to load any overrides from database
    try {
      const r = await sql('SELECT key, value FROM site_config_overrides');
      if (r[0]?.rows) {
        for (const row of r[0].rows) {
          const key = row.key as string;
          const value = row.value as string;
          // Parse dot notation keys like "general.siteName"
          const parts = key.split('.');
          if (parts.length === 2) {
            const [section, field] = parts;
            if (config[section as keyof typeof config]) {
              (config[section as keyof typeof config] as any)[field] = value;
            }
          }
        }
      }
    } catch {
      // Database not available, use defaults
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Get site config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!session.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { section, data } = body;

    if (!section || !data) {
      return NextResponse.json({ error: 'section and data required' }, { status: 400 });
    }

    // Save each field as a key/value pair
    for (const [key, value] of Object.entries(data)) {
      const fullKey = `${section}.${key}`;
      await sql({
        sql: `INSERT OR REPLACE INTO site_config_overrides (key, value) VALUES (?, ?)`,
        args: [fullKey, String(value)]
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update site config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
