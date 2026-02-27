-- Migration 003: Deposits
-- Run against Turso database
-- Groups received payments into bank deposits

-- ============================================
-- DEPOSITS
-- ============================================
CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE SET NULL,
  deposit_number TEXT NOT NULL,
  deposit_date TEXT NOT NULL DEFAULT (date('now')),
  total REAL DEFAULT 0,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deposited')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_bank_account_id ON deposits(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- ============================================
-- DEPOSIT ITEMS (links payments to a deposit)
-- ============================================
CREATE TABLE IF NOT EXISTS deposit_items (
  id TEXT PRIMARY KEY,
  deposit_id TEXT NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  payment_id TEXT REFERENCES payments_received(id) ON DELETE SET NULL,
  description TEXT,
  amount REAL NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deposit_items_deposit_id ON deposit_items(deposit_id);
CREATE INDEX IF NOT EXISTS idx_deposit_items_payment_id ON deposit_items(payment_id);

-- ============================================
-- Add deposit_id to payments_received for tracking
-- ============================================
ALTER TABLE payments_received ADD COLUMN deposit_id TEXT REFERENCES deposits(id) ON DELETE SET NULL;

-- ============================================
-- TRIGGERS: auto-update updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_deposits_updated_at AFTER UPDATE ON deposits
BEGIN UPDATE deposits SET updated_at = datetime('now') WHERE id = NEW.id; END;
