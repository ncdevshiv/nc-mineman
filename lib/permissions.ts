import { sql, escapeStr } from '@/lib/database';

export type PermissionCategory = 'AUTH' | 'SOCIAL' | 'INVENTORY' | 'TRADES' | 'MARKETPLACE' | 'TICKETS' | 'WIKI' | 'RULES' | 'ACTIVITY' | 'MODERATION' | 'ADMIN' | 'GOD';

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
  isLocked: boolean;
  permissions: Set<string>;
}

let permissionsCache: PermissionDef[] | null = null;
let rolePermissionsCache: Map<string, Set<string>> | null = null;
let customRolePermissionsCache: Map<string, Set<string>> | null = null;
let cacheTime = 0;
const CACHE_TTL = 30000;

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

export async function loadCustomRolePermissions(userId: string): Promise<Set<string>> {
  if (customRolePermissionsCache && Date.now() - cacheTime < CACHE_TTL) {
    return customRolePermissionsCache.get(userId) || new Set();
  }
  const r = await sql({
    sql: `SELECT crp.permission_key FROM user_custom_roles ucr JOIN custom_roles cr ON cr.name = ucr.custom_role_name JOIN role_permissions crp ON crp.role = cr.name WHERE ucr.user_id = ? AND crp.granted = 1`,
    args: [userId]
  });
  const perms = new Set<string>();
  for (const row of r[0].rows) {
    perms.add(row.permission_key as string);
  }
  if (!customRolePermissionsCache) customRolePermissionsCache = new Map();
  customRolePermissionsCache.set(userId, perms);
  cacheTime = Date.now();
  return perms;
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
  return rolePermissionsCache!.get(role) || new Set();
}

export async function hasPermission(userId: string, userRoles: string[], permissionKey: string): Promise<boolean> {
  if (!Array.isArray(userRoles)) return false;
  await loadRolePermissions();
  for (const role of userRoles) {
    const perms = rolePermissionsCache?.get(role);
    if (perms?.has(permissionKey)) return true;
  }
  const customPerms = await loadCustomRolePermissions(userId);
  if (customPerms.has(permissionKey)) return true;
  return false;
}

export async function hasAnyPermission(userId: string, userRoles: string[], permissionKeys: string[]): Promise<boolean> {
  if (!Array.isArray(userRoles) || !Array.isArray(permissionKeys)) return false;
  const results = await Promise.all(permissionKeys.map(k => hasPermission(userId, userRoles, k)));
  return results.some(Boolean);
}

export async function getRoleDefinition(roleName: string): Promise<RoleDef | null> {
  await loadRolePermissions();
  const perms = rolePermissionsCache?.get(roleName);
  if (!perms) return null;
  const roleColors: Record<string, string> = { owner: '#ef4444', admin: '#f59e0b', god: '#a855f7', helper: '#3b82f6', youtuber: '#ec4899', member: '#6b7280' };
  const roleDescriptions: Record<string, string> = { owner: 'Full system control', admin: 'Full authorization', god: 'Ceremonial role with moderation capabilities', helper: 'Ticket management and QA', youtuber: 'Content creator role', member: 'Default member access' };
  return { name: roleName, color: roleColors[roleName] || '#6b7280', description: roleDescriptions[roleName] || '', isLocked: roleName === 'owner', permissions: perms };
}

export async function getAllRoleDefinitions(): Promise<RoleDef[]> {
  const names = ['owner', 'admin', 'god', 'helper', 'youtuber', 'member'];
  const defs = await Promise.all(names.map(n => getRoleDefinition(n)));
  return defs.filter(Boolean) as RoleDef[];
}

export async function updateRolePermissions(role: string, permissions: Record<string, boolean>): Promise<void> {
  try {
    await sql('BEGIN TRANSACTION');
    for (const [key, granted] of Object.entries(permissions)) {
      await sql({ sql: `INSERT OR REPLACE INTO role_permissions (role, permission_key, granted) VALUES (?, ?, ?)`, args: [role, key, granted ? 1 : 0] });
    }
    await sql('COMMIT');
  } catch (err) {
    await sql('ROLLBACK');
    throw err;
  }
  permissionsCache = null;
  rolePermissionsCache = null;
  customRolePermissionsCache = null;
  cacheTime = 0;
}

