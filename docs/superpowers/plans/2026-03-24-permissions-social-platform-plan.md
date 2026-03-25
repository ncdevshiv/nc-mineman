# Unified Permission & Social Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete role-permission engine with configurable permissions per role (preset + custom), Discord guild role sync, a full social platform with friend/follow/search, and member default experience.

**Architecture:** Three-phase approach:
1. Database migration adds permissions table + role_permissions mapping. `lib/permissions.ts` becomes the single source of truth for permission checking. All API auth helpers updated.
2. Admin UI at `/admin/roles` rebuilt with tabbed interface (Preset Roles, Custom Roles, Discord Sync, Audit Log). Role permission editing via slide-in modal with category-grouped toggles.
3. Social platform rebuilt at `/social` with Friends/Requests/Find Players tabs. Player search filters (SMP/Site/Offline). Friend request status visible to sender.

**Tech Stack:** Next.js 15 App Router, SQLite via `@libsql/client`, SWR, React motion animations, Lucide icons, existing `Badge/Card/Modal/Input` UI components.

---

## Phase 1: Database & Permissions Foundation

### Task 1: Database Migration

**Files:**
- Create: `lib/db/migrations/004_permissions.sql`
- Modify: `lib/db-frontend.ts`
- Test: manual `sqlite3 data/minemanager.db < lib/db/migrations/004_permissions.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- lib/db/migrations/004_permissions.sql

-- Permissions definition table (immutable keys)
CREATE TABLE IF NOT EXISTS permissions (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  is_dangerous INTEGER DEFAULT 0
);

-- Role → Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  granted INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (role, permission_key)
);

-- Custom roles created by admins
CREATE TABLE IF NOT EXISTS custom_roles (
  name TEXT PRIMARY KEY,
  color TEXT NOT NULL DEFAULT '#6b7280',
  description TEXT,
  icon TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT NOT NULL
);

-- Discord guild role → site role sync (use existing discord_role_mappings table)
-- The existing discord_role_mappings table already has: id, discord_role_id, discord_role_name, site_role, sync_direction, created_at
-- No new table needed — migration adds any missing columns

-- User → custom role assignments
CREATE TABLE IF NOT EXISTS user_custom_roles (
  user_id TEXT NOT NULL,
  custom_role_name TEXT NOT NULL,
  assigned_at TEXT DEFAULT (datetime('now')),
  assigned_by TEXT NOT NULL,
  PRIMARY KEY (user_id, custom_role_name)
);

-- Audit log for permission changes
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  performed_by TEXT NOT NULL,
  action TEXT NOT NULL,
  target_role TEXT,
  permission_key TEXT,
  old_value TEXT,
  new_value TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);

-- Add custom_roles column to site_users if not exists
-- SQLite does not support IF NOT EXISTS for columns, so use a workaround
-- This will be handled by the migration script
```

- [ ] **Step 2: Create migration runner**

```typescript
// lib/db/migrations/run.ts
import { ensureDb } from '@/lib/database';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS = [
  '004_permissions.sql',
];

export async function runMigrations() {
  const db = await ensureDb();
  if (!db) {
    console.log('[migration] Skipping migrations at build time');
    return;
  }
  const migrationsDir = join(process.cwd(), 'lib/db/migrations');

  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    // Split on semicolons and run each statement
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        await db.execute(`${stmt}`);
      } catch (e: any) {
        // Ignore "table already exists" errors
        if (!e.message.includes('already exists')) {
          console.error(`Migration ${file} failed:`, e.message);
        }
      }
    }
    console.log(`[migration] Applied: ${file}`);
  }
}
```

- [ ] **Step 3: Create seed script for permissions**

```typescript
// scripts/seed-permissions.ts
import { sql, escapeStr } from '@/lib/database';

const PERMISSIONS = [
  // AUTH
  { key: 'auth.login', category: 'AUTH', label: 'Site Login', description: 'Can log into the website', is_dangerous: 0 },
  { key: 'auth.link_discord', category: 'AUTH', label: 'Link Discord', description: 'Can link Discord account to profile', is_dangerous: 0 },
  { key: 'auth.link_minecraft', category: 'AUTH', label: 'Link Minecraft', description: 'Can link Minecraft username to account', is_dangerous: 0 },
  { key: 'auth.edit_profile', category: 'AUTH', label: 'Edit Profile', description: 'Can edit display name, avatar, and site settings', is_dangerous: 0 },
  // SOCIAL
  { key: 'social.player.search', category: 'SOCIAL', label: 'Search Players', description: 'Can search for any registered player', is_dangerous: 0 },
  { key: 'social.player.view_public', category: 'SOCIAL', label: 'View Public Profiles', description: 'Can view public player profile pages', is_dangerous: 0 },
  { key: 'social.player.view_full', category: 'SOCIAL', label: 'View Full Profiles', description: 'Can view inventory, stats, and moderation history on profiles', is_dangerous: 0 },
  { key: 'social.friend.request', category: 'SOCIAL', label: 'Send Friend Requests', description: 'Can send friend requests to other players', is_dangerous: 0 },
  { key: 'social.friend.accept', category: 'SOCIAL', label: 'Accept Friend Requests', description: 'Can accept incoming friend requests', is_dangerous: 0 },
  { key: 'social.friend.reject', category: 'SOCIAL', label: 'Reject Friend Requests', description: 'Can reject incoming friend requests', is_dangerous: 0 },
  { key: 'social.friend.remove', category: 'SOCIAL', label: 'Remove Friends', description: 'Can remove existing friends from friends list', is_dangerous: 0 },
  { key: 'social.follow.request', category: 'SOCIAL', label: 'Follow Players', description: 'Can follow other players', is_dangerous: 0 },
  { key: 'social.follow.view', category: 'SOCIAL', label: 'View Followers', description: 'Can view followers and following lists', is_dangerous: 0 },
  { key: 'social.report.submit', category: 'SOCIAL', label: 'Submit Reports', description: 'Can submit player reports', is_dangerous: 0 },
  // INVENTORY
  { key: 'inventory.view', category: 'INVENTORY', label: 'View Inventory', description: 'Can view own inventory', is_dangerous: 0 },
  { key: 'inventory.sell', category: 'INVENTORY', label: 'Sell Items', description: 'Can list inventory items for sale', is_dangerous: 0 },
  { key: 'inventory.buy', category: 'INVENTORY', label: 'Buy Items', description: 'Can purchase items from other players', is_dangerous: 0 },
  { key: 'inventory.gift', category: 'INVENTORY', label: 'Gift Items', description: 'Can gift items to other players', is_dangerous: 0 },
  { key: 'inventory.auction', category: 'INVENTORY', label: 'Create Auctions', description: 'Can auction inventory items', is_dangerous: 0 },
  { key: 'inventory.hide', category: 'INVENTORY', label: 'Hide Inventory Items', description: 'Can hide inventory items from public view', is_dangerous: 0 },
  { key: 'inventory.mod.view', category: 'INVENTORY', label: 'Mod View Any Inventory', description: 'Moderators can inspect any player inventory', is_dangerous: 1 },
  // TRADES
  { key: 'trades.create', category: 'TRADES', label: 'Create Trade Listings', description: 'Can create new trade listings', is_dangerous: 0 },
  { key: 'trades.view', category: 'TRADES', label: 'Browse Trades', description: 'Can browse trade listings', is_dangerous: 0 },
  { key: 'trades.negotiate', category: 'TRADES', label: 'Negotiate Trades', description: 'Can make offers on existing trades', is_dangerous: 0 },
  { key: 'trades.cancel', category: 'TRADES', label: 'Cancel Own Trades', description: 'Can cancel own active trades', is_dangerous: 0 },
  // MARKETPLACE
  { key: 'market.view', category: 'MARKETPLACE', label: 'Browse Marketplace', description: 'Can browse the public marketplace', is_dangerous: 0 },
  { key: 'market.purchase', category: 'MARKETPLACE', label: 'Make Purchases', description: 'Can purchase items from the marketplace', is_dangerous: 0 },
  // TICKETS
  { key: 'tickets.create', category: 'TICKETS', label: 'Create Tickets', description: 'Can create support tickets', is_dangerous: 0 },
  { key: 'tickets.view_own', category: 'TICKETS', label: 'View Own Tickets', description: 'Can view own support tickets', is_dangerous: 0 },
  { key: 'tickets.view_assigned', category: 'TICKETS', label: 'View Assigned Tickets', description: 'Can view tickets assigned to self', is_dangerous: 0 },
  { key: 'tickets.respond', category: 'TICKETS', label: 'Respond to Tickets', description: 'Can reply to support tickets', is_dangerous: 0 },
  { key: 'tickets.assign', category: 'TICKETS', label: 'Assign Tickets', description: 'Can assign tickets to helpers and moderators', is_dangerous: 1 },
  { key: 'tickets.close', category: 'TICKETS', label: 'Close Tickets', description: 'Can close and resolve support tickets', is_dangerous: 0 },
  // MODERATION
  { key: 'mod.view_reports', category: 'MODERATION', label: 'View Reports', description: 'Can view submitted player reports', is_dangerous: 0 },
  { key: 'mod.ban', category: 'MODERATION', label: 'Ban Players', description: 'Can ban players from server and site', is_dangerous: 1 },
  { key: 'mod.kick', category: 'MODERATION', label: 'Kick Players', description: 'Can kick players from the server', is_dangerous: 1 },
  { key: 'mod.mute', category: 'MODERATION', label: 'Mute Players', description: 'Can mute players in-game', is_dangerous: 0 },
  { key: 'mod.freeze', category: 'MODERATION', label: 'Freeze Inventories', description: 'Can freeze player inventories', is_dangerous: 1 },
  { key: 'mod.warn', category: 'MODERATION', label: 'Issue Warnings', description: 'Can issue formal warnings to players', is_dangerous: 0 },
  { key: 'mod.jail', category: 'MODERATION', label: 'Jail Players', description: 'Can jail players in-game', is_dangerous: 1 },
  // ADMIN
  { key: 'admin.dashboard', category: 'ADMIN', label: 'Admin Dashboard', description: 'Can access the admin dashboard', is_dangerous: 1 },
  { key: 'admin.servers', category: 'ADMIN', label: 'Manage Servers', description: 'Can manage Minecraft servers', is_dangerous: 1 },
  { key: 'admin.users', category: 'ADMIN', label: 'Manage Users', description: 'Can view and edit user accounts', is_dangerous: 1 },
  { key: 'admin.roles', category: 'ADMIN', label: 'Manage Roles', description: 'Can edit role-permission mappings', is_dangerous: 1 },
  { key: 'admin.config', category: 'ADMIN', label: 'Edit Configuration', description: 'Can modify site configuration', is_dangerous: 1 },
  { key: 'admin.branding', category: 'ADMIN', label: 'Edit Branding', description: 'Can modify site branding and appearance', is_dangerous: 1 },
  { key: 'admin.store', category: 'ADMIN', label: 'Manage Store', description: 'Can manage marketplace items and inventory', is_dangerous: 1 },
  { key: 'admin.audit_log', category: 'ADMIN', label: 'View Audit Logs', description: 'Can view permission and action audit logs', is_dangerous: 1 },
  // GOD
  { key: 'god.access', category: 'GOD', label: 'God View Access', description: 'Can access the God View page', is_dangerous: 0 },
];

// Default role → permission assignments (preset roles)
const ROLE_DEFAULTS = {
  owner: PERMISSIONS.map(p => p.key), // ALL
  admin: PERMISSIONS.filter(p => p.key !== 'god.access').map(p => p.key),
  god: [
    'auth.login', 'auth.edit_profile',
    'social.player.search', 'social.player.view_public', 'social.player.view_full',
    'social.friend.request', 'social.friend.accept', 'social.friend.reject', 'social.friend.remove',
    'social.follow.request', 'social.follow.view', 'social.report.submit',
    'inventory.view', 'inventory.sell', 'inventory.buy', 'inventory.gift', 'inventory.auction', 'inventory.hide',
    'trades.create', 'trades.view', 'trades.negotiate', 'trades.cancel',
    'market.view', 'market.purchase',
    'tickets.view_own', 'tickets.view_assigned', 'tickets.respond',
    'mod.view_reports', 'mod.warn',
    // NOTE: god.access is NOT in god role defaults (only owner has god.access)
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
  ],
  member: [
    'auth.login', 'auth.edit_profile',
    'social.player.search', 'social.player.view_public',
    'social.friend.request', 'social.friend.accept', 'social.friend.reject', 'social.friend.remove',
    'social.follow.request', 'social.follow.view', 'social.report.submit',
    'inventory.view', 'inventory.sell', 'inventory.buy', 'inventory.gift', 'inventory.auction', 'inventory.hide',
    'market.view',
    'tickets.create', 'tickets.view_own',
  ],
};

export async function seedPermissions() {
  // Insert permissions using sql() with escapeStr()
  for (const perm of PERMISSIONS) {
    await sql(`INSERT OR IGNORE INTO permissions (key, category, label, description, is_dangerous)
      VALUES ('${escapeStr(perm.key)}', '${escapeStr(perm.category)}', '${escapeStr(perm.label)}', '${escapeStr(perm.description)}', ${perm.is_dangerous})`);
  }

  // Insert role permissions
  for (const [role, perms] of Object.entries(ROLE_DEFAULTS)) {
    for (const permKey of perms) {
      await sql(`INSERT OR IGNORE INTO role_permissions (role, permission_key, granted) VALUES ('${escapeStr(role)}', '${escapeStr(permKey)}', 1)`);
    }
  }

  console.log('[seed] Permissions seeded successfully');
}
```

