# Unified Permission & Social Platform — Design Specification

**Date:** 2026-03-24
**Status:** Approved for Implementation
**Version:** 1.0

---

## 1. Overview

This design covers three interconnected systems:

1. **Role & Permission Engine** — Discord sync + custom site roles, each mapping to granular permissions
2. **Permission Config UI** — Admin panel where every capability is toggleable per role with full audit logging
3. **Social Platform** — Player search, friend system with status visibility, member default experience

**Tone:** Industrial Utilitarian for admin panels (dark steel, amber accents, monospace), Glassmorphism + Neon for social pages.

---

## 2. Permission System

### 2.1 Permission Categories & Keys

All permissions are grouped by category. Each key has: `key`, `category`, `label`, `description`, `is_dangerous`.

#### AUTH & IDENTITY
| Key | Label | Description | Dangerous |
|-----|-------|-------------|-----------|
| `auth.login` | Site Login | Can log into the website | No |
| `auth.link_discord` | Link Discord | Can link Discord account to profile | No |
| `auth.link_minecraft` | Link Minecraft | Can link Minecraft username to account | No |
| `auth.edit_profile` | Edit Profile | Can edit display name, avatar, site settings | No |

#### SOCIAL
| Key | Label | Description | Dangerous |
|-----|-------|-------------|-----------|
| `social.player.search` | Search Players | Can search for any registered player | No |
| `social.player.view_public` | View Public Profiles | Can view public player profile pages | No |
| `social.player.view_full` | View Full Profiles | Can view inventory, stats, moderation history | No |
| `social.friend.request` | Send Friend Requests | Can send friend requests to other players | No |
| `social.friend.accept` | Accept Friend Requests | Can accept incoming friend requests | No |
| `social.friend.reject` | Reject Friend Requests | Can reject incoming friend requests | No |
| `social.friend.remove` | Remove Friends | Can remove existing friends | No |
| `social.follow.request` | Follow Players | Can follow other players | No |
| `social.follow.view` | View Followers | Can view followers/following lists | No |
| `social.report.submit` | Submit Reports | Can submit player reports | No |

#### INVENTORY & TRADING
| Key | Label | Description | Dangerous |
|-----|-------|-------------|-----------|
| `inventory.view` | View Inventory | Can view own inventory | No |
| `inventory.sell` | Sell Items | Can list inventory items for sale | No |
| `inventory.buy` | Buy Items | Can purchase items from other players | No |
| `inventory.gift` | Gift Items | Can gift items to other players | No |
| `inventory.auction` | Create Auctions | Can auction inventory items | No |
| `inventory.hide` | Hide Inventory Items | Can hide inventory items from public view | No |
| `inventory.mod.view` | Mod View Any Inventory | Moderators can inspect any player's inventory | **Yes** |

#### TRADE HUB
| Key | Label | Description | Dangerous |
|-----|-------|-------------|-----------|
| `trades.create` | Create Trade Listings | Can create new trade listings | No |
| `trades.view` | Browse Trades | Can browse trade listings | No |
| `trades.negotiate` | Negotiate Trades | Can make offers on trades | No |
| `trades.cancel` | Cancel Own Trades | Can cancel own active trades | No |

#### MARKETPLACE
| Key | Label | Description | Dangerous |
|-----|-------|-------------|-----------|
| `market.view` | Browse Marketplace | Can browse the public marketplace | No |
| `market.purchase` | Make Purchases | Can purchase items from the marketplace | No |

#### TICKETS
| Key | Label | Description | Dangerous |
|-----|-------|-------------|-----------|
| `tickets.create` | Create Tickets | Can create support tickets | No |
| `tickets.view_own` | View Own Tickets | Can view own support tickets | No |
| `tickets.view_assigned` | View Assigned Tickets | Can view tickets assigned to self | No |
| `tickets.respond` | Respond to Tickets | Can reply to tickets (own or assigned) | No |
| `tickets.assign` | Assign Tickets | Can assign tickets to helpers/mods | **Yes** |
| `tickets.close` | Close Tickets | Can close/resolve tickets | No |

