-- ============================================
-- PHASE 4: Multi-Entity & Multi-Location
-- ============================================

-- ORGANIZATIONS (top-level grouping)
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  fiscal_year_start TEXT DEFAULT 'january',
  currency TEXT DEFAULT 'USD',
  logo_url TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);

-- ENTITIES (companies/divisions within an organization)
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  legal_name TEXT,
  entity_type TEXT NOT NULL DEFAULT 'company' CHECK (entity_type IN ('company', 'division', 'branch', 'department')),
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'United States',
  currency TEXT DEFAULT 'USD',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_entities_organization_id ON entities(organization_id);

-- LOCATIONS (physical locations within an entity)
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'office' CHECK (location_type IN ('office', 'warehouse', 'jobsite', 'shop', 'yard', 'other')),
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'United States',
  phone TEXT,
  is_primary INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_locations_entity_id ON locations(entity_id);

-- USER-ENTITY ROLES (access control per entity)
CREATE TABLE IF NOT EXISTS user_entity_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'manager', 'accountant', 'viewer')),
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, organization_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_user_entity_roles_user_id ON user_entity_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_entity_roles_org_id ON user_entity_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_entity_roles_entity_id ON user_entity_roles(entity_id);

-- INTER-COMPANY TRANSACTIONS
CREATE TABLE IF NOT EXISTS intercompany_transactions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL DEFAULT 'transfer' CHECK (transaction_type IN ('transfer', 'allocation', 'loan', 'reimbursement')),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  transaction_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'posted', 'voided')),
  from_account_id TEXT REFERENCES accounts(id),
  to_account_id TEXT REFERENCES accounts(id),
  reference TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intercompany_org_id ON intercompany_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_from_entity ON intercompany_transactions(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_to_entity ON intercompany_transactions(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_status ON intercompany_transactions(status);

-- Add entity_id to key existing tables
ALTER TABLE jobs ADD COLUMN entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN location_id TEXT REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE bills ADD COLUMN entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE accounts ADD COLUMN entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE vendors ADD COLUMN entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE bank_accounts ADD COLUMN entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE journal_entries ADD COLUMN entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL;

-- Triggers
CREATE TRIGGER IF NOT EXISTS update_organizations_updated_at AFTER UPDATE ON organizations
BEGIN UPDATE organizations SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_entities_updated_at AFTER UPDATE ON entities
BEGIN UPDATE entities SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_locations_updated_at AFTER UPDATE ON locations
BEGIN UPDATE locations SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_user_entity_roles_updated_at AFTER UPDATE ON user_entity_roles
BEGIN UPDATE user_entity_roles SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_intercompany_transactions_updated_at AFTER UPDATE ON intercompany_transactions
BEGIN UPDATE intercompany_transactions SET updated_at = datetime('now') WHERE id = NEW.id; END;
