-- Migration 002: Banking & Reconciliation
-- Run against Turso database
-- Adds bank_accounts, bank_transactions, and reconciliations tables

-- ============================================
-- BANK ACCOUNTS
-- ============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  institution TEXT,
  account_type TEXT NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'credit_card', 'loan', 'other')),
  account_number_last4 TEXT,
  routing_number_last4 TEXT,
  current_balance REAL DEFAULT 0,
  available_balance REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  is_active INTEGER DEFAULT 1,
  last_reconciled_date TEXT,
  last_reconciled_balance REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_id ON bank_accounts(account_id);

-- ============================================
-- BANK TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL DEFAULT 'debit' CHECK (type IN ('debit', 'credit')),
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  payee TEXT,
  reference TEXT,
  check_number TEXT,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (status IN ('unreviewed', 'reviewed', 'matched', 'excluded')),
  matched_transaction_type TEXT CHECK (matched_transaction_type IN ('invoice', 'bill', 'expense', 'payment', 'journal_entry', NULL)),
  matched_transaction_id TEXT,
  reconciliation_id TEXT REFERENCES reconciliations(id) ON DELETE SET NULL,
  is_reconciled INTEGER DEFAULT 0,
  import_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_id ON bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank_account_id ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reconciliation_id ON bank_transactions(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_import_id ON bank_transactions(import_id);

-- ============================================
-- RECONCILIATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS reconciliations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  statement_date TEXT NOT NULL,
  statement_balance REAL NOT NULL,
  opening_balance REAL NOT NULL DEFAULT 0,
  cleared_balance REAL DEFAULT 0,
  difference REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reconciliations_user_id ON reconciliations(user_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_bank_account_id ON reconciliations(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_status ON reconciliations(status);

-- ============================================
-- TRIGGERS: auto-update updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_bank_accounts_updated_at AFTER UPDATE ON bank_accounts
BEGIN UPDATE bank_accounts SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_bank_transactions_updated_at AFTER UPDATE ON bank_transactions
BEGIN UPDATE bank_transactions SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_reconciliations_updated_at AFTER UPDATE ON reconciliations
BEGIN UPDATE reconciliations SET updated_at = datetime('now') WHERE id = NEW.id; END;