#### MODERATION
| Key | Label | Description | Dangerous |
|-----|-------|-------------|-----------|
| `mod.view_reports` | View Reports | Can view submitted player reports | No |
| `mod.ban` | Ban Players | Can ban players from the server/site | **Yes** |
| `mod.kick` | Kick Players | Can kick players from the server | **Yes** |
| `mod.mute` | Mute Players | Can mute players in-game | No |
| `mod.freeze` | Freeze Inventories | Can freeze player inventories | **Yes** |
| `mod.warn` | Issue Warnings | Can issue formal warnings | No |
| `mod.jail` | Jail Players | Can jail players in-game | **Yes** |

#### ADMIN
| Key | Label | Description | Dangerous |
|-----|-------|-------------|-----------|
| `admin.dashboard` | Admin Dashboard | Can access the admin dashboard | **Yes** |
| `admin.servers` | Manage Servers | Can manage Minecraft servers | **Yes** |
| `admin.users` | Manage Users | Can view and edit user accounts | **Yes** |
| `admin.roles` | Manage Roles | Can edit role-permission mappings | **Yes** |
| `admin.config` | Edit Configuration | Can modify site configuration | **Yes** |
| `admin.branding` | Edit Branding | Can modify site branding | **Yes** |
| `admin.store` | Manage Store | Can manage marketplace items | **Yes** |
| `admin.audit_log` | View Audit Logs | Can view permission and action audit logs | **Yes** |

#### GOD VIEW
| Key | Label | Description | Dangerous |
|-----|-------|-------------|-----------|
| `god.access` | God View Access | Can access the God View page | No |

---

### 2.2 Preset Roles & Default Permissions

| Role | Color | Description | Default Permissions |
|------|-------|-------------|-------------------|
| `owner` | `#ef4444` (red) | Full system control | ALL permissions (locked — cannot be modified) |
| `admin` | `#f59e0b` (amber) | Full authorization | All except `god.access` and `owner` role management |
| `god` | `#a855f7` (purple) | Ceremonial + moderation | Social (all), Inventory (all own), Trading (all), Market (view+buy), Tickets (view_own + view_assigned + respond), Mod (view_reports + warn) |
| `helper` | `#3b82f6` (blue) | Ticket helpers | Social (all), own Inventory/Trading, Market view, Tickets (create + view_own + view_assigned + respond), Mod (view_reports) |
| `youtuber` | `#ec4899` (pink) | Content creator | Social (all), Inventory (all own), Trading, Market (all) |
| `member` | `#6b7280` (gray) | Default registered user | Social (search + view_public + friend.request/accept/reject + follow.request), Inventory (view + sell + gift + auction + hide), Market (view), Tickets (create + view_own) |

### 2.3 Custom Roles

Admins can create custom roles:
- **Name** (unique, max 32 chars)
- **Color** (hex picker)
- **Description** (max 256 chars)
- **Icon** (emoji or Lucide icon name)
- **Permissions** (subset of all permission keys)

Custom roles are assigned alongside preset roles. A user with `member` + custom role `"VIP"` has all `member` permissions PLUS custom `"VIP"` permissions.

---

## 3. Database Schema

### 3.1 New Tables

