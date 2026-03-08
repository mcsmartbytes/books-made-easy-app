-- ============================================
-- PHASE 2: Retainage Engine + Change Orders
-- ============================================

-- Add retainage fields to invoices
ALTER TABLE invoices ADD COLUMN retainage_percent REAL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN retainage_amount REAL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN retainage_released REAL DEFAULT 0;

-- Add retainage fields to bills (payable side)
ALTER TABLE bills ADD COLUMN retainage_percent REAL DEFAULT 0;
ALTER TABLE bills ADD COLUMN retainage_amount REAL DEFAULT 0;
ALTER TABLE bills ADD COLUMN retainage_released REAL DEFAULT 0;

-- Add default retainage percent to jobs
ALTER TABLE jobs ADD COLUMN retainage_percent REAL DEFAULT 10;

-- ============================================
-- CHANGE ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS change_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  co_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'voided')),
  type TEXT NOT NULL DEFAULT 'addition' CHECK (type IN ('addition', 'deduction', 'no_cost')),
  revenue_impact REAL DEFAULT 0,
  cost_impact REAL DEFAULT 0,
  margin_impact REAL DEFAULT 0,
  submitted_date TEXT,
  approved_date TEXT,
  days_impact INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, job_id, co_number)
);
CREATE INDEX IF NOT EXISTS idx_change_orders_user_id ON change_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_job_id ON change_orders(job_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(user_id, status);

CREATE TRIGGER IF NOT EXISTS update_change_orders_updated_at AFTER UPDATE ON change_orders
BEGIN UPDATE change_orders SET updated_at = datetime('now') WHERE id = NEW.id; END;
