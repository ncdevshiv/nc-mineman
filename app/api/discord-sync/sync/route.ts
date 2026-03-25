import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql, escapeStr } from '@/lib/database';

function getBotToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN is not set');
  return token;
}

function getGuildId(): string {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error('DISCORD_GUILD_ID is not set');
  return guildId;
}

const DISCORD_API = 'https://discord.com/api/v10';

interface DiscordGuildMember {
  user?: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
    email?: string;
  };
  nick?: string;
  avatar?: string;
  roles: string[];
  joined_at: string;
  deaf: boolean;
  mute: boolean;
  flags: number;
  pending?: boolean;
  permissions?: string;
  communication_disabled_until?: string;
}

async function getGuildMembers(guildId: string, botToken: string): Promise<DiscordGuildMember[]> {
  const members: DiscordGuildMember[] = [];
  let lastMemberId: string | undefined;

  while (true) {
    const params = new URLSearchParams({ limit: '1000' });
    if (lastMemberId) params.set('after', lastMemberId);

    const response = await fetch(`${DISCORD_API}/guilds/${guildId}/members?${params}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch guild members: ${response.status}`);
    }

    const batch: DiscordGuildMember[] = await response.json();
    if (batch.length === 0) break;

    members.push(...batch);
    lastMemberId = batch[batch.length - 1].user?.id;

    // Discord limits to 1000 per request, we've reached the end when we get less than 1000
    if (batch.length < 1000) break;
  }

  return members;
}

async function getAllRoleMappings(): Promise<Array<{ discord_role_id: string; discord_role_name: string; site_role: string; sync_direction: string }>> {
  const r = await sql('SELECT discord_role_id, discord_role_name, site_role, sync_direction FROM discord_role_mappings');
  return (r[0]?.rows ?? []) as Array<{ discord_role_id: string; discord_role_name: string; site_role: string; sync_direction: string }>;
}

async function getSiteUserByDiscordId(discordId: string): Promise<{ id: string; roles: string[] } | null> {
  const r = await sql(`SELECT id, roles FROM site_users WHERE id='${escapeStr(discordId)}'`);
  if (r.length > 0 && r[0].rows.length > 0) {
    const row = r[0].rows[0] as any;
    return {
      id: row.id,
      roles: typeof row.roles === 'string' ? JSON.parse(row.roles) : row.roles || ['member'],
    };
  }
  return null;
}

async function updateSiteUserRoles(discordId: string, siteRole: string): Promise<boolean> {
  const user = await getSiteUserByDiscordId(discordId);
  if (!user) return false;

  if (!user.roles.includes(siteRole)) {
    const newRoles = [...user.roles, siteRole];
    await sql({
      sql: `UPDATE site_users SET roles=?, updated_at=datetime('now') WHERE id=?`,
      args: [escapeStr(JSON.stringify(newRoles)), discordId],
    });
  }
  return true;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.roles?.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const botToken = getBotToken();
    const guildId = getGuildId();

    // Get all role mappings from DB
    const mappings = await getAllRoleMappings();
    if (mappings.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No role mappings configured' });
    }

    // Get all guild members
    const members = await getGuildMembers(guildId, botToken);

    // Build a map of discord_role_id -> site_role for quick lookup
    const roleToSiteRole = new Map<string, string>();
    for (const mapping of mappings) {
      if (mapping.sync_direction === 'discord-to-site' || mapping.sync_direction === 'both') {
        roleToSiteRole.set(mapping.discord_role_id, mapping.site_role);
      }
    }

    // For each member, check if they have any mapped Discord roles
    // and assign the corresponding site roles
    let syncedCount = 0;
    for (const member of members) {
      if (!member.user) continue;

      const discordUserId = member.user.id;
      const discordRoleIds = member.roles;

      let updated = false;
      for (const discordRoleId of discordRoleIds) {
        const siteRole = roleToSiteRole.get(discordRoleId);
        if (siteRole) {
          const didUpdate = await updateSiteUserRoles(discordUserId, siteRole);
          if (didUpdate) updated = true;
        }
      }

      if (updated) syncedCount++;
    }

    return NextResponse.json({ synced: syncedCount, message: `Synced ${syncedCount} users` });
  } catch (error: any) {
    console.error('Discord sync error:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