```sql
-- Permission definitions (seeded by application, keys are immutable)
CREATE TABLE permissions (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  is_dangerous BOOLEAN DEFAULT FALSE
);

-- Role → Permission mapping (preset + custom roles)
CREATE TABLE role_permissions (
  role TEXT NOT NULL,            -- preset role name OR custom role name
  permission_key TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (role, permission_key)
);

-- Custom roles created by admins
CREATE TABLE custom_roles (
  name TEXT PRIMARY KEY,         -- e.g. 'VIP', 'Moderator'
  color TEXT NOT NULL DEFAULT '#6b7280',
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL
);

-- Discord guild role → site role mapping
CREATE TABLE discord_role_sync (
  discord_role_id TEXT NOT NULL,
  discord_role_name TEXT NOT NULL,
  site_role TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'discord-to-site',
  PRIMARY KEY (discord_role_id)
);

-- User → custom role assignments
CREATE TABLE user_custom_roles (
  user_id TEXT NOT NULL,
  custom_role_name TEXT NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assigned_by TEXT NOT NULL,
  PRIMARY KEY (user_id, custom_role_name)
);

-- Permission change audit log
CREATE TABLE permission_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  performed_by TEXT NOT NULL,
  action TEXT NOT NULL,
  target_role TEXT,
  permission_key TEXT,
  old_value TEXT,
  new_value TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Modified Tables

- `site_users` — add `custom_roles` TEXT column (JSON array of custom role names)
- `site_config` — extend key set to include permission-related config

---

## 4. API Routes

### `GET /api/permissions`
Returns all permission keys grouped by category.
```json
{ "categories": { "SOCIAL": [...], "INVENTORY": [...] } }
```
**Auth:** Any authenticated user (read-only data)

### `GET /api/roles`
Returns all roles (preset + custom) with their permission sets.
```json
{
  "preset": { "admin": { "permissions": ["auth.login", ...], "isLocked": true }, ... },
  "custom": [{ "name": "VIP", "color": "#fbbf24", ... }]
}
```
**Auth:** Admin (`admin.roles`)

### `PUT /api/roles/[role]/permissions`
Bulk update permissions for a role.
```json
{ "permissions": { "social.friend.request": true, "social.friend.reject": false } }
```
**Auth:** Admin (`admin.roles`)
**Audit:** Logged to `permission_audit_log`

### `POST /api/roles/custom`
Create a custom role.
```json
{ "name": "VIP", "color": "#fbbf24", "description": "VIP members", "icon": "⭐", "permissions": {...} }
```
**Auth:** Admin (`admin.roles`)

### `PUT /api/roles/custom/[name]`
Update custom role.
**Auth:** Admin (`admin.roles`)

### `DELETE /api/roles/custom/[name]`
Delete custom role (unassigns from all users).
**Auth:** Admin (`admin.roles`)

### `GET /api/discord-sync`
Returns Discord role sync mappings.
**Auth:** Admin (`admin.roles`)

### `POST /api/discord-sync`
Add/update Discord role mapping.
```json
{ "discord_role_id": "123", "discord_role_name": "Admin", "site_role": "admin", "sync_direction": "discord-to-site" }
```
**Auth:** Admin (`admin.roles`)

### `POST /api/discord-sync/sync`
Trigger manual Discord role sync for all users (re-fetches roles from Discord API).
**Auth:** Admin (`admin.roles`)

### `GET /api/audit-log`
Paginated audit log with filters.
**Auth:** Admin (`admin.audit_log`)

---

## 5. UI Components

### 5.1 PermissionToggle
A single permission row:
```
[✓] Send Friend Requests
    Allows sending friend requests to other players
    ⚠️ Dangerous