- [ ] **Step 4: Add package.json script**

Modify `package.json` scripts section:
```json
"db:migrate": "bun run scripts/migrate.ts",
"db:seed:permissions": "bun run scripts/seed-permissions.ts",
```

- [ ] **Step 5: Run migration and seed**

```bash
bun run scripts/migrate.ts && bun run scripts/seed-permissions.ts
```
Expected: Migration applied, permissions seeded, no errors

- [ ] **Step 6: Commit**

```bash
git add lib/db/migrations/004_permissions.sql scripts/migrate.ts scripts/seed-permissions.ts package.json
git commit -m "feat: add permissions database migration and seed data"
```

---

### Task 2: lib/permissions.ts — Permission Checking Engine

**Files:**
- Create: `lib/permissions.ts`
- Modify: `lib/api-auth.ts`, `lib/db-frontend.ts`
- Test: manual API calls

- [ ] **Step 1: Write lib/permissions.ts**

```typescript
// lib/permissions.ts
import { sql } from '@/lib/database';

export type PermissionCategory =
  | 'AUTH' | 'SOCIAL' | 'INVENTORY' | 'TRADES'
  | 'MARKETPLACE' | 'TICKETS' | 'MODERATION' | 'ADMIN' | 'GOD';

export interface PermissionDef {
  key: string;
  category: PermissionCategory;
  label: string;
  description: string;
  isDangerous: boolean;
}

export interface RoleDef {
  name: string;
  color: string;
  description: string;
  isLocked: boolean; // true for owner
  permissions: Set<string>;
}

// Cache permission definitions in memory
let permissionsCache: PermissionDef[] | null = null;
let rolePermissionsCache: Map<string, Set<string>> | null = null;
let cacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

async function loadPermissions() {
  if (permissionsCache && Date.now() - cacheTime < CACHE_TTL) return;

  const r = await sql('SELECT key, category, label, description, is_dangerous FROM permissions');
  permissionsCache = r[0].rows.map(row => ({
    key: row.key as string,
    category: row.category as PermissionCategory,
    label: row.label as string,
    description: row.description as string,
    isDangerous: Boolean(row.is_dangerous),
  }));
  cacheTime = Date.now();
}

async function loadRolePermissions() {
  if (rolePermissionsCache && Date.now() - cacheTime < CACHE_TTL) return;

  const r = await sql('SELECT role, permission_key FROM role_permissions WHERE granted = 1');
  rolePermissionsCache = new Map();

  // Initialize all known roles
  const knownRoles = ['owner', 'admin', 'god', 'helper', 'youtuber', 'member'];
  for (const role of knownRoles) {
    rolePermissionsCache.set(role, new Set());
  }

  for (const row of r[0].rows) {
    const role = row.role as string;
    const perm = row.permission_key as string;
    if (!rolePermissionsCache.has(role)) {
      rolePermissionsCache.set(role, new Set());
    }
    rolePermissionsCache.get(role)!.add(perm);
  }
  cacheTime = Date.now();
}

export async function getPermissionDefs(): Promise<PermissionDef[]> {
  await loadPermissions();
  return permissionsCache!;
}

export async function getPermissionsByCategory(): Promise<Record<PermissionCategory, PermissionDef[]>> {
  const defs = await getPermissionDefs();
  const grouped: Record<string, PermissionDef[]> = {};
  for (const def of defs) {
    if (!grouped[def.category]) grouped[def.category] = [];
    grouped[def.category].push(def);
  }
  return grouped as Record<PermissionCategory, PermissionDef[]>;
}

export async function getRolePermissions(role: string): Promise<Set<string>> {
  await loadRolePermissions();
  return rolePermissionsCache.get(role) || new Set();
}

export async function hasPermission(userId: string, userRoles: string[], permissionKey: string): Promise<boolean> {
  await loadRolePermissions();

  // Check preset roles
  for (const role of userRoles) {
    const perms = rolePermissionsCache?.get(role);
    if (perms?.has(permissionKey)) return true;
    // Owner role has all permissions by default (all keys in ROLE_DEFAULTS.owner)
  }

  // Check custom roles for this user
  const customResult = await sql(`SELECT crp.permission_key FROM user_custom_roles ucr
        JOIN custom_roles cr ON cr.name = ucr.custom_role_name
        JOIN role_permissions crp ON crp.role = cr.name
        WHERE ucr.user_id='${escapeStr(userId)}' AND crp.granted=1`);

  for (const row of customResult[0].rows) {
    if (row.permission_key === permissionKey) return true;
  }

  return false;
}

export async function hasAnyPermission(userId: string, userRoles: string[], permissionKeys: string[]): Promise<boolean> {
  for (const key of permissionKeys) {
    if (await hasPermission(userId, userRoles, key)) return true;
  }
  return false;
}

export async function getRoleDefinition(roleName: string): Promise<RoleDef | null> {
  await loadRolePermissions();
  const perms = rolePermissionsCache?.get(roleName);
  if (!perms) return null;

  const roleColors: Record<string, string> = {
    owner: '#ef4444', admin: '#f59e0b', god: '#a855f7',
    helper: '#3b82f6', youtuber: '#ec4899', member: '#6b7280',
  };
  const roleDescriptions: Record<string, string> = {
    owner: 'Full system control',
    admin: 'Full authorization',
    god: 'Ceremonial role with moderation capabilities',
    helper: 'Ticket management and QA',
    youtuber: 'Content creator role',
    member: 'Default member access',
  };

  return {
    name: roleName,
    color: roleColors[roleName] || '#6b7280',
    description: roleDescriptions[roleName] || '',
    isLocked: roleName === 'owner',
    permissions: perms,
  };
}

export async function getAllRoleDefinitions(): Promise<RoleDef[]> {
  const names = ['owner', 'admin', 'god', 'helper', 'youtuber', 'member'];
  const defs = await Promise.all(names.map(n => getRoleDefinition(n)));
  return defs.filter(Boolean) as RoleDef[];
}

export async function updateRolePermissions(role: string, permissions: Record<string, boolean>): Promise<void> {
  for (const [key, granted] of Object.entries(permissions)) {
    await sql(`INSERT OR REPLACE INTO role_permissions (role, permission_key, granted) VALUES ('${escapeStr(role)}', '${escapeStr(key)}', ${granted ? 1 : 0})`);
  }
  // Invalidate cache
  permissionsCache = null;
  rolePermissionsCache = null;
  cacheTime = 0;
}

export async function resetRoleToDefaults(role: string): Promise<void> {
  if (role === 'owner') return; // Cannot reset owner
  await sql(`DELETE FROM role_permissions WHERE role='${escapeStr(role)}'`);
  // Re-seed ONLY the target role's permissions
  const ROLE_DEFAULTS: Record<string, string[]> = {
    admin: ['auth.login', 'auth.edit_profile', 'social.player.search', 'social.player.view_public', 'social.friend.request', 'social.friend.accept', 'social.friend.reject', 'social.friend.remove', 'social.follow.request', 'social.follow.view', 'social.report.submit', 'inventory.view', 'inventory.sell', 'inventory.buy', 'inventory.gift', 'inventory.auction', 'inventory.hide', 'trades.create', 'trades.view', 'trades.negotiate', 'trades.cancel', 'market.view', 'market.purchase', 'tickets.create', 'tickets.view_own', 'tickets.view_assigned', 'tickets.respond', 'tickets.assign', 'tickets.close', 'mod.view_reports', 'mod.ban', 'mod.kick', 'mod.mute', 'mod.freeze', 'mod.warn', 'mod.jail', 'admin.dashboard', 'admin.servers', 'admin.users', 'admin.roles', 'admin.config', 'admin.branding', 'admin.store', 'admin.audit_log'],
    god: ['auth.login', 'auth.edit_profile', 'social.player.search', 'social.player.view_public', 'social.player.view_full', 'social.friend.request', 'social.friend.accept', 'social.friend.reject', 'social.friend.remove', 'social.follow.request', 'social.follow.view', 'social.report.submit', 'inventory.view', 'inventory.sell', 'inventory.buy', 'inventory.gift', 'inventory.auction', 'inventory.hide', 'trades.create', 'trades.view', 'trades.negotiate', 'trades.cancel', 'market.view', 'market.purchase', 'tickets.view_own', 'tickets.view_assigned', 'tickets.respond', 'mod.view_reports', 'mod.warn'],
    helper: ['auth.login', 'auth.edit_profile', 'social.player.search', 'social.player.view_public', 'social.friend.request', 'social.friend.accept', 'social.friend.reject', 'social.friend.remove', 'social.follow.request', 'social.follow.view', 'social.report.submit', 'inventory.view', 'inventory.sell', 'inventory.buy', 'inventory.gift', 'inventory.auction', 'inventory.hide', 'trades.create', 'trades.view', 'trades.negotiate', 'market.view', 'tickets.create', 'tickets.view_own', 'tickets.view_assigned', 'tickets.respond', 'mod.view_reports', 'mod.warn'],
    youtuber: ['auth.login', 'auth.edit_profile', 'social.player.search', 'social.player.view_public', 'social.friend.request', 'social.friend.accept', 'social.friend.reject', 'social.friend.remove', 'social.follow.request', 'social.follow.view', 'social.report.submit', 'inventory.view', 'inventory.sell', 'inventory.gift', 'inventory.auction', 'inventory.hide', 'trades.create', 'trades.view', 'trades.negotiate', 'trades.cancel', 'market.view', 'market.purchase'],
    member: ['auth.login', 'auth.edit_profile', 'social.player.search', 'social.player.view_public', 'social.friend.request', 'social.friend.accept', 'social.friend.reject', 'social.friend.remove', 'social.follow.request', 'social.follow.view', 'social.report.submit', 'inventory.view', 'inventory.sell', 'inventory.buy', 'inventory.gift', 'inventory.auction', 'inventory.hide', 'market.view', 'tickets.create', 'tickets.view_own'],
  };
  const defaults = ROLE_DEFAULTS[role] || [];
  for (const permKey of defaults) {
    await sql(`INSERT OR IGNORE INTO role_permissions (role, permission_key, granted) VALUES ('${escapeStr(role)}', '${escapeStr(permKey)}', 1)`);
  }
  // Invalidate cache
  permissionsCache = null;
  rolePermissionsCache = null;
  cacheTime = 0;
}

export async function logPermissionChange(
  performedBy: string,
  action: string,
  targetRole?: string,
  permissionKey?: string,
  oldValue?: string,
  newValue?: string
): Promise<void> {
  await sql(`INSERT INTO permission_audit_log (performed_by, action, target_role, permission_key, old_value, new_value)
    VALUES ('${escapeStr(performedBy)}', '${escapeStr(action)}', ${targetRole ? `'${escapeStr(targetRole)}'` : 'NULL'}, ${permissionKey ? `'${escapeStr(permissionKey)}'` : 'NULL'}, ${oldValue ? `'${escapeStr(oldValue)}'` : 'NULL'}, ${newValue ? `'${escapeStr(newValue)}'` : 'NULL'})`);
}
```

