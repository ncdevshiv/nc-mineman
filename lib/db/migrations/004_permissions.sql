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
