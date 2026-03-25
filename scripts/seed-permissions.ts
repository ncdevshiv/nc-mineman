import { sql, escapeStr } from '@/lib/database';

// Permission keys (57 total based on categories)
const PERMISSIONS = [
  // AUTH (4)
  { key: 'auth.login', category: 'AUTH', label: 'Login', description: 'Allow user to log in', is_dangerous: 0 },
  { key: 'auth.link_discord', category: 'AUTH', label: 'Link Discord', description: 'Link Discord account', is_dangerous: 0 },
  { key: 'auth.link_minecraft', category: 'AUTH', label: 'Link Minecraft', description: 'Link Minecraft account', is_dangerous: 0 },
  { key: 'auth.edit_profile', category: 'AUTH', label: 'Edit Profile', description: 'Edit user profile', is_dangerous: 0 },

  // SOCIAL (10)
  { key: 'social.player.search', category: 'SOCIAL', label: 'Search Players', description: 'Search for players', is_dangerous: 0 },
  { key: 'social.player.view_public', category: 'SOCIAL', label: 'View Public Profile', description: 'View public player profiles', is_dangerous: 0 },
  { key: 'social.player.view_full', category: 'SOCIAL', label: 'View Full Profile', description: 'View full player profiles', is_dangerous: 0 },
  { key: 'social.friend.request', category: 'SOCIAL', label: 'Send Friend Request', description: 'Send friend requests', is_dangerous: 0 },
  { key: 'social.friend.accept', category: 'SOCIAL', label: 'Accept Friend', description: 'Accept friend requests', is_dangerous: 0 },
  { key: 'social.friend.reject', category: 'SOCIAL', label: 'Reject Friend', description: 'Reject friend requests', is_dangerous: 0 },
  { key: 'social.friend.remove', category: 'SOCIAL', label: 'Remove Friend', description: 'Remove friends', is_dangerous: 0 },
  { key: 'social.follow.request', category: 'SOCIAL', label: 'Follow Player', description: 'Follow other players', is_dangerous: 0 },
  { key: 'social.follow.view', category: 'SOCIAL', label: 'View Followers', description: 'View following/followers', is_dangerous: 0 },
  { key: 'social.report.submit', category: 'SOCIAL', label: 'Submit Report', description: 'Submit player reports', is_dangerous: 0 },

  // INVENTORY (7)
  { key: 'inventory.view', category: 'INVENTORY', label: 'View Inventory', description: 'View own inventory', is_dangerous: 0 },
  { key: 'inventory.sell', category: 'INVENTORY', label: 'Sell Items', description: 'Sell inventory items', is_dangerous: 0 },
  { key: 'inventory.buy', category: 'INVENTORY', label: 'Buy Items', description: 'Buy items from market', is_dangerous: 0 },
  { key: 'inventory.gift', category: 'INVENTORY', label: 'Gift Items', description: 'Gift items to other players', is_dangerous: 0 },
  { key: 'inventory.auction', category: 'INVENTORY', label: 'Auction Items', description: 'Put items up for auction', is_dangerous: 0 },
  { key: 'inventory.hide', category: 'INVENTORY', label: 'Hide Items', description: 'Hide inventory items', is_dangerous: 0 },
  { key: 'inventory.mod.view', category: 'INVENTORY', label: 'Mod View Inventory', description: 'View any player inventory (moderation)', is_dangerous: 1 },

  // TRADES (4)
  { key: 'trades.create', category: 'TRADES', label: 'Create Trade', description: 'Create new trades', is_dangerous: 0 },
  { key: 'trades.view', category: 'TRADES', label: 'View Trades', description: 'View trade listings', is_dangerous: 0 },
  { key: 'trades.negotiate', category: 'TRADES', label: 'Negotiate Trade', description: 'Negotiate trade terms', is_dangerous: 0 },
  { key: 'trades.cancel', category: 'TRADES', label: 'Cancel Trade', description: 'Cancel own trades', is_dangerous: 0 },

  // MARKETPLACE (2)
  { key: 'market.view', category: 'MARKETPLACE', label: 'View Market', description: 'View marketplace listings', is_dangerous: 0 },
  { key: 'market.purchase', category: 'MARKETPLACE', label: 'Purchase', description: 'Purchase from marketplace', is_dangerous: 0 },

  // TICKETS (6)
  { key: 'tickets.create', category: 'TICKETS', label: 'Create Ticket', description: 'Create support tickets', is_dangerous: 0 },
  { key: 'tickets.view_own', category: 'TICKETS', label: 'View Own Tickets', description: 'View own support tickets', is_dangerous: 0 },
  { key: 'tickets.view_assigned', category: 'TICKETS', label: 'View Assigned Tickets', description: 'View assigned tickets', is_dangerous: 0 },
  { key: 'tickets.respond', category: 'TICKETS', label: 'Respond to Tickets', description: 'Respond to support tickets', is_dangerous: 0 },
  { key: 'tickets.assign', category: 'TICKETS', label: 'Assign Tickets', description: 'Assign tickets to staff', is_dangerous: 1 },
  { key: 'tickets.close', category: 'TICKETS', label: 'Close Tickets', description: 'Close support tickets', is_dangerous: 0 },

  // WIKI (3)
  { key: 'wiki.view', category: 'WIKI', label: 'View Wiki', description: 'View wiki articles', is_dangerous: 0 },
  { key: 'wiki.edit', category: 'WIKI', label: 'Edit Wiki', description: 'Edit wiki articles', is_dangerous: 1 },
  { key: 'wiki.delete', category: 'WIKI', label: 'Delete Wiki', description: 'Delete wiki articles', is_dangerous: 1 },

  // RULES (2)
  { key: 'rules.view', category: 'RULES', label: 'View Rules', description: 'View server rules', is_dangerous: 0 },
  { key: 'rules.manage', category: 'RULES', label: 'Manage Rules', description: 'Edit server rules', is_dangerous: 1 },

  // ACTIVITY (3)
  { key: 'activity.view', category: 'ACTIVITY', label: 'View Activity', description: 'View player activity feed', is_dangerous: 0 },
  { key: 'activity.view_own', category: 'ACTIVITY', label: 'View Own Activity', description: 'View own activity history', is_dangerous: 0 },
  { key: 'activity.moderate', category: 'ACTIVITY', label: 'Moderate Activity', description: 'Hide/remove activity posts', is_dangerous: 1 },

  // MODERATION (7)
  { key: 'mod.view_reports', category: 'MODERATION', label: 'View Reports', description: 'View player reports', is_dangerous: 0 },
  { key: 'mod.ban', category: 'MODERATION', label: 'Ban Player', description: 'Ban players', is_dangerous: 1 },
  { key: 'mod.kick', category: 'MODERATION', label: 'Kick Player', description: 'Kick players from server', is_dangerous: 0 },
  { key: 'mod.mute', category: 'MODERATION', label: 'Mute Player', description: 'Mute players', is_dangerous: 0 },
  { key: 'mod.freeze', category: 'MODERATION', label: 'Freeze Player', description: 'Freeze player inventory', is_dangerous: 1 },
  { key: 'mod.warn', category: 'MODERATION', label: 'Warn Player', description: 'Issue warnings to players', is_dangerous: 0 },
  { key: 'mod.jail', category: 'MODERATION', label: 'Jail Player', description: 'Jail players', is_dangerous: 1 },

  // ADMIN (8)
  { key: 'admin.dashboard', category: 'ADMIN', label: 'Dashboard', description: 'Access admin dashboard', is_dangerous: 0 },
  { key: 'admin.servers', category: 'ADMIN', label: 'Manage Servers', description: 'Manage game servers', is_dangerous: 0 },
  { key: 'admin.users', category: 'ADMIN', label: 'Manage Users', description: 'Manage site users', is_dangerous: 0 },
  { key: 'admin.roles', category: 'ADMIN', label: 'Manage Roles', description: 'Manage roles and permissions', is_dangerous: 0 },
  { key: 'admin.config', category: 'ADMIN', label: 'Site Config', description: 'Configure site settings', is_dangerous: 0 },
  { key: 'admin.branding', category: 'ADMIN', label: 'Branding', description: 'Manage site branding', is_dangerous: 0 },
  { key: 'admin.store', category: 'ADMIN', label: 'Store Management', description: 'Manage store items', is_dangerous: 0 },
  { key: 'admin.audit_log', category: 'ADMIN', label: 'Audit Log', description: 'View audit logs', is_dangerous: 0 },

  // GOD (1)
  { key: 'god.access', category: 'GOD', label: 'Full Access', description: 'Unrestricted access to everything', is_dangerous: 1 },
];