- [ ] **Step 2: Update lib/api-auth.ts with new auth helpers**

Read existing file first, then add:

```typescript
// Add to lib/api-auth.ts

import { hasPermission, hasAnyPermission } from './permissions';

export { hasPermission, hasAnyPermission };
```

- [ ] **Step 3: Update lib/db-frontend.ts with new DB functions**

Read existing file, then add to the bottom:

```typescript
// --- Custom Roles ---
// Add to lib/db-frontend.ts using existing patterns (import { sql, escapeStr } from '@/lib/database')

export async function getCustomRoles() {
  const r = await sql('SELECT * FROM custom_roles WHERE is_active=1 ORDER BY name');
  return r.length > 0 ? r[0].rows : [];
}

export async function getCustomRole(name: string) {
  const r = await sql(`SELECT * FROM custom_roles WHERE name='${escapeStr(name)}'`);
  return r[0]?.rows[0] || null;
}

export async function createCustomRole(data: { name: string; color: string; description?: string; icon?: string; created_by: string }) {
  await sql(`INSERT INTO custom_roles (name, color, description, icon, created_by) VALUES ('${escapeStr(data.name)}', '${escapeStr(data.color)}', '${escapeStr(data.description || '')}', '${escapeStr(data.icon || '')}', '${escapeStr(data.created_by)}')`);
}

export async function updateCustomRole(name: string, data: { color?: string; description?: string; icon?: string; is_active?: boolean }) {
  const sets: string[] = [];
  if (data.color !== undefined) sets.push(`color='${escapeStr(data.color)}'`);
  if (data.description !== undefined) sets.push(`description='${escapeStr(data.description)}'`);
  if (data.icon !== undefined) sets.push(`icon='${escapeStr(data.icon)}'`);
  if (data.is_active !== undefined) sets.push(`is_active=${data.is_active ? 1 : 0}`);
  if (sets.length === 0) return;
  await sql(`UPDATE custom_roles SET ${sets.join(', ')} WHERE name='${escapeStr(name)}'`);
}

export async function deleteCustomRole(name: string) {
  await sql(`DELETE FROM custom_roles WHERE name='${escapeStr(name)}'`);
  await sql(`DELETE FROM user_custom_roles WHERE custom_role_name='${escapeStr(name)}'`);
  await sql(`DELETE FROM role_permissions WHERE role='${escapeStr(name)}'`);
}

export async function assignCustomRoleToUser(userId: string, roleName: string, assignedBy: string) {
  await sql(`INSERT OR IGNORE INTO user_custom_roles (user_id, custom_role_name, assigned_by) VALUES ('${escapeStr(userId)}', '${escapeStr(roleName)}', '${escapeStr(assignedBy)}')`);
}

export async function removeCustomRoleFromUser(userId: string, roleName: string) {
  await sql(`DELETE FROM user_custom_roles WHERE user_id='${escapeStr(userId)}' AND custom_role_name='${escapeStr(roleName)}'`);
}

export async function getUserCustomRoles(userId: string) {
  const r = await sql(`SELECT custom_role_name FROM user_custom_roles WHERE user_id='${escapeStr(userId)}'`);
  return r[0]?.rows.map((row: any) => row.custom_role_name as string) || [];
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/permissions.ts lib/api-auth.ts lib/db-frontend.ts
git commit -m "feat: add permission engine lib and custom role DB functions"
```

