import { sql, escapeStr } from './database';
import { invalidateCustomRoleCache } from './permissions';

export interface SiteUser {
  id: string; // Discord user ID
  email: string;
  mc_username: string | null;
  discord_username: string;
  phone_number: string | null;
  roles: string[]; // JSON array
  site_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function upsertSiteUser(user: Partial<SiteUser> & { id: string; email: string }) {
  const rolesJson = escapeStr(JSON.stringify(user.roles || ["member"]));
  const mcUsername = user.mc_username ? `'${escapeStr(user.mc_username)}'` : 'NULL';
  const siteName = user.site_name ? escapeStr(user.site_name) : escapeStr(user.email.split('@')[0]);
  const phoneNumber = user.phone_number !== undefined ? (user.phone_number ? `'${escapeStr(user.phone_number)}'` : 'NULL') : 'NULL';
  const avatarUrl = user.avatar_url ? `'${escapeStr(user.avatar_url)}'` : 'NULL';

  await sql(`INSERT INTO site_users (id, email, mc_username, discord_username, phone_number, roles, site_name, avatar_url)
    VALUES ('${escapeStr(user.id)}', '${escapeStr(user.email)}', ${mcUsername}, '${escapeStr(user.discord_username || '')}', ${phoneNumber}, '${rolesJson}', '${siteName}', ${avatarUrl})
    ON CONFLICT(id) DO UPDATE SET
      email=excluded.email,
      mc_username=COALESCE(excluded.mc_username, mc_username),
      discord_username=excluded.discord_username,
      phone_number=CASE WHEN excluded.phone_number IS NOT NULL THEN excluded.phone_number ELSE phone_number END,
      roles=excluded.roles,
      site_name=excluded.site_name,
      avatar_url=CASE WHEN excluded.avatar_url IS NOT NULL THEN excluded.avatar_url ELSE avatar_url END,
      updated_at=datetime('now')`);
}

export async function getSiteUser(id: string): Promise<SiteUser | null> {
  const r = await sql(`SELECT * FROM site_users WHERE id='${escapeStr(id)}'`);
  if (r.length > 0 && r[0].rows.length > 0) {
    const row = r[0].rows[0] as any;
    return {
      ...row,
      roles: JSON.parse(row.roles || '["member"]')
    };
  }
  return null;
}

export async function getUserByMinecraftUsername(mcUsername: string): Promise<SiteUser | null> {
  const r = await sql(`SELECT * FROM site_users WHERE LOWER(mc_username)='${escapeStr(mcUsername.toLowerCase())}'`);
  if (r.length > 0 && r[0].rows.length > 0) {
    const row = r[0].rows[0] as any;
    return {
      ...row,
      roles: JSON.parse(row.roles || '["member"]')
    };
  }
  return null;
}

export interface StoreItem {
  id: string;
  name: string;
  price: number;
  category: string;
  display_image: string;
  is_active: boolean;
  metadata: any;
}

export async function getStoreItems(): Promise<StoreItem[]> {
  const r = await sql('SELECT * FROM store_items WHERE is_active=true ORDER BY category, name');
  if (r.length > 0) {
    return r[0].rows.map((row: any) => ({
      ...row,
      is_active: row.is_active === 1 || row.is_active === true || row.is_active === 'true',
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }
  return [];
}

export async function upsertStoreItem(item: Partial<StoreItem> & { id: string; name: string; price: number; category: string }) {
  const metaJson = escapeStr(JSON.stringify(item.metadata || {}));
  await sql(`INSERT INTO store_items (id, name, price, category, display_image, is_active, metadata)
    VALUES ('${escapeStr(item.id)}', '${escapeStr(item.name)}', ${item.price}, '${escapeStr(item.category)}', '${escapeStr(item.display_image || '')}', ${item.is_active ?? true}, '${metaJson}')
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, price=excluded.price, category=excluded.category,
      display_image=excluded.display_image, is_active=excluded.is_active, metadata=excluded.metadata`);
}

export async function deleteStoreItem(id: string) {
  await sql(`DELETE FROM store_items WHERE id='${escapeStr(id)}'`);
}

export interface Ticket {
  id: string;
  user_id: string;
  title: string;
  status: 'open' | 'closed' | 'in-progress';
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export async function createTicket(ticket: { id: string; user_id: string; title: string }) {
  await sql(`INSERT INTO tickets (id, user_id, title) VALUES ('${escapeStr(ticket.id)}', '${escapeStr(ticket.user_id)}', '${escapeStr(ticket.title)}')`);
}

export async function getUserTickets(user_id: string): Promise<Ticket[]> {
  const r = await sql(`SELECT * FROM tickets WHERE user_id='${escapeStr(user_id)}' ORDER BY updated_at DESC`);
  if (r.length > 0) return r[0].rows as any[];
  return [];
}

export async function getAllTickets(): Promise<Ticket[]> {
  const r = await sql('SELECT * FROM tickets ORDER BY updated_at DESC');
  if (r.length > 0) return r[0].rows as any[];
  return [];
}

export async function addTicketMessage(msg: { id: string; ticket_id: string; sender_id: string; message: string }) {
  await sql(`INSERT INTO ticket_messages (id, ticket_id, sender_id, message) VALUES ('${escapeStr(msg.id)}', '${escapeStr(msg.ticket_id)}', '${escapeStr(msg.sender_id)}', '${escapeStr(msg.message)}')`);
  await sql(`UPDATE tickets SET updated_at=datetime('now') WHERE id='${escapeStr(msg.ticket_id)}'`);
}

export async function getTicketMessages(ticket_id: string): Promise<TicketMessage[]> {
  const r = await sql(`SELECT * FROM ticket_messages WHERE ticket_id='${escapeStr(ticket_id)}' ORDER BY created_at ASC`);
  if (r.length > 0) return r[0].rows as any[];
  return [];
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const r = await sql(`SELECT * FROM tickets WHERE id='${escapeStr(id)}'`);
  if (r.length > 0 && r[0].rows.length > 0) {
    return r[0].rows[0] as unknown as Ticket;
  }
  return null;
}

export async function updateTicketStatus(id: string, status: string): Promise<void> {
  await sql(`UPDATE tickets SET status='${escapeStr(status)}', updated_at=datetime('now') WHERE id='${escapeStr(id)}'`);
}

// ---- Friends ----

export async function getFriends(userId: string): Promise<any[]> {
  const r = await sql(`
    SELECT u.id, u.mc_username, u.site_name, u.discord_username, f.created_at
    FROM friends f
    JOIN site_users u ON u.id = f.friend_id
    WHERE f.user_id='${escapeStr(userId)}'
    ORDER BY f.created_at DESC
  `);
  if (r.length > 0) return r[0].rows;
  return [];
}

export async function addFriend(userId: string, friendId: string) {
  const id = `${userId}_${friendId}`;
  await sql(`INSERT OR IGNORE INTO friends (id, user_id, friend_id) VALUES ('${escapeStr(id)}', '${escapeStr(userId)}', '${escapeStr(friendId)}')`);
  const id2 = `${friendId}_${userId}`;
  await sql(`INSERT OR IGNORE INTO friends (id, user_id, friend_id) VALUES ('${escapeStr(id2)}', '${escapeStr(friendId)}', '${escapeStr(userId)}')`);
}

export async function removeFriend(userId: string, friendId: string) {
  await sql(`DELETE FROM friends WHERE (user_id='${escapeStr(userId)}' AND friend_id='${escapeStr(friendId)}') OR (user_id='${escapeStr(friendId)}' AND friend_id='${escapeStr(userId)}')`);
}

// ---- Social Requests ----

export async function getSocialRequests(userId: string): Promise<any[]> {
  const r = await sql(`SELECT * FROM social_requests WHERE (from_id='${escapeStr(userId)}' OR to_id='${escapeStr(userId)}') ORDER BY created_at DESC`);
  if (r.length > 0) return r[0].rows;
  return [];
}

export async function createSocialRequest(req: { id: string; from_id: string; to_id: string; type: string }) {
  await sql(`INSERT INTO social_requests (id, from_id, to_id, type) VALUES ('${escapeStr(req.id)}', '${escapeStr(req.from_id)}', '${escapeStr(req.to_id)}', '${escapeStr(req.type)}')`);
}

export async function updateSocialRequestStatus(id: string, status: string) {
  await sql(`UPDATE social_requests SET status='${escapeStr(status)}' WHERE id='${escapeStr(id)}'`);
}

export async function getSocialRequest(id: string): Promise<any | null> {
  const r = await sql(`SELECT * FROM social_requests WHERE id='${escapeStr(id)}'`);
  if (r.length > 0 && r[0].rows.length > 0) return r[0].rows[0];
  return null;
}

// ---- Trades ----

export async function getTrades(): Promise<any[]> {
  const r = await sql(`SELECT t.*, u.mc_username as seller_name FROM trades t LEFT JOIN site_users u ON u.id = t.seller_id ORDER BY t.created_at DESC`);
  if (r.length > 0) return r[0].rows;
  return [];
}

export async function createTrade(trade: { id: string; seller_id: string; seller_name: string; type: string; item_name: string; item_description: string; asking_price: string }) {
  await sql(`INSERT INTO trades (id, seller_id, seller_name, type, item_name, item_description, asking_price) VALUES ('${escapeStr(trade.id)}', '${escapeStr(trade.seller_id)}', '${escapeStr(trade.seller_name)}', '${escapeStr(trade.type)}', '${escapeStr(trade.item_name)}', '${escapeStr(trade.item_description)}', '${escapeStr(trade.asking_price)}')`);
}

// ---- Purchases ----

export async function getUserPurchases(userId: string): Promise<any[]> {
  const r = await sql(`SELECT * FROM purchases WHERE user_id='${escapeStr(userId)}' ORDER BY created_at DESC`);
  if (r.length > 0) return r[0].rows;
  return [];
}

export async function createPurchase(purchase: { id: string; user_id: string; item_id: string; item_name: string; quantity: number; amount: number }) {
  await sql(`INSERT INTO purchases (id, user_id, item_id, item_name, quantity, amount) VALUES ('${escapeStr(purchase.id)}', '${escapeStr(purchase.user_id)}', '${escapeStr(purchase.item_id)}', '${escapeStr(purchase.item_name)}', ${purchase.quantity}, ${purchase.amount})`);
}

// ---- Users (admin) ----

export async function getAllUsers(): Promise<SiteUser[]> {
  const r = await sql('SELECT * FROM site_users ORDER BY created_at DESC');
  if (r.length > 0) {
    return r[0].rows.map((row: any) => ({
      ...row,
      roles: JSON.parse(row.roles || '["member"]')
    }));
  }
  return [];
}

export async function searchUsers(query: string): Promise<SiteUser[]> {
  const q = escapeStr(query);
  const r = await sql(`SELECT * FROM site_users WHERE mc_username LIKE '%${q}%' OR site_name LIKE '%${q}%' OR email LIKE '%${q}%' LIMIT 20`);
  if (r.length > 0) {
    return r[0].rows.map((row: any) => ({
      ...row,
      roles: JSON.parse(row.roles || '["member"]')
    }));
  }
  return [];
}

export async function updateUserRoles(userId: string, roles: string[]) {
  const rolesJson = JSON.stringify(roles);
  await sql({ sql: `UPDATE site_users SET roles=?, updated_at=datetime('now') WHERE id=?`, args: [rolesJson, userId] });
}

// ---- Bans ----

export async function banUser(ban: { id: string; user_id: string; reason: string; duration: string }) {
  const expiresAt = ban.duration ? `'${escapeStr(new Date(Date.now() + parseDuration(ban.duration)).toISOString())}'` : 'NULL';
  await sql(`INSERT INTO bans (id, user_id, reason, duration, banned_at, expires_at) VALUES ('${escapeStr(ban.id)}', '${escapeStr(ban.user_id)}', '${escapeStr(ban.reason)}', '${escapeStr(ban.duration)}', datetime('now'), ${expiresAt}) ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason, duration=excluded.duration, banned_at=excluded.banned_at, expires_at=excluded.expires_at`);
}

function parseDuration(d: string): number {
  const match = d.match(/^(\d+)(d|h|m|s)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const val = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 'd': return val * 86400000;
    case 'h': return val * 3600000;
    case 'm': return val * 60000;
    case 's': return val * 1000;
    default: return 7 * 86400000;
  }
}

// ---- Inventory ----

export interface InventoryItem {
  id: string;
  user_id: string;
  item_name: string;
  item_type: string;
  quantity: number;
  metadata: string;
  acquired_from: string;
  acquired_at: string;
  is_hidden: boolean;
  is_frozen: boolean;
}

export async function getUserInventory(userId: string): Promise<InventoryItem[]> {
  const r = await sql(`SELECT * FROM inventory WHERE user_id='${escapeStr(userId)}' AND is_hidden=false ORDER BY acquired_at DESC`);
  if (r.length > 0) return r[0].rows as any[];
  return [];
}

export async function getFullInventory(userId: string): Promise<InventoryItem[]> {
  const r = await sql(`SELECT * FROM inventory WHERE user_id='${escapeStr(userId)}' ORDER BY acquired_at DESC`);
  if (r.length > 0) return r[0].rows as any[];
  return [];
}

export async function addInventoryItem(item: { id: string; user_id: string; item_name: string; item_type?: string; quantity?: number; metadata?: string; acquired_from?: string }) {
  await sql(`INSERT INTO inventory (id, user_id, item_name, item_type, quantity, metadata, acquired_from, acquired_at) VALUES ('${escapeStr(item.id)}', '${escapeStr(item.user_id)}', '${escapeStr(item.item_name)}', '${escapeStr(item.item_type || 'item')}', ${item.quantity ?? 1}, '${escapeStr(item.metadata || '{}')}', '${escapeStr(item.acquired_from || '')}', datetime('now'))`);
}

export async function updateInventoryItemQuantity(id: string, quantity: number) {
  if (quantity <= 0) {
    await sql(`DELETE FROM inventory WHERE id='${escapeStr(id)}'`);
  } else {
    await sql(`UPDATE inventory SET quantity=${quantity} WHERE id='${escapeStr(id)}'`);
  }
}

export async function deleteInventoryItem(id: string) {
  await sql(`DELETE FROM inventory WHERE id='${escapeStr(id)}'`);
}

export async function setInventoryItemFrozen(id: string, frozen: boolean) {
  await sql(`UPDATE inventory SET is_frozen=${frozen} WHERE id='${escapeStr(id)}'`);
}

export async function setInventoryItemHidden(id: string, hidden: boolean) {
  await sql(`UPDATE inventory SET is_hidden=${hidden} WHERE id='${escapeStr(id)}'`);
}

export async function transferInventoryItem(itemId: string, fromUserId: string, toUserId: string, quantity: number = 1) {
  const r = await sql(`SELECT * FROM inventory WHERE id='${escapeStr(itemId)}' AND user_id='${escapeStr(fromUserId)}'`);
  if (r.length === 0 || r[0].rows.length === 0) throw new Error('Item not found');
  const item = r[0].rows[0] as any;
  if (item.is_frozen) throw new Error('Item is frozen and cannot be transferred');

  const remaining = item.quantity - quantity;
  if (remaining <= 0) {
    await sql(`UPDATE inventory SET user_id='${escapeStr(toUserId)}', acquired_at=datetime('now') WHERE id='${escapeStr(itemId)}'`);
  } else {
    await sql(`UPDATE inventory SET quantity=${remaining} WHERE id='${escapeStr(itemId)}'`);
    const newId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await sql(`INSERT INTO inventory (id, user_id, item_name, item_type, quantity, metadata, acquired_from, acquired_at) VALUES ('${escapeStr(newId)}', '${escapeStr(toUserId)}', '${escapeStr(item.item_name)}', '${escapeStr(item.item_type)}', ${quantity}, '${escapeStr(item.metadata)}', '${escapeStr(fromUserId)}', datetime('now'))`);
  }
}

// ---- Reports ----

export interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export async function createReport(report: { id: string; reporter_id: string; reported_id: string; reason: string; description?: string }) {
  await sql(`INSERT INTO reports (id, reporter_id, reported_id, reason, description) VALUES ('${escapeStr(report.id)}', '${escapeStr(report.reporter_id)}', '${escapeStr(report.reported_id)}', '${escapeStr(report.reason)}', '${escapeStr(report.description || '')}')`);
}

export async function getReports(status?: string): Promise<Report[]> {
  const where = status ? `WHERE r.status='${escapeStr(status)}'` : '';
  const r = await sql(`SELECT r.*, s1.mc_username as reporter_name, s2.mc_username as reported_name FROM reports r LEFT JOIN site_users s1 ON s1.id=r.reporter_id LEFT JOIN site_users s2 ON s2.id=r.reported_id ${where} ORDER BY r.created_at DESC`);
  if (r.length > 0) return r[0].rows as any[];
  return [];
}

export async function updateReportStatus(id: string, status: string, resolvedBy: string) {
  await sql(`UPDATE reports SET status='${escapeStr(status)}', resolved_by='${escapeStr(resolvedBy)}', resolved_at=datetime('now') WHERE id='${escapeStr(id)}'`);
}

// ---- Follows ----

export async function followUser(followerId: string, followingId: string) {
  const id = `${followerId}_${followingId}`;
  await sql(`INSERT OR IGNORE INTO follows (id, follower_id, following_id) VALUES ('${escapeStr(id)}', '${escapeStr(followerId)}', '${escapeStr(followingId)}')`);
}

export async function unfollowUser(followerId: string, followingId: string) {
  await sql(`DELETE FROM follows WHERE follower_id='${escapeStr(followerId)}' AND following_id='${escapeStr(followingId)}'`);
}

export async function getFollowers(userId: string): Promise<any[]> {
  const r = await sql(`SELECT f.*, u.mc_username, u.site_name FROM follows f JOIN site_users u ON u.id=f.follower_id WHERE f.following_id='${escapeStr(userId)}' ORDER BY f.created_at DESC`);
  if (r.length > 0) return r[0].rows;
  return [];
}

export async function getFollowing(userId: string): Promise<any[]> {
  const r = await sql(`SELECT f.*, u.mc_username, u.site_name FROM follows f JOIN site_users u ON u.id=f.following_id WHERE f.follower_id='${escapeStr(userId)}' ORDER BY f.created_at DESC`);
  if (r.length > 0) return r[0].rows;
  return [];
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const r = await sql(`SELECT id FROM follows WHERE follower_id='${escapeStr(followerId)}' AND following_id='${escapeStr(followingId)}'`);
  return r.length > 0 && r[0].rows.length > 0;
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    sql(`SELECT COUNT(*) as c FROM follows WHERE following_id='${escapeStr(userId)}'`),
    sql(`SELECT COUNT(*) as c FROM follows WHERE follower_id='${escapeStr(userId)}'`),
  ]);
  return {
    followers: Number(followers[0]?.rows[0]?.c ?? 0),
    following: Number(following[0]?.rows[0]?.c ?? 0),
  };
}

// ---- Moderation Actions ----

export interface ModerationAction {
  id: string;
  target_user_id: string;
  performed_by: string;
  action: string;
  reason: string;
  duration_seconds: number | null;
  metadata: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export async function createModerationAction(action: { id: string; target_user_id: string; performed_by: string; action: string; reason?: string; duration_seconds?: number; metadata?: string }) {
  const expiresAt = action.duration_seconds ? `'${escapeStr(new Date(Date.now() + action.duration_seconds * 1000).toISOString())}'` : 'NULL';
  await sql(`INSERT INTO moderation_actions (id, target_user_id, performed_by, action, reason, duration_seconds, metadata, expires_at) VALUES ('${escapeStr(action.id)}', '${escapeStr(action.target_user_id)}', '${escapeStr(action.performed_by)}', '${escapeStr(action.action)}', '${escapeStr(action.reason || '')}', ${action.duration_seconds ?? 'NULL'}, '${escapeStr(action.metadata || '{}')}', ${expiresAt})`);
}

export async function getModerationActions(targetUserId?: string): Promise<ModerationAction[]> {
  const where = targetUserId ? `WHERE m.target_user_id='${escapeStr(targetUserId)}'` : '';
  const r = await sql(`SELECT m.*, s1.mc_username as target_name, s2.mc_username as performer_name FROM moderation_actions m LEFT JOIN site_users s1 ON s1.id=m.target_user_id LEFT JOIN site_users s2 ON s2.id=m.performed_by ${where} ORDER BY m.created_at DESC`);
  if (r.length > 0) return r[0].rows as any[];
  return [];
}

export async function getActiveModerationActions(userId: string): Promise<ModerationAction[]> {
  const r = await sql(`SELECT * FROM moderation_actions WHERE target_user_id='${escapeStr(userId)}' AND is_active=true AND (expires_at IS NULL OR expires_at > datetime('now')) ORDER BY created_at DESC`);
  if (r.length > 0) return r[0].rows as any[];
  return [];
}

export async function deactivateModerationAction(id: string) {
  await sql(`UPDATE moderation_actions SET is_active=false WHERE id='${escapeStr(id)}'`);
}

export async function unbanUser(userId: string) {
  await sql(`DELETE FROM bans WHERE user_id='${escapeStr(userId)}'`);
  await sql(`UPDATE moderation_actions SET is_active=false WHERE target_user_id='${escapeStr(userId)}' AND action='ban' AND is_active=true`);
}

// ---- Auctions ----

export interface Auction {
  id: string;
  seller_id: string;
  seller_name: string;
  item_name: string;
  item_description: string;
  starting_price: number;
  current_bid: number;
  current_bidder_id: string | null;
  current_bidder_name: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

export async function createAuction(auction: { id: string; seller_id: string; seller_name: string; item_name: string; item_description?: string; starting_price: number; ends_at: string }) {
  await sql(`INSERT INTO auctions (id, seller_id, seller_name, item_name, item_description, starting_price, current_bid, status, starts_at, ends_at) VALUES ('${escapeStr(auction.id)}', '${escapeStr(auction.seller_id)}', '${escapeStr(auction.seller_name)}', '${escapeStr(auction.item_name)}', '${escapeStr(auction.item_description || '')}', ${auction.starting_price}, ${auction.starting_price}, 'active', datetime('now'), '${escapeStr(auction.ends_at)}')`);
}

export async function getAuctions(status?: string): Promise<Auction[]> {
  const where = status ? `WHERE status='${escapeStr(status)}'` : '';
  const r = await sql(`SELECT * FROM auctions ${where} ORDER BY ends_at ASC`);
  if (r.length > 0) return r[0].rows as any[];
  return [];
}

export async function placeBid(auctionId: string, bidderId: string, bidderName: string, amount: number) {
  const r = await sql(`SELECT * FROM auctions WHERE id='${escapeStr(auctionId)}' AND status='active'`);
  if (r.length === 0 || r[0].rows.length === 0) throw new Error('Auction not found or not active');
  const auction = r[0].rows[0] as any;
  if (amount <= auction.current_bid) throw new Error('Bid must be higher than current bid');
  if (auction.seller_id === bidderId) throw new Error('Cannot bid on your own auction');
  await sql(`UPDATE auctions SET current_bid=${amount}, current_bidder_id='${escapeStr(bidderId)}', current_bidder_name='${escapeStr(bidderName)}' WHERE id='${escapeStr(auctionId)}'`);
}

export async function endAuction(id: string) {
  await sql(`UPDATE auctions SET status='ended' WHERE id='${escapeStr(id)}'`);
}

// ---- Notifications ----

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string;
  created_at: string;
}

export async function createNotification(notif: { id: string; user_id: string; type?: string; title: string; message: string; link?: string }) {
  await sql(`INSERT INTO notifications (id, user_id, type, title, message, link) VALUES ('${escapeStr(notif.id)}', '${escapeStr(notif.user_id)}', '${escapeStr(notif.type || 'info')}', '${escapeStr(notif.title)}', '${escapeStr(notif.message)}', '${escapeStr(notif.link || '')}')`);
}

export async function getUserNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
  const where = unreadOnly ? `WHERE user_id='${escapeStr(userId)}' AND is_read=false` : `WHERE user_id='${escapeStr(userId)}'`;
  const r = await sql(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 50`);
  if (r.length > 0) return r[0].rows as any[];
  return [];
}

export async function markNotificationRead(id: string) {
  await sql(`UPDATE notifications SET is_read=true WHERE id='${escapeStr(id)}'`);
}

export async function markAllNotificationsRead(userId: string) {
  await sql(`UPDATE notifications SET is_read=true WHERE user_id='${escapeStr(userId)}' AND is_read=false`);
}

// ---- Player Profile (public) ----

export async function getPublicProfile(userId: string): Promise<any | null> {
  const r = await sql(`SELECT id, mc_username, discord_username, site_name, roles, created_at FROM site_users WHERE id='${escapeStr(userId)}'`);
  if (r.length > 0 && r[0].rows.length > 0) {
    const row = r[0].rows[0] as any;
    return {
      ...row,
      roles: JSON.parse(row.roles || '["member"]')
    };
  }
  return null;
}

// ---- Online Users ----

export async function getOnlineSiteUsers(): Promise<any[]> {
  const r = await sql(`SELECT DISTINCT su.id, su.mc_username, su.site_name, su.roles, p.is_online FROM site_users su JOIN players p ON p.name = su.mc_username WHERE p.is_online=true`);
  if (r.length > 0) {
    return r[0].rows.map((row: any) => ({
      ...row,
      roles: JSON.parse(row.roles || '["member"]')
    }));
  }
  return [];
}

// ---- Custom Roles ----

export interface CustomRole {
  name: string;
  description: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getCustomRoles(): Promise<CustomRole[]> {
  const r = await sql('SELECT * FROM custom_roles WHERE is_active=1');
  if (r.length > 0) return r[0].rows as any[];
  return [];
}

export async function getCustomRole(name: string): Promise<CustomRole | null> {
  const r = await sql(`SELECT * FROM custom_roles WHERE name='${escapeStr(name)}'`);
  if (r.length > 0 && r[0].rows.length > 0) return r[0].rows[0] as any;
  return null;
}

export async function createCustomRole(data: { name: string; description: string; color: string }): Promise<void> {
  await sql(`INSERT INTO custom_roles (name, description, color, is_active) VALUES ('${escapeStr(data.name)}', '${escapeStr(data.description)}', '${escapeStr(data.color)}', 1)`);
}

export async function updateCustomRole(name: string, data: Partial<{ description: string; color: string; is_active: boolean }>): Promise<void> {
  const sets: string[] = [];
  if (data.description !== undefined) sets.push(`description='${escapeStr(data.description)}'`);
  if (data.color !== undefined) sets.push(`color='${escapeStr(data.color)}'`);
  if (data.is_active !== undefined) sets.push(`is_active=${data.is_active ? 1 : 0}`);
  if (sets.length === 0) return;
  await sql(`UPDATE custom_roles SET ${sets.join(', ')} WHERE name='${escapeStr(name)}'`);
}

export async function deleteCustomRole(name: string): Promise<void> {
  await sql(`DELETE FROM user_custom_roles WHERE custom_role_name='${escapeStr(name)}'`);
  await sql(`DELETE FROM role_permissions WHERE role='${escapeStr(name)}'`);
  await sql(`DELETE FROM custom_roles WHERE name='${escapeStr(name)}'`);
}

export async function assignCustomRoleToUser(userId: string, roleName: string, assignedBy: string): Promise<void> {
  await sql(`INSERT OR IGNORE INTO user_custom_roles (user_id, custom_role_name, assigned_by) VALUES ('${escapeStr(userId)}', '${escapeStr(roleName)}', '${escapeStr(assignedBy)}')`);
  invalidateCustomRoleCache();
}

export async function removeCustomRoleFromUser(userId: string, roleName: string): Promise<void> {
  await sql(`DELETE FROM user_custom_roles WHERE user_id='${escapeStr(userId)}' AND custom_role_name='${escapeStr(roleName)}'`);
  invalidateCustomRoleCache();
}

export async function getUserCustomRoles(userId: string): Promise<string[]> {
  const r = await sql(`SELECT custom_role_name FROM user_custom_roles WHERE user_id='${escapeStr(userId)}'`);
  if (r.length > 0) return r[0].rows.map((row: any) => row.custom_role_name as string);
  return [];
}
