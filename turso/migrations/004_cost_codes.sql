-- ============================================
-- COST CODES (CSI MasterFormat compatible)
-- ============================================
CREATE TABLE IF NOT EXISTS cost_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  division TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_code TEXT,
  level INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cost_codes_code ON cost_codes(code);
CREATE INDEX IF NOT EXISTS idx_cost_codes_division ON cost_codes(division);
CREATE INDEX IF NOT EXISTS idx_cost_codes_user_id ON cost_codes(user_id);

-- ============================================
-- COST CODE BUDGETS (per job, per cost code)
-- ============================================
CREATE TABLE IF NOT EXISTS cost_code_budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  cost_code_id TEXT NOT NULL REFERENCES cost_codes(id) ON DELETE CASCADE,
  budget_amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(job_id, cost_code_id)
);
CREATE INDEX IF NOT EXISTS idx_ccb_job_id ON cost_code_budgets(job_id);
CREATE INDEX IF NOT EXISTS idx_ccb_cost_code_id ON cost_code_budgets(cost_code_id);

-- ============================================
-- Add cost_code_id to bills and expenses
-- ============================================
-- Bills can be tagged with a cost code
ALTER TABLE bills ADD COLUMN cost_code_id TEXT REFERENCES cost_codes(id) ON DELETE SET NULL;

-- Bill items can be tagged with a cost code
ALTER TABLE bill_items ADD COLUMN cost_code_id TEXT REFERENCES cost_codes(id) ON DELETE SET NULL;

-- Expenses can be tagged with a cost code
ALTER TABLE expenses ADD COLUMN cost_code_id TEXT REFERENCES cost_codes(id) ON DELETE SET NULL;