---

### Task 3: API Routes — Permissions & Roles

**Files:**
- Create: `app/api/permissions/route.ts`
- Create: `app/api/roles/route.ts`
- Create: `app/api/roles/[role]/permissions/route.ts`
- Create: `app/api/roles/custom/route.ts`
- Create: `app/api/roles/custom/[name]/route.ts`
- Create: `app/api/discord-sync/route.ts`
- Create: `app/api/discord-sync/sync/route.ts`
- Create: `app/api/audit-log/route.ts`

- [ ] **Step 1: Create app/api/permissions/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getPermissionsByCategory, getPermissionDefs } from '@/lib/permissions';

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [byCategory, defs] = await Promise.all([
    getPermissionsByCategory(),
    getPermissionDefs(),
  ]);

  return NextResponse.json({ categories: byCategory, all: defs });
}
```

- [ ] **Step 2: Create app/api/roles/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getAllRoleDefinitions, getRoleDefinition } from '@/lib/permissions';
import { getCustomRoles } from '@/lib/db-frontend';

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [presetRoles, customRoles] = await Promise.all([
    getAllRoleDefinitions(),
    getCustomRoles(),
  ]);

  const preset = {};
  for (const role of presetRoles) {
    preset[role.name] = {
      color: role.color,
      description: role.description,
      isLocked: role.isLocked,
      permissions: Array.from(role.permissions),
    };
  }

  return NextResponse.json({ preset, custom: customRoles });
}
```

- [ ] **Step 3: Create app/api/roles/[role]/permissions/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getRoleDefinition, updateRolePermissions, resetRoleToDefaults, logPermissionChange } from '@/lib/permissions';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { role } = await params;

  if (role === 'owner') {
    return NextResponse.json({ error: 'Cannot modify owner role' }, { status: 403 });
  }

  const body = await request.json();
  const { permissions } = body as { permissions: Record<string, boolean> };

  // Log changes
  for (const [key, granted] of Object.entries(permissions)) {
    await logPermissionChange(
      user.id,
      granted ? 'role.permission.granted' : 'role.permission.revoked',
      role,
      key
    );
  }

  await updateRolePermissions(role, permissions);
  const updated = await getRoleDefinition(role);

  return NextResponse.json({ role: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { role } = await params;

  // Only owner is locked - other preset roles can be reset to defaults
  if (role === 'owner') {
    return NextResponse.json({ error: 'Cannot reset owner role' }, { status: 403 });
  }

  await resetRoleToDefaults(role);
  await logPermissionChange(user.id, 'role.reset', role);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Create app/api/roles/custom/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { createCustomRole, getCustomRoles } from '@/lib/db-frontend';
import { updateRolePermissions, logPermissionChange } from '@/lib/permissions';

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const roles = await getCustomRoles();
  return NextResponse.json(roles);
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, color, description, icon, permissions } = body;

  if (!name || name.length > 32) {
    return NextResponse.json({ error: 'Invalid role name' }, { status: 400 });
  }

  await createCustomRole({ name, color: color || '#6b7280', description, icon, created_by: user.id });

  if (permissions) {
    await updateRolePermissions(name, permissions);
  }

  await logPermissionChange(user.id, 'custom_role.created', name);
  return NextResponse.json({ success: true, name });
}
```

- [ ] **Step 5: Create app/api/roles/custom/[name]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getCustomRole, updateCustomRole, deleteCustomRole } from '@/lib/db-frontend';
import { updateRolePermissions, logPermissionChange } from '@/lib/permissions';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await params;
  const existing = await getCustomRole(name);
  if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 });

  const body = await request.json();
  const { color, description, icon, permissions } = body;

  await updateCustomRole(name, { color, description, icon });

  if (permissions) {
    await updateRolePermissions(name, permissions);
  }

  await logPermissionChange(user.id, 'custom_role.updated', name);
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await params;
  await deleteCustomRole(name);
  await logPermissionChange(user.id, 'custom_role.deleted', name);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Create app/api/discord-sync/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { sql, escapeStr } from '@/lib/database';

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const r = await sql('SELECT * FROM discord_role_mappings');
  return NextResponse.json(r[0]?.rows || []);
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { discord_role_id, discord_role_name, site_role, sync_direction } = body;

  await sql(`INSERT OR REPLACE INTO discord_role_mappings (discord_role_id, discord_role_name, site_role, sync_direction)
    VALUES ('${escapeStr(discord_role_id)}', '${escapeStr(discord_role_name)}', '${escapeStr(site_role)}', '${escapeStr(sync_direction || 'discord-to-site')}')`);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get('discord_role_id');
  if (!roleId) return NextResponse.json({ error: 'Missing roleId' }, { status: 400 });

  await sql(`DELETE FROM discord_role_mappings WHERE discord_role_id='${escapeStr(roleId)}'`);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 7: Create app/api/discord-sync/sync/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getDiscordUser, getUserDiscordRoles, mapDiscordRolesToSiteRoles, getGuildRoles } from '@/lib/discord';
import { upsertSiteUser } from '@/lib/db-frontend';
import { sql, escapeStr } from '@/lib/database';

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get all site users for sync
  const usersResult = await sql('SELECT id, email FROM site_users');
  const users = usersResult[0]?.rows || [];
  let synced = 0;
  let errors = 0;

  // Note: Full Discord re-auth would be needed for accurate role sync.
  // This endpoint serves as a trigger for manual re-verification.
  // In practice, role sync happens at login via Discord OAuth.

  return NextResponse.json({
    success: true,
    message: 'Discord sync triggered. Role sync occurs at next login for each user.',
    synced,
    errors,
  });
}
```

- [ ] **Step 8: Create app/api/audit-log/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { sql, escapeStr } from '@/lib/database';