```
- Checkbox glows cyan when enabled
- Dangerous permissions have amber left border + warning icon
- Hover reveals full description tooltip

### 5.2 RoleCard (in preset list)
```
┌─────────────────────────────────┐
│  ◆ admin        [AMBER BADGE]   │
│  Full authorization              │
│  47 permissions · 3 users      │
│  [Manage Permissions →]         │
└─────────────────────────────────┘
```
- Lock icon overlay for `owner` role
- Click opens PermissionPopup

### 5.3 PermissionPopup (Modal)
- 480px wide, slides from right
- Header: role color dot + name + "Preset" or "Custom" badge
- Sticky subheader: role description + user count
- Body: collapsible category sections, each showing permission toggles
- Sticky footer: [Reset to Defaults] [Cancel] [Save Changes]
- Save triggers API call + audit log entry

### 5.4 DiscordSyncPanel
```
┌─ Discord Role Sync ────────────────────────────┐
│  [Sync Now]                     Last sync: 2h ago │
│                                              │
│  Discord Role      →  Site Role               │
│  @Owner            →  owner                   │
│  @Admin            →  admin                   │
│  @Helper           →  helper                   │
│  [+] Add Mapping                             │
└──────────────────────────────────────────────┘
```

### 5.5 CustomRoleCreator
- Full popup form: name, color picker, description, icon picker
- Permission assignment same as PermissionPopup
- Validation: unique name, hex color format, max lengths

---

## 6. Admin Roles Page Layout

**Route:** `/admin/roles`
**URL Pattern:** `/app/(admin)/admin/roles/page.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  Roles & Permissions                                              │
│                                                                   │
│  [Preset Roles]  [Custom Roles]  [Discord Sync]  [Audit Log]     │
│                                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │ ◆ owner      │ │ ◆ admin     │ │ ◆ god        │              │
│  │ RED (locked) │ │ AMBER       │ │ PURPLE       │              │
│  │ All perms    │ │ Full auth   │ │ Ceremonial   │              │
│  │ [View →]     │ │ [Manage →]  │ │ [Manage →]   │              │
│  └──────────────┘ └──────────────┘ └──────────────┘              │
│  ┌──────────────┐ ┌──────────────┐                               │
│  │ ◆ helper     │ │ ◆ member     │                               │
│  │ BLUE         │ │ GRAY         │                               │
│  │ Ticket mgmt  │ │ Default      │                               │
│  │ [Manage →]   │ │ [Manage →]  │                               │
│  └──────────────┘ └──────────────┘                               │
│                                                                   │
│  [+ Create Custom Role]                                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. Social Page Rebuild

**Route:** `/social`
**URL Pattern:** `/app/(public)/social/page.tsx`

### Layout
```
┌─ Social ────────────────────────────────────────────────────────┐
│  🔍 Search players by name, username, or email...               │
│                                                                │
│  [Friends (12)]  [Requests (3)]  [Find Players]               │
│                                                                │
│  ═══ ONLINE ON SMP (4) ════════════════════════════════════════ │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                  │
│  │ Avatar │ │ Avatar │ │ Avatar │ │ Avatar │                  │
│  │ Username│ │ Username│ │ Username│ │ Username│                  │
│  │ ● Online│ │ ● Online│ │ ● Online│ │ ● Online│                  │
│  └────────┘ └────────┘ └────────┘ └────────┘                  │
│                                                                │
│  ═══ ONLINE ON SITE (2) ══════════════════════════════════════ │
│  ...                                                           │
│                                                                │
│  ═══ OFFLINE (6) ══════════════════════════════════════════════ │
│  ...                                                           │
└────────────────────────────────────────────────────────────────┘
```

### Tab Details

**Friends Tab:**
- Groups: "Online on SMP" (green), "Online on Site" (blue), "Offline" (gray)
- Each card: avatar, username, online status indicator, [View Profile] [Remove]
- Online on SMP shows Minecraft head, Online on Site shows Discord avatar

**Requests Tab:**
- Two sections: "Received" (with badge count) and "Sent"
- Each received request: requester info, [Accept ✓] [Reject ✗] [View Profile]
- Each sent request: recipient info, status badge (Pending ✓ / Accepted ✓ / Rejected ✗)
- Status is ALWAYS visible to the sender

**Find Players Tab:**
- Search input with debounce (300ms)
- Filter chips: [All] [Online on SMP] [Online on Site] [Offline]
- Results grid: PlayerCard with [Add Friend] [View Profile] buttons
- Pagination: infinite scroll or "Load More"

### PlayerCard Component
```
┌──────────────────────────┐
│  [avatar]                │
│  PlayerName              │
│  ◆ Admin  🎮 MCUser     │
│  ● Online on SMP         │
│  [Add Friend] [Profile]  │
└──────────────────────────┘
```

---

## 8. Member Default Capabilities

Every logged-in user automatically has the `member` role.

**Can do:**
- View public marketplace
- Search and find any player
- View public player profiles
- Send/accept/reject/remove friends
- Follow/unfollow players
- Submit player reports
- View own inventory
- Sell/gift/auction own items
- Create and view own support tickets
- Browse trade listings

