/**
 * Discord API utilities for guild management and role sync
 */

const DISCORD_API = 'https://discord.com/api/v10';

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  icon?: string;
  unicode_emoji?: string;
}

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

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar?: string;
  email?: string;
  banner?: string;
  accent_color?: number;
}

function getBotToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is not set');
  }
  return token;
}

function getGuildId(): string {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    throw new Error('DISCORD_GUILD_ID is not set');
  }
  return guildId;
}

/**
 * Fetch Discord bot's guilds to verify it has access to the configured guild
 */
export async function getBotGuilds(): Promise<{ id: string; name: string }[]> {
  const response = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: {
      Authorization: `Bot ${getBotToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch bot guilds: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch all roles from the configured guild
 */
export async function getGuildRoles(): Promise<DiscordRole[]> {
  const guildId = getGuildId();
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
    headers: {
      Authorization: `Bot ${getBotToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch guild roles: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch a specific guild member by user ID
 */
export async function getGuildMember(userId: string): Promise<DiscordGuildMember | null> {
  const guildId = getGuildId();
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
    headers: {
      Authorization: `Bot ${getBotToken()}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch guild member: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if a user is a member of the configured guild
 */
export async function isGuildMember(userId: string): Promise<boolean> {
  const member = await getGuildMember(userId);
  return member !== null;
}

/**
 * Get user's Discord roles from the guild
 */
export async function getUserDiscordRoles(userId: string): Promise<string[]> {
  const member = await getGuildMember(userId);
  return member?.roles || [];
}

/**
 * Get the avatar URL for a Discord user
 */
export function getDiscordAvatarUrl(userId: string, avatarHash?: string | null): string | null {
  if (!avatarHash) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=256`;
}

/**
 * Get default Discord avatar based on discriminator
 */
export function getDefaultAvatarUrl(discriminator: string): string {
  // Discord used to have discriminators (0001-9999), now uses global_name
  const index = parseInt(discriminator || '0', 10) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/**
 * Full Discord user data fetch for authentication
 */
export async function getDiscordUser(accessToken: string): Promise<{
  user: DiscordUser;
  avatarUrl: string;
  guildMember?: DiscordGuildMember | null;
}> {
  // Fetch user profile
  const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error(`Failed to fetch Discord user: ${userResponse.status}`);
  }

  const user: DiscordUser = await userResponse.json();

  // Build avatar URL
  const avatarUrl = user.avatar
    ? getDiscordAvatarUrl(user.id, user.avatar)!
    : getDefaultAvatarUrl(user.discriminator);

  // Fetch guild member data to get roles
  let guildMember: DiscordGuildMember | null = null;
  try {
    guildMember = await getGuildMember(user.id);
  } catch {
    // User might not be in guild
  }

  return { user, avatarUrl, guildMember };
}

/**
 * Role mapping configuration
 */
export interface RoleMapping {
  discordRoleId: string;
  discordRoleName: string;
  siteRole: string;
  direction: 'discord-to-site' | 'site-to-discord' | 'both';
}

const ROLE_MAP_CACHE_KEY = 'discord_role_mappings';

/**
 * Get role mappings from environment variable
 */
export function getRoleMappings(): RoleMapping[] {
  const mapStr = process.env.DISCORD_TO_SITE_ROLE_MAP || '';
  if (!mapStr) return [];

  return mapStr.split(',').map(entry => {
    const [discordRoleId, siteRole, direction = 'discord-to-site'] = entry.split(':');
    return {
      discordRoleId: discordRoleId.trim(),
      discordRoleName: '', // Will be populated by fetchDiscordRolesWithNames
      siteRole: siteRole.trim(),
      direction: direction.trim() as 'discord-to-site' | 'site-to-discord' | 'both',
    };
  });
}

/**
 * Map Discord roles to site roles based on configuration
 */
export async function mapDiscordRolesToSiteRoles(discordRoleIds: string[]): Promise<string[]> {
  const mappings = getRoleMappings();
  const guildRoles = await getGuildRoles();

  const siteRoles: Set<string> = new Set(['member']); // Everyone gets 'member' by default

  for (const discordRoleId of discordRoleIds) {
    const mapping = mappings.find(m => m.discordRoleId === discordRoleId);
    if (mapping && (mapping.direction === 'discord-to-site' || mapping.direction === 'both')) {
      siteRoles.add(mapping.siteRole);
    }
  }

  // Also check by role name (in case IDs don't match)
  for (const role of guildRoles) {
    if (discordRoleIds.includes(role.id)) {
      const mapping = mappings.find(m => m.discordRoleName.toLowerCase() === role.name.toLowerCase());
      if (mapping && (mapping.direction === 'discord-to-site' || mapping.direction === 'both')) {
        siteRoles.add(mapping.siteRole);
      }
    }
  }

  return Array.from(siteRoles);
}

/**
 * Verify guild membership using the bot token with guilds.members.read scope
 */
export async function verifyGuildMembershipWithToken(
  userId: string,
  accessToken: string
): Promise<boolean> {
  const guildId = getGuildId();

  try {
    const response = await fetch(
      `${DISCORD_API}/users/@me/guilds/${guildId}/member`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}