export async function resetRoleToDefaults(role: string): Promise<void> {
  if (role === 'owner') return;
  const defaults: Record<string, string[]> = {
    admin: ['auth.login','auth.edit_profile','social.player.search','social.player.view_public','social.friend.request','social.friend.accept','social.friend.reject','social.friend.remove','social.follow.request','social.follow.view','social.report.submit','inventory.view','inventory.sell','inventory.buy','inventory.gift','inventory.auction','inventory.hide','trades.create','trades.view','trades.negotiate','trades.cancel','market.view','market.purchase','tickets.create','tickets.view_own','tickets.view_assigned','tickets.respond','tickets.assign','tickets.close','wiki.view','wiki.edit','wiki.delete','rules.view','rules.manage','activity.view','activity.view_own','activity.moderate','mod.view_reports','mod.ban','mod.kick','mod.mute','mod.freeze','mod.warn','mod.jail','admin.dashboard','admin.servers','admin.users','admin.roles','admin.config','admin.branding','admin.store','admin.audit_log'],
    god: ['auth.login','auth.edit_profile','social.player.search','social.player.view_public','social.player.view_full','social.friend.request','social.friend.accept','social.friend.reject','social.friend.remove','social.follow.request','social.follow.view','social.report.submit','inventory.view','inventory.sell','inventory.buy','inventory.gift','inventory.auction','inventory.hide','trades.create','trades.view','trades.negotiate','trades.cancel','market.view','market.purchase','tickets.view_own','tickets.view_assigned','tickets.respond','wiki.view','wiki.edit','rules.view','activity.view','activity.view_own','mod.view_reports','mod.warn'],
    helper: ['auth.login','auth.edit_profile','social.player.search','social.player.view_public','social.friend.request','social.friend.accept','social.friend.reject','social.friend.remove','social.follow.request','social.follow.view','social.report.submit','inventory.view','inventory.sell','inventory.buy','inventory.gift','inventory.auction','inventory.hide','trades.create','trades.view','trades.negotiate','market.view','tickets.create','tickets.view_own','tickets.view_assigned','tickets.respond','wiki.view','rules.view','activity.view','activity.view_own','activity.moderate','mod.view_reports','mod.warn'],
    youtuber: ['auth.login','auth.edit_profile','social.player.search','social.player.view_public','social.friend.request','social.friend.accept','social.friend.reject','social.friend.remove','social.follow.request','social.follow.view','social.report.submit','inventory.view','inventory.sell','inventory.gift','inventory.auction','inventory.hide','trades.create','trades.view','trades.negotiate','trades.cancel','market.view','market.purchase','wiki.view','rules.view','activity.view','activity.view_own'],
    member: ['auth.login','auth.edit_profile','social.player.search','social.player.view_public','social.friend.request','social.friend.accept','social.friend.reject','social.friend.remove','social.follow.request','social.follow.view','social.report.submit','inventory.view','inventory.sell','inventory.buy','inventory.gift','inventory.auction','inventory.hide','market.view','tickets.create','tickets.view_own','wiki.view','rules.view','activity.view','activity.view_own'],
  };
  const roleDefaults = defaults[role] || [];
  if (roleDefaults.length === 0) return; // Unknown role guard

  try {
    await sql('BEGIN TRANSACTION');
    await sql({ sql: `DELETE FROM role_permissions WHERE role = ?`, args: [role] });
    for (const permKey of roleDefaults) {
      await sql({ sql: `INSERT OR IGNORE INTO role_permissions (role, permission_key, granted) VALUES (?, ?, 1)`, args: [role, permKey] });
    }
    await sql('COMMIT');
  } catch (err) {
    await sql('ROLLBACK');
    throw err;
  }
  permissionsCache = null;
  rolePermissionsCache = null;
  customRolePermissionsCache = null;
  cacheTime = 0;
}

export async function logPermissionChange(performedBy: string, action: string, targetRole?: string, permissionKey?: string, oldValue?: string, newValue?: string): Promise<void> {
  await sql({
    sql: `INSERT INTO permission_audit_log (performed_by, action, target_role, permission_key, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [performedBy, action, targetRole ?? null, permissionKey ?? null, oldValue ?? null, newValue ?? null]
  });
}

export function invalidateCustomRoleCache(): void {
  customRolePermissionsCache = null;
  cacheTime = 0;
}