**Cannot do (without explicit custom role):**
- View other players' inventories
- Moderate players
- Access admin panels
- Manage servers or site config
- View reports or moderation logs

---

## 9. Implementation Phases

### Phase 1: Foundation
- Database migration (new tables + seed permissions)
- API routes: `/api/permissions`, `/api/roles`, `/api/roles/custom`, `/api/discord-sync`
- `lib/permissions.ts` — permission checking helper
- Update `lib/api-auth.ts` with new role helpers

### Phase 2: Admin UI
- Rebuild `/admin/roles` page
- PermissionPopup modal
- CustomRoleCreator modal
- DiscordSyncPanel tab
- Audit log tab + `/api/audit-log`

### Phase 3: Social Platform
- Rebuild `/social` page with tabbed interface
- Friend request accept/reject API updates
- Status visibility in sent requests
- Player search with SMP/site/offline filters
- PlayerCard component

### Phase 4: Integration
- Update middleware to use fine-grained permission checks
- Update `useAuth` hook with permission checking
- Add `usePermission(permissionKey)` hook
- Protect API routes with permission checks
- Update player profile to respect `social.player.view_full`

---

## 10. File List

### New Files
```
app/api/permissions/route.ts
app/api/roles/route.ts
app/api/roles/[role]/permissions/route.ts
app/api/roles/custom/route.ts
app/api/roles/custom/[name]/route.ts
app/api/discord-sync/route.ts
app/api/discord-sync/sync/route.ts
app/api/audit-log/route.ts
app/(admin)/admin/roles/components/PermissionPopup.tsx
app/(admin)/admin/roles/components/DiscordSyncPanel.tsx
app/(admin)/admin/roles/components/CustomRoleCreator.tsx
app/(admin)/admin/roles/components/PermissionToggle.tsx
app/(admin)/admin/roles/components/RoleCard.tsx
app/(admin)/admin/roles/components/AuditLogTable.tsx
components/ui/permission-toggle.tsx (shared)
components/social/PlayerCard.tsx
components/social/FriendRequestCard.tsx
lib/permissions.ts
lib/db/migrations/004_permissions.sql
scripts/seed-permissions.ts
```

### Modified Files
```
app/(admin)/admin/roles/page.tsx       — Full rebuild
app/(admin)/admin/page.tsx             — Minor: use new permission hooks
app/(public)/social/page.tsx           — Full rebuild
app/(public)/players/page.tsx           — Add SMP/Site/Offline filters
app/(public)/players/[id]/page.tsx     — Respect view_full permission
lib/api-auth.ts                         — Add new auth helpers
lib/auth.ts                             — Update role creation
middleware.ts                           — Fine-grained route protection
lib/db-frontend.ts                      — Add new DB functions
lib/site.config.ts                      — Add permission categories config
hooks/use-auth.ts                       — Add usePermission hook
app/api/users/me/friends/route.ts       — Status visibility fix
app/api/users/me/requests/route.ts      — Return status to sender
app/api/users/me/requests/[id]/route.ts — Accept/reject updates status
```

---

## 11. Visual Design Tokens

### Admin (Industrial Utilitarian)
- Background: `#0a0f1a`
- Card: `#111827` with `1px solid rgba(6,182,212,0.2)` border
- Primary accent: `#06b6d4` (cyan-500)
- Danger: `#ef4444` (red-500)
- Warning: `#f59e0b` (amber-500)
- Success: `#22c55e` (green-500)
- Text primary: `#f9fafb`
- Text secondary: `#9ca3af`
- Font: JetBrains Mono (monospace) for data, Inter for UI labels

### Social (Glassmorphism + Neon)
- Background: `#0A0E14`
- Card: `rgba(17,24,39,0.8)` with `backdrop-blur-xl`
- Online indicator: `#22c55e`
- Offline indicator: `#6b7280`
- Accent glow: `rgba(6,182,212,0.3)` box-shadow
- Font: Outfit (display), Plus Jakarta Sans (body)