// Role defaults
const ROLE_DEFAULTS: Record<string, string[]> = {
  owner: PERMISSIONS.map(p => p.key), // ALL 57 permissions
  admin: PERMISSIONS.filter(p => p.key !== 'god.access').map(p => p.key), // 56 permissions (all except god.access)
  god: [
    'auth.login', 'auth.edit_profile',
    'social.player.search', 'social.player.view_public', 'social.player.view_full',
    'social.friend.request', 'social.friend.accept', 'social.friend.reject', 'social.friend.remove',
    'social.follow.request', 'social.follow.view', 'social.report.submit',
    'inventory.view', 'inventory.sell', 'inventory.buy', 'inventory.gift', 'inventory.auction', 'inventory.hide',
    'trades.create', 'trades.view', 'trades.negotiate', 'trades.cancel',
    'market.view', 'market.purchase',
    'tickets.view_own', 'tickets.view_assigned', 'tickets.respond',
    'wiki.view', 'wiki.edit',
    'rules.view',
    'activity.view', 'activity.view_own',
    'mod.view_reports', 'mod.warn',
  ],
  helper: [
    'auth.login', 'auth.edit_profile',
    'social.player.search', 'social.player.view_public',
    'social.friend.request', 'social.friend.accept', 'social.friend.reject', 'social.friend.remove',
    'social.follow.request', 'social.follow.view', 'social.report.submit',
    'inventory.view', 'inventory.sell', 'inventory.buy', 'inventory.gift', 'inventory.auction', 'inventory.hide',
    'trades.create', 'trades.view', 'trades.negotiate',
    'market.view',
    'tickets.create', 'tickets.view_own', 'tickets.view_assigned', 'tickets.respond',
    'wiki.view', 'rules.view',
    'activity.view', 'activity.view_own', 'activity.moderate',
    'mod.view_reports', 'mod.warn',
  ],
  youtuber: [
    'auth.login', 'auth.edit_profile',
    'social.player.search', 'social.player.view_public',
    'social.friend.request', 'social.friend.accept', 'social.friend.reject', 'social.friend.remove',
    'social.follow.request', 'social.follow.view', 'social.report.submit',
    'inventory.view', 'inventory.sell', 'inventory.gift', 'inventory.auction', 'inventory.hide',
    'trades.create', 'trades.view', 'trades.negotiate', 'trades.cancel',
    'market.view', 'market.purchase',
    'wiki.view', 'rules.view',
    'activity.view', 'activity.view_own',
  ],
  member: [
    'auth.login', 'auth.edit_profile',
    'social.player.search', 'social.player.view_public',
    'social.friend.request', 'social.friend.accept', 'social.friend.reject', 'social.friend.remove',
    'social.follow.request', 'social.follow.view', 'social.report.submit',
    'inventory.view', 'inventory.sell', 'inventory.buy', 'inventory.gift', 'inventory.auction', 'inventory.hide',
    'market.view',
    'tickets.create', 'tickets.view_own',
    'wiki.view', 'rules.view',
    'activity.view', 'activity.view_own',
  ],
};

async function seedPermissions() {
  console.log('[Seed] Starting permissions seed...');

  // Insert permissions
  console.log('[Seed] Inserting permissions...');
  for (const perm of PERMISSIONS) {
    await sql(
      `INSERT INTO permissions (key, category, label, description, is_dangerous) VALUES ('${escapeStr(perm.key)}', '${escapeStr(perm.category)}', '${escapeStr(perm.label)}', '${escapeStr(perm.description)}', ${perm.is_dangerous})`
    );
  }
  console.log(`[Seed] Inserted ${PERMISSIONS.length} permissions`);

  // Insert role permissions
  console.log('[Seed] Inserting role permissions...');
  for (const [role, perms] of Object.entries(ROLE_DEFAULTS)) {
    for (const permKey of perms) {
      await sql(
        `INSERT INTO role_permissions (role, permission_key, granted) VALUES ('${escapeStr(role)}', '${escapeStr(permKey)}', 1)`
      );
    }
    console.log(`[Seed] Role '${role}' has ${perms.length} permissions`);
  }

  console.log('[Seed] Permissions seeded successfully');
}

seedPermissions().catch(console.error);