export async function GET(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor') || '0';
  const limit = parseInt(searchParams.get('limit') || '50');
  const action = searchParams.get('action');
  const targetRole = searchParams.get('role');

  let query = 'SELECT * FROM permission_audit_log WHERE 1=1';

  if (action) {
    query += ` AND action='${escapeStr(action)}'`;
  }
  if (targetRole) {
    query += ` AND target_role='${escapeStr(targetRole)}'`;
  }

  query += ` ORDER BY timestamp DESC LIMIT ${limit + 1} OFFSET ${parseInt(cursor)}`;

  const r = await sql(query);
  const rows = r[0]?.rows || [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(parseInt(cursor) + limit) : null;

  return NextResponse.json({ items, nextCursor });
}
```

- [ ] **Step 9: Commit**

```bash
git add app/api/permissions/ app/api/roles/ app/api/discord-sync/ app/api/audit-log/
git commit -m "feat: add permissions and roles API routes"
```

---

## Phase 2: Admin Roles UI

### Task 4: Admin Roles Page — Core Structure

**Files:**
- Modify: `app/(admin)/admin/roles/page.tsx`
- Create: `app/(admin)/admin/roles/components/PermissionPopup.tsx`
- Create: `app/(admin)/admin/roles/components/RoleCard.tsx`
- Create: `app/(admin)/admin/roles/components/CustomRoleCreator.tsx`
- Create: `app/(admin)/admin/roles/components/DiscordSyncPanel.tsx`
- Create: `app/(admin)/admin/roles/components/AuditLogTable.tsx`
- Create: `components/ui/permission-toggle.tsx`

- [ ] **Step 1: Read existing roles page and UI components**

```bash
head -50 app/(admin)/admin/roles/page.tsx
```

- [ ] **Step 2: Create components/ui/permission-toggle.tsx**

```tsx
'use client';

import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface PermissionToggleProps {
  permissionKey: string;
  label: string;
  description: string;
  isDangerous: boolean;
  granted: boolean;
  onChange: (key: string, granted: boolean) => void;
  disabled?: boolean;
}

export function PermissionToggle({
  permissionKey,
  label,
  description,
  isDangerous,
  granted,
  onChange,
  disabled,
}: PermissionToggleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'group flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
        'hover:bg-white/[0.03]',
        isDangerous && granted && 'bg-amber-500/5 border-l-2 border-amber-500/40',
        !isDangerous && granted && 'bg-cyan-500/5 border-l-2 border-cyan-500/40'
      )}
    >
      {/* Toggle Switch */}
      <button
        role="switch"
        aria-checked={granted}
        onClick={() => !disabled && onChange(permissionKey, !granted)}
        className={clsx(
          'relative mt-0.5 size-9 rounded-full border-2 transition-all duration-200 shrink-0',
          granted
            ? 'bg-cyan-500/20 border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
            : 'bg-white/5 border-white/20 hover:border-white/40',
          disabled && 'opacity-40 cursor-not-allowed'
        )}
      >
        <motion.div
          animate={{ scale: granted ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-1 rounded-full bg-cyan-400"
        />
      </button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={clsx(
            'text-sm font-medium',
            granted ? 'text-white' : 'text-white/50'
          )}>
            {label}
          </span>
          {isDangerous && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              <AlertTriangle className="size-2.5" />
              Dangerous
            </span>
          )}
        </div>
        <p className="text-xs text-white/30 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Create RoleCard component**

```tsx
// app/(admin)/admin/roles/components/RoleCard.tsx
'use client';

import { motion } from 'motion/react';
import { Lock, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface RoleCardProps {
  name: string;
  color: string;
  description: string;
  userCount: number;
  permissionCount: number;
  isLocked: boolean;
  onClick: () => void;
}

export function RoleCard({ name, color, description, userCount, permissionCount, isLocked, onClick }: RoleCardProps) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={clsx(
        'w-full text-left p-4 rounded-xl border transition-all duration-200',
        'bg-[#111827]/60 backdrop-blur-sm',
        'border-white/[0.08] hover:border-white/[0.15]',
        'hover:shadow-[0_0_20px_rgba(0,0,0,0.3)]'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="size-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]"
            style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
          />
          <span className="text-sm font-bold text-white capitalize">{name}</span>
          {isLocked && <Lock className="size-3 text-white/30" />}
        </div>
        <ChevronRight className="size-4 text-white/30 group-hover:text-cyan-400 transition-colors" />
      </div>

      <p className="text-xs text-white/40 mt-1.5 line-clamp-1">{description}</p>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]">
        <span className="text-[11px] text-white/30">
          <span className="text-white/50 font-medium">{permissionCount}</span> permissions
        </span>
        <span className="text-[11px] text-white/30">
          <span className="text-white/50 font-medium">{userCount}</span> users
        </span>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{
            backgroundColor: `${color}15`,
            color: color,
            border: `1px solid ${color}30`,
          }}
        >
          {name}
        </span>
      </div>
    </motion.button>
  );
}
```

- [ ] **Step 4: Create PermissionPopup component**

```tsx
// app/(admin)/admin/roles/components/PermissionPopup.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, Save, Loader2 } from 'lucide-react';
import { PermissionToggle } from '@/components/ui/permission-toggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { clsx } from 'clsx';
import type { PermissionCategory } from '@/lib/permissions';

interface PermissionPopupProps {
  role: { name: string; color: string; description: string; isLocked: boolean; permissions: string[] };
  categories: Record<PermissionCategory, Array<{ key: string; label: string; description: string; isDangerous: boolean }>>;
  onClose: () => void;
  onSave: (permissions: Record<string, boolean>) => void;
  onReset: () => void;
  saving: boolean;
}

export function PermissionPopup({ role, categories, onClose, onSave, onReset, saving }: PermissionPopupProps) {
  const [localPerms, setLocalPerms] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const perms of Object.values(categories)) {
      for (const p of perms) {
        init[p.key] = role.permissions.includes(p.key);
      }
    }
    return init;
  });

  const hasChanges = JSON.stringify(localPerms) !== JSON.stringify(
    Object.fromEntries(role.permissions.map(k => [k, true]))
  );

  const categoryLabels: Record<PermissionCategory, string> = {
    AUTH: 'Auth & Identity',
    SOCIAL: 'Social & Friends',
    INVENTORY: 'Inventory & Trading',
    TRADES: 'Trade Hub',
    MARKETPLACE: 'Marketplace',
    TICKETS: 'Support Tickets',
    MODERATION: 'Moderation',
    ADMIN: 'Admin Panel',
    GOD: 'God View',
  };

  const categoryColors: Record<PermissionCategory, string> = {
    AUTH: '#06b6d4',
    SOCIAL: '#8b5cf6',
    INVENTORY: '#22c55e',
    TRADES: '#f59e0b',
    MARKETPLACE: '#ec4899',
    TICKETS: '#3b82f6',
    MODERATION: '#ef4444',
    ADMIN: '#f97316',
    GOD: '#a855f7',
  };

  const handleToggle = (key: string, granted: boolean) => {
    setLocalPerms(prev => ({ ...prev, [key]: granted }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, x: 50 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.95, x: 50 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[520px] max-h-[85vh] bg-[#0d1320] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: role.color, boxShadow: `0 0 8px ${role.color}60` }}
            />
            <span className="text-base font-bold text-white capitalize">{role.name}</span>
            <Badge variant={role.isLocked ? 'danger' : 'info'} size="sm">
              {role.isLocked ? 'Locked' : 'Preset'}
            </Badge>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40">
            <X className="size-4" />
          </button>
        </div>

        {/* Subheader */}
        <div className="px-5 py-3 bg-white/[0.02] border-b border-white/[0.06] shrink-0">
          <p className="text-xs text-white/40">{role.description}</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {(Object.keys(categories) as PermissionCategory[]).map(category => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="size-2 rounded-full"
                  style={{ backgroundColor: categoryColors[category] }}
                />
                <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">
                  {categoryLabels[category]}
                </span>
                <span className="text-[10px] text-white/20">
                  {categories[category].length} permissions
                </span>
              </div>

              <div className="space-y-0.5 ml-1">
                {categories[category].map(perm => (
                  <PermissionToggle
                    key={perm.key}
                    permissionKey={perm.key}
                    label={perm.label}
                    description={perm.description}
                    isDangerous={perm.isDangerous}
                    granted={localPerms[perm.key] || false}
                    onChange={handleToggle}
                    disabled={role.isLocked}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06] shrink-0 bg-[#0a0f1a]">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={role.isLocked || saving}
            icon={<RotateCcw className="size-3" />}
          >
            Reset to Defaults
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSave(localPerms)}
              disabled={role.isLocked || !hasChanges || saving}
              icon={saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 5: Create CustomRoleCreator component**

```tsx
// app/(admin)/admin/roles/components/CustomRoleCreator.tsx
'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PermissionToggle } from '@/components/ui/permission-toggle';
import type { PermissionCategory } from '@/lib/permissions';

interface CustomRoleCreatorProps {
  categories: Record<PermissionCategory, Array<{ key: string; label: string; description: string; isDangerous: boolean }>>;
  onClose: () => void;
  onSave: (data: { name: string; color: string; description: string; icon: string; permissions: Record<string, boolean> }) => void;
  saving: boolean;
}

const PRESET_COLORS = [
  '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b',
  '#ef4444', '#3b82f6', '#10b981', '#f97316', '#a855f7',
];

export function CustomRoleCreator({ categories, onClose, onSave, saving }: CustomRoleCreatorProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#22c55e');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [perms, setPerms] = useState<Record<string, boolean>>({});

  const handleToggle = (key: string, granted: boolean) => {
    setPerms(prev => ({ ...prev, [key]: granted }));
  };

  const categoryLabels: Record<PermissionCategory, string> = {
    AUTH: 'Auth & Identity', SOCIAL: 'Social', INVENTORY: 'Inventory',
    TRADES: 'Trade Hub', MARKETPLACE: 'Marketplace', TICKETS: 'Tickets',
    MODERATION: 'Moderation', ADMIN: 'Admin', GOD: 'God View',
  };

  const categoryColors: Record<PermissionCategory, string> = {
    AUTH: '#06b6d4', SOCIAL: '#8b5cf6', INVENTORY: '#22c55e',
    TRADES: '#f59e0b', MARKETPLACE: '#ec4899', TICKETS: '#3b82f6',
    MODERATION: '#ef4444', ADMIN: '#f97316', GOD: '#a855f7',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[600px] max-h-[85vh] bg-[#0d1320] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-cyan-400" />
            <span className="text-sm font-bold text-white">Create Custom Role</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40">
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 block">Name</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="VIP Member"
                maxLength={32}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 block">Icon (emoji)</label>
              <Input
                value={icon}
                onChange={e => setIcon(e.target.value)}
                placeholder="⭐"
                maxLength={8}
                className="w-full text-center text-lg"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 block">Description</label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this role..."
              maxLength={256}
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2 block">Color</label>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="size-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? 'white' : 'transparent',
                      boxShadow: color === c ? `0 0 8px ${c}80` : 'none',
                    }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="size-7 rounded cursor-pointer bg-transparent"
              />
              <span className="text-xs text-white/30">{color}</span>
            </div>
          </div>

          {/* Permission Assignment */}
          <div>
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-3 block">
              Permissions ({Object.values(perms).filter(Boolean).length} selected)
            </label>
            {(Object.keys(categories) as PermissionCategory[]).map(category => (
              <div key={category} className="mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="size-2 rounded-full" style={{ backgroundColor: categoryColors[category] }} />
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    {categoryLabels[category]}
                  </span>
                </div>
                <div className="space-y-0.5 ml-1">
                  {categories[category].map(perm => (
                    <PermissionToggle
                      key={perm.key}
                      permissionKey={perm.key}
                      label={perm.label}
                      description={perm.description}
                      isDangerous={perm.isDangerous}
                      granted={perms[perm.key] || false}
                      onChange={handleToggle}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06] bg-[#0a0f1a]">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onSave({ name, color, description, icon, permissions: perms })}
            disabled={!name.trim() || saving}
            icon={saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
          >
            {saving ? 'Creating...' : 'Create Role'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 6: Create DiscordSyncPanel component**

```tsx
// app/(admin)/admin/roles/components/DiscordSyncPanel.tsx
'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface DiscordMapping {
  discord_role_id: string;
  discord_role_name: string;
  site_role: string;
  sync_direction: string;
}

interface DiscordSyncPanelProps {
  mappings: DiscordMapping[];
  presetRoles: string[];
  onAddMapping: (mapping: Omit<DiscordMapping, 'sync_direction'>) => void;
  onDeleteMapping: (discordRoleId: string) => void;
  onSync: () => void;
  syncing: boolean;
}

export function DiscordSyncPanel({ mappings, presetRoles, onAddMapping, onDeleteMapping, onSync, syncing }: DiscordSyncPanelProps) {
  const [discordRoleId, setDiscordRoleId] = useState('');
  const [discordRoleName, setDiscordRoleName] = useState('');
  const [siteRole, setSiteRole] = useState('');

  const handleAdd = () => {
    if (!discordRoleId || !discordRoleName || !siteRole) return;
    onAddMapping({ discord_role_id: discordRoleId, discord_role_name: discordRoleName, site_role: siteRole });
    setDiscordRoleId('');
    setDiscordRoleName('');
    setSiteRole('');
  };

  return (
    <div className="space-y-5">
      {/* Sync Action */}
      <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
        <div>
          <div className="text-sm font-medium text-white">Discord Role Sync</div>
          <div className="text-xs text-white/40 mt-0.5">
            Sync Discord guild roles to site roles. Changes take effect on next login.
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onSync}
          disabled={syncing}
          icon={syncing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {/* Existing Mappings */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Discord Role</span>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">→</span>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Site Role</span>
          <span />
        </div>

        {mappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-white/30">
            <AlertCircle className="size-8 mb-2 opacity-30" />
            <p className="text-sm">No Discord role mappings configured</p>
          </div>
        ) : (
          mappings.map(mapping => (
            <div
              key={mapping.discord_role_id}
              className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-[#5865F2]" />
                <span className="text-sm text-white/70">{mapping.discord_role_name}</span>
                <span className="text-[10px] text-white/30 font-mono">{mapping.discord_role_id.slice(0, 8)}...</span>
              </div>
              <span className="text-white/30">→</span>
              <div className="flex items-center gap-2">
                <Badge variant="default" size="sm">{mapping.site_role}</Badge>
              </div>
              <button
                onClick={() => onDeleteMapping(mapping.discord_role_id)}
                className="p-1 rounded hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Mapping */}
      <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
        <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Add Discord Role Mapping</div>
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3">
          <Input
            value={discordRoleId}
            onChange={e => setDiscordRoleId(e.target.value)}
            placeholder="Discord Role ID"
          />
          <Input
            value={discordRoleName}
            onChange={e => setDiscordRoleName(e.target.value)}
            placeholder="@RoleName"
          />
          <select
            value={siteRole}
            onChange={e => setSiteRole(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="">Select site role...</option>
            {presetRoles.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAdd}
            disabled={!discordRoleId || !discordRoleName || !siteRole}
            icon={<Plus className="size-3" />}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create AuditLogTable component**

```tsx
// app/(admin)/admin/roles/components/AuditLogTable.tsx
'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, RefreshCw, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AuditEntry {
  id: number;
  performed_by: string;
  action: string;
  target_role: string | null;
  permission_key: string | null;
  old_value: string | null;
  new_value: string | null;
  timestamp: string;
}

interface AuditLogTableProps {
  entries: AuditEntry[];
  onLoadMore: () => void;
  loading: boolean;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  'role.permission.granted': { label: 'Permission Granted', color: 'success' },
  'role.permission.revoked': { label: 'Permission Revoked', color: 'danger' },
  'role.reset': { label: 'Role Reset', color: 'warning' },
  'custom_role.created': { label: 'Custom Role Created', color: 'success' },
  'custom_role.updated': { label: 'Custom Role Updated', color: 'warning' },
  'custom_role.deleted': { label: 'Custom Role Deleted', color: 'danger' },
};

export function AuditLogTable({ entries, onLoadMore, loading }: AuditLogTableProps) {
  return (
    <div className="space-y-3">
      {entries.length === 0 && !loading ? (
        <div className="text-center py-12 text-white/30 text-sm">
          No audit log entries yet
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest w-16">Time</span>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Action</span>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Target</span>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">By</span>
            </div>

            {entries.map((entry, i) => {
              const info = actionLabels[entry.action] || { label: entry.action, color: 'default' as const };
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-[11px] text-white/30 font-mono w-16">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={info.color as any} size="sm">{info.label}</Badge>
                    {entry.permission_key && (
                      <span className="text-[11px] text-white/40 font-mono">{entry.permission_key}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-white/50">{entry.target_role || '—'}</span>
                  <span className="text-[11px] text-white/30 text-right">{entry.performed_by.slice(0, 8)}...</span>
                </motion.div>
              );
            })}
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="size-5 text-cyan-400 animate-spin" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Write the main roles page**

Read the existing roles page, then replace entirely with the new implementation. The new page fetches from `/api/permissions` and `/api/roles`, manages tab state, renders RoleCards in a grid, opens PermissionPopup on role click, handles save/reset API calls.

```tsx
// app/(admin)/admin/roles/page.tsx — complete rewrite
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Shield, Users, Plus, RefreshCw, Loader2, Settings } from 'lucide-react';
import { RoleCard } from './components/RoleCard';
import { PermissionPopup } from './components/PermissionPopup';
import { CustomRoleCreator } from './components/CustomRoleCreator';
import { DiscordSyncPanel } from './components/DiscordSyncPanel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/error-debug-toast';

type PermissionCategory = 'AUTH' | 'SOCIAL' | 'INVENTORY' | 'TRADES' | 'MARKETPLACE' | 'TICKETS' | 'MODERATION' | 'ADMIN' | 'GOD';

interface PermissionDef {
  key: string; label: string; description: string; isDangerous: boolean; category: PermissionCategory;
}

interface RoleData {
  color: string; description: string; isLocked: boolean; permissions: string[];
}

interface CustomRole {
  name: string; color: string; description: string; icon: string; is_active: boolean;
}

const PRESET_ROLE_NAMES = ['owner', 'admin', 'god', 'helper', 'youtuber', 'member'];

const TABS = ['Preset Roles', 'Custom Roles', 'Discord Sync', 'Audit Log'] as const;
type Tab = typeof TABS[number];

export default function RolesAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Preset Roles');
  const [categories, setCategories] = useState<Record<PermissionCategory, PermissionDef[]>>({} as Record<PermissionCategory, PermissionDef[]>);
  const [presetRoles, setPresetRoles] = useState<Record<string, RoleData>>({});
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [discordMappings, setDiscordMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [selectedRole, setSelectedRole] = useState<{ name: string; color: string; description: string; isLocked: boolean; permissions: string[] } | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  const addToast = useToast(s => s.addToast);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [permRes, rolesRes, discordRes] = await Promise.all([
        fetch('/api/permissions'),
        fetch('/api/roles'),
        fetch('/api/discord-sync'),
      ]);

      if (permRes.ok) {
        const data = await permRes.json();
        setCategories(data.categories);
      }
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setPresetRoles(data.preset);
        setCustomRoles(data.custom || []);
      }
      if (discordRes.ok) {
        setDiscordMappings(await discordRes.json());
      }

      // Fetch user counts per role
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const users = await usersRes.json();
        const counts: Record<string, number> = {};
        for (const u of users) {
          for (const r of (u.roles || [])) {
            counts[r] = (counts[r] || 0) + 1;
          }
        }
        setUserCounts(counts);
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to load', message: 'Could not fetch roles data' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSavePermissions = async (roleName: string, permissions: Record<string, boolean>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${roleName}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error();
      addToast({ type: 'success', title: 'Saved', message: `${roleName} permissions updated` });
      setSelectedRole(null);
      await fetchData();
    } catch {
      addToast({ type: 'error', title: 'Save failed', message: 'Could not save permissions' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetRole = async (roleName: string) => {
    if (!confirm(`Reset ${roleName} to default permissions?`)) return;
    try {
      await fetch(`/api/roles/${roleName}/permissions`, { method: 'DELETE' });
      addToast({ type: 'success', title: 'Reset', message: `${roleName} reset to defaults` });
      setSelectedRole(null);
      await fetchData();
    } catch {
      addToast({ type: 'error', title: 'Reset failed', message: 'Could not reset role' });
    }
  };

  const handleCreateCustomRole = async (data: { name: string; color: string; description: string; icon: string; permissions: Record<string, boolean> }) => {
    setSaving(true);
    try {
      const res = await fetch('/api/roles/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      addToast({ type: 'success', title: 'Created', message: `Custom role "${data.name}" created` });
      setShowCreator(false);
      await fetchData();
    } catch {
      addToast({ type: 'error', title: 'Create failed', message: 'Could not create custom role' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddDiscordMapping = async (mapping: { discord_role_id: string; discord_role_name: string; site_role: string }) => {
    try {
      await fetch('/api/discord-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mapping, sync_direction: 'discord-to-site' }),
      });
      await fetchData();
    } catch {
      addToast({ type: 'error', title: 'Mapping failed', message: 'Could not add Discord mapping' });
    }
  };

  const handleDeleteDiscordMapping = async (roleId: string) => {
    try {
      await fetch(`/api/discord-sync?discord_role_id=${roleId}`, { method: 'DELETE' });
      await fetchData();
    } catch {
      addToast({ type: 'error', title: 'Delete failed', message: 'Could not delete mapping' });
    }
  };

  const handleDiscordSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/discord-sync/sync', { method: 'POST' });
      addToast({ type: 'success', title: 'Sync triggered', message: 'Role sync initiated' });
    } catch {
      addToast({ type: 'error', title: 'Sync failed', message: 'Could not trigger sync' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center">
              <Shield className="size-5 text-cyan-400" />
            </div>
            Roles & Permissions
          </h1>
          <p className="text-sm text-white/40 mt-1">Manage roles and their capabilities</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchData}
          icon={<RefreshCw className="size-3" />}
        >
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-cyan-500/15 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Preset Roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {PRESET_ROLE_NAMES.map(name => {
            const role = presetRoles[name];
            if (!role) return null;
            return (
              <RoleCard
                key={name}
                name={name}
                color={role.color}
                description={role.description}
                userCount={userCounts[name] || 0}
                permissionCount={role.permissions.length}
                isLocked={role.isLocked}
                onClick={() => setSelectedRole({ name, ...role })}
              />
            );
          })}
        </div>
      )}

      {activeTab === 'Custom Roles' && (
        <div className="space-y-4">
          <Button variant="secondary" size="sm" onClick={() => setShowCreator(true)} icon={<Plus className="size-3" />}>
            Create Custom Role
          </Button>
          {customRoles.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <Users className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No custom roles yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {customRoles.map(role => (
                <RoleCard
                  key={role.name}
                  name={role.name}
                  color={role.color}
                  description={role.description || 'Custom role'}
                  userCount={0}
                  permissionCount={0}
                  isLocked={false}
                  onClick={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Discord Sync' && (
        <DiscordSyncPanel
          mappings={discordMappings}
          presetRoles={PRESET_ROLE_NAMES}
          onAddMapping={handleAddDiscordMapping}
          onDeleteMapping={handleDeleteDiscordMapping}
          onSync={handleDiscordSync}
          syncing={syncing}
        />
      )}

      {activeTab === 'Audit Log' && (
        <AuditLogTable onLoadMore={() => {}} loading={false} />
      )}

      {/* Permission Popup */}
      <AnimatePresence>
        {selectedRole && categories && (
          <PermissionPopup
            role={selectedRole}
            categories={categories}
            onClose={() => setSelectedRole(null)}
            onSave={perms => handleSavePermissions(selectedRole.name, perms)}
            onReset={() => handleResetRole(selectedRole.name)}
            saving={saving}
          />
        )}
      </AnimatePresence>

      {/* Custom Role Creator */}
      <AnimatePresence>
        {showCreator && categories && (
          <CustomRoleCreator
            categories={categories}
            onClose={() => setShowCreator(false)}
            onSave={handleCreateCustomRole}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add app/(admin)/admin/roles/ components/ui/permission-toggle.tsx
git commit -m "feat: rebuild admin roles page with permission editor UI"
```

---

## Phase 3: Social Platform

### Task 5: Social Page Rebuild

**Files:**
- Modify: `app/(public)/social/page.tsx`
- Modify: `app/api/users/me/requests/[id]/route.ts`
- Modify: `app/api/users/me/friends/[friendId]/route.ts`

- [ ] **Step 1: Read existing social page**

```bash
wc -l app/(public)/social/page.tsx && head -80 app/(public)/social/page.tsx
```

- [ ] **Step 2: Read request API routes**

Read `app/api/users/me/requests/route.ts` and `app/api/users/me/requests/[id]/route.ts`.

- [ ] **Step 3: Write the new social page**

The new social page has three tabs: Friends (grouped by Online on SMP / Online on Site / Offline), Requests (Received + Sent with status), Find Players (search with filters). Key changes:

- Friends tab groups friends by online status (SMP vs Site vs Offline) using player data from `GET /api/players`
- Requests tab shows status to sender (pending/accepted/rejected)
- API returns status in sent requests
- Find Players has filter chips for All / Online on SMP / Online on Site / Offline

```tsx
// app/(public)/social/page.tsx — complete rebuild
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, Users, UserCheck, Clock, X, Check, ChevronRight, Loader2, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/error-debug-toast';
import { clsx } from 'clsx';

type Tab = 'Friends' | 'Requests' | 'Find Players';
type FilterChip = 'All' | 'Online on SMP' | 'Online on Site' | 'Offline';

interface Friend {
  id: string;
  mc_username: string;
  site_name: string;
  avatar_url: string | null;
  is_online?: boolean;
  online_server?: string;
}
interface FriendRequest {
  id: string;
  from_id: string;
  to_id: string;
  from_username: string;
  from_site_name: string;
  from_avatar: string | null;
  to_username: string;
  status: 'pending' | 'accepted' | 'rejected';
  is_incoming: boolean;
}

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [filter, setFilter] = useState<FilterChip>('All');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const addToast = useToast(s => s.addToast);

  const fetchFriends = useCallback(async () => {
    try {
      const [friendsRes, reqsRes] = await Promise.all([
        fetch('/api/users/me/friends'),
        fetch('/api/users/me/requests'),
      ]);
      if (friendsRes.ok) setFriends(await friendsRes.json());
      if (reqsRes.ok) setRequests(await reqsRes.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFriends(); }, [fetchFriends]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
        if (res.ok) setSearchResults(await res.json());
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddFriend = async (userId: string) => {
    setProcessingIds(prev => new Set([...prev, userId]));
    try {
      const res = await fetch('/api/users/me/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toId: userId, type: 'friend' }),
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Request Sent', message: 'Friend request sent successfully' });
        await fetchFriends();
      } else {
        const data = await res.json();
        addToast({ type: 'error', title: 'Failed', message: data.error || 'Could not send request' });
      }
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setProcessingIds(prev => new Set([...prev, requestId]));
    try {
      const res = await fetch(`/api/users/me/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Accepted', message: 'Friend request accepted' });
        await fetchFriends();
      }
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessingIds(prev => new Set([...prev, requestId]));
    try {
      const res = await fetch(`/api/users/me/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Rejected', message: 'Friend request rejected' });
        await fetchFriends();
      }
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(requestId); return s; });
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm('Remove this friend?')) return;
    try {
      const res = await fetch(`/api/users/me/friends?friendId=${friendId}`, { method: 'DELETE' });
      if (res.ok) {
        addToast({ type: 'success', title: 'Removed', message: 'Friend removed' });
        await fetchFriends();
      }
    } catch {
      addToast({ type: 'error', title: 'Failed', message: 'Could not remove friend' });
    }
  };

  const onlineSMP = friends.filter(f => f.is_online && f.online_server);
  const onlineSite = friends.filter(f => f.is_online && !f.online_server);
  const offline = friends.filter(f => !f.is_online);

  const filteredSearchResults = searchResults.filter(r => {
    if (filter === 'All') return true;
    if (filter === 'Online on SMP') return r.is_online && r.online_server;
    if (filter === 'Online on Site') return r.is_online && !r.online_server;
    if (filter === 'Offline') return !r.is_online;
    return true;
  });

  const incoming = requests.filter(r => r.is_incoming && r.status === 'pending');
  const sent = requests.filter(r => !r.is_incoming);

  const statusIcon = (status: string) => {
    if (status === 'accepted') return <Check className="size-3 text-green-400" />;
    if (status === 'rejected') return <X className="size-3 text-red-400" />;
    return <Clock className="size-3 text-amber-400" />;
  };

  const statusLabel = (status: string) => {
    if (status === 'accepted') return 'Accepted';
    if (status === 'rejected') return 'Rejected';
    return 'Pending';
  };

  const FriendCard = ({ friend, showRemove }: { friend: Friend; showRemove?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] hover:border-white/[0.1] transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="size-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 overflow-hidden flex items-center justify-center">
            {friend.avatar_url ? (
              <img src={friend.avatar_url} alt="" className="size-full object-cover" />
            ) : (
              <Users className="size-4 text-white/30" />
            )}
          </div>
          <div className={clsx(
            'absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#0a0f1a]',
            friend.is_online ? 'bg-green-400' : 'bg-white/30'
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {friend.site_name || friend.mc_username}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/30">
            <span className={friend.is_online ? 'text-green-400' : ''}>
              {friend.is_online ? (friend.online_server ? '● Online on SMP' : '● Online') : '○ Offline'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a href={`/players/${friend.id}`}>
            <Button variant="ghost" size="sm">Profile</Button>
          </a>
          {showRemove && (
            <Button variant="ghost" size="sm" onClick={() => handleRemoveFriend(friend.id)} className="text-red-400 hover:text-red-300">
              <UserMinus className="size-3" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Social</h1>
        <p className="text-sm text-white/40 mt-1">Manage friends and find players</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/30" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search players by name or username..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-cyan-400 animate-spin" />}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl w-fit">
        {(['Friends', 'Requests', 'Find Players'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab
                ? 'bg-cyan-500/15 text-cyan-400'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab}
            {tab === 'Requests' && incoming.length > 0 && (
              <span className="size-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center">
                {incoming.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="size-6 text-cyan-400 animate-spin" />
        </div>
      ) : activeTab === 'Friends' && (
        <div className="space-y-6">
          {onlineSMP.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <div className="size-2 rounded-full bg-green-400" />
                Online on SMP ({onlineSMP.length})
              </div>
              <div className="space-y-2">{onlineSMP.map(f => <FriendCard key={f.id} friend={f} showRemove />)}</div>
            </div>
          )}
          {onlineSite.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <div className="size-2 rounded-full bg-cyan-400" />
                Online on Site ({onlineSite.length})
              </div>
              <div className="space-y-2">{onlineSite.map(f => <FriendCard key={f.id} friend={f} showRemove />)}</div>
            </div>
          )}
          {offline.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                <div className="size-2 rounded-full bg-white/30" />
                Offline ({offline.length})
              </div>
              <div className="space-y-2">{offline.map(f => <FriendCard key={f.id} friend={f} showRemove />)}</div>
            </div>
          )}
          {friends.length === 0 && (
            <div className="text-center py-16 text-white/30">
              <Users className="size-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No friends yet. Find players to add!</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Requests' && (
        <div className="space-y-6">
          {/* Received */}
          <div>
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
              Received ({incoming.length})
            </div>
            <div className="space-y-2">
              {incoming.map(req => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"
                >
                  <div className="size-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center overflow-hidden">
                    {req.from_avatar ? (
                      <img src={req.from_avatar} alt="" className="size-full object-cover" />
                    ) : (
                      <Users className="size-4 text-white/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{req.from_site_name || req.from_username}</div>
                    <div className="text-[11px] text-white/30">wants to be your friend</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAcceptRequest(req.id)}
                      disabled={processingIds.has(req.id)}
                      icon={<Check className="size-3" />}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRejectRequest(req.id)}
                      disabled={processingIds.has(req.id)}
                      className="text-red-400"
                    >
                      Reject
                    </Button>
                  </div>
                </motion.div>
              ))}
              {incoming.length === 0 && <p className="text-sm text-white/30 py-4">No incoming requests</p>}
            </div>
          </div>

          {/* Sent */}
          <div>
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
              Sent ({sent.length})
            </div>
            <div className="space-y-2">
              {sent.map(req => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"
                >
                  <div className="size-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center overflow-hidden">
                    {req.from_avatar ? (
                      <img src={req.from_avatar} alt="" className="size-full object-cover" />
                    ) : (
                      <Users className="size-4 text-white/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{req.to_username}</div>
                    <div className="text-[11px] text-white/30">Friend request</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={req.status === 'accepted' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'}
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      {statusIcon(req.status)}
                      {statusLabel(req.status)}
                    </Badge>
                  </div>
                </div>
              ))}
              {sent.length === 0 && <p className="text-sm text-white/30 py-4">No sent requests</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Find Players' && (
        <div className="space-y-4">
          {/* Filter chips */}
          <div className="flex gap-2 flex-wrap">
            {(['All', 'Online on SMP', 'Online on Site', 'Offline'] as FilterChip[]).map(chip => (
              <button
                key={chip}
                onClick={() => setFilter(chip)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === chip
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:border-white/[0.1]'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          {searchQuery && filteredSearchResults.length === 0 && !searching && (
            <p className="text-sm text-white/30 py-8 text-center">No players found matching "{searchQuery}"</p>
          )}

          <div className="space-y-2">
            {filteredSearchResults.map(player => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] hover:border-white/[0.1] transition-all group"
              >
                <div className="size-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center overflow-hidden">
                  {player.avatar_url ? (
                    <img src={player.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    <Users className="size-4 text-white/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{player.site_name || player.mc_username}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                    <span className={player.is_online ? 'text-green-400' : ''}>
                      {player.is_online ? '● Online' : '○ Offline'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={`/players/${player.id}`}>
                    <Button variant="ghost" size="sm">Profile</Button>
                  </a>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddFriend(player.id)}
                    disabled={processingIds.has(player.id)}
                    icon={processingIds.has(player.id) ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />}
                  >
                    Add Friend
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update requests API to return status to sender**

Read the existing route, then update the GET handler to include status for sent requests:

```typescript
// In GET handler for /api/users/me/requests
// When returning sent requests, include the current status
```

- [ ] **Step 5: Commit**

```bash
git add app/(public)/social/page.tsx app/api/users/me/requests/ app/api/users/me/friends/
git commit -m "feat: rebuild social page with friend status visibility and improved search"
```

---

## Phase 4: Integration & Middleware

### Task 6: Update Middleware & Auth Hooks

**Files:**
- Modify: `middleware.ts`
- Modify: `hooks/use-auth.ts`
- Create: `hooks/use-permission.ts`

- [ ] **Step 1: Update hooks/use-auth.ts**

Add `usePermission` and `useAnyPermission`:

```typescript
// Add to hooks/use-auth.ts
export function usePermission(permissionKey: string): boolean {
  const { user } = useAuth();
  // Client-side: use cached role permissions
  // For now, check against user.roles (will be refined when server provides full permission set)
  if (!user) return false;
  return hasAnyPermission(user.id, user.roles || [], [permissionKey]);
}
```

- [ ] **Step 2: Update middleware.ts to use fine-grained checks**

Update route protection to check specific permissions:

```typescript
// In middleware.ts, update admin route check:
if (pathname.startsWith('/admin')) {
  if (!session) return NextResponse.redirect(new URL('/', request.url));
  // Use specific admin permission
  const hasAdminPerm = session.roles?.includes('admin') || session.roles?.includes('owner');
  if (!hasAdminPerm) return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

- [ ] **Step 3: Commit**

```bash
git add hooks/use-auth.ts middleware.ts
git commit -m "feat: update auth hooks for fine-grained permissions"
```

---

## Summary of Tasks

| Phase | Task | Files | Approx Lines |
|-------|------|-------|-------------|
| 1 | DB Migration | `004_permissions.sql`, `migrate.ts`, `seed-permissions.ts` | ~300 |
| 1 | Permission Engine | `lib/permissions.ts`, `lib/db-frontend.ts` additions | ~300 |
| 1 | API Routes | `app/api/permissions/`, `app/api/roles/`, `app/api/discord-sync/`, `app/api/audit-log/` | ~400 |
| 2 | UI Components | `permission-toggle.tsx`, `RoleCard.tsx`, `PermissionPopup.tsx`, `CustomRoleCreator.tsx`, `DiscordSyncPanel.tsx`, `AuditLogTable.tsx` | ~800 |
| 2 | Roles Page | `app/(admin)/admin/roles/page.tsx` (rebuild) | ~350 |
| 3 | Social Page | `app/(public)/social/page.tsx` (rebuild) + API updates | ~500 |
| 4 | Integration | `middleware.ts`, `hooks/use-auth.ts` | ~50 |

**Total new/modified code: ~2,700 lines across ~25 files**
