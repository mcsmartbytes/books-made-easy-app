-- Migration 005: Reminder Settings, Invoice Reminders, Late Fee Settings, Invoice Late Fees
-- Run against Turso to add overdue reminder tracking and late fee application

-- ============================================
-- REMINDER SETTINGS (per-user config)
-- ============================================
CREATE TABLE IF NOT EXISTS reminder_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER DEFAULT 0,
  grace_period_days INTEGER DEFAULT 3,
  frequency_days INTEGER DEFAULT 7,
  max_reminders INTEGER DEFAULT 3,
  default_message TEXT DEFAULT 'This is a friendly reminder that your invoice is past due. Please arrange payment at your earliest convenience.',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reminder_settings_user_id ON reminder_settings(user_id);

-- ============================================
-- INVOICE REMINDERS (log of each reminder sent)
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL DEFAULT 'manual' CHECK (reminder_type IN ('manual', 'automatic')),
  message TEXT,
  sent_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_user_id ON invoice_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice_id ON invoice_reminders(invoice_id);

-- ============================================
-- LATE FEE SETTINGS (per-user config)
-- ============================================
CREATE TABLE IF NOT EXISTS late_fee_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER DEFAULT 0,
  fee_type TEXT NOT NULL DEFAULT 'percentage' CHECK (fee_type IN ('percentage', 'flat')),
  fee_amount REAL DEFAULT 1.5,
  grace_period_days INTEGER DEFAULT 5,
  auto_apply INTEGER DEFAULT 0,
  max_fees_per_invoice INTEGER DEFAULT 3,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_late_fee_settings_user_id ON late_fee_settings(user_id);

-- ============================================
-- INVOICE LATE FEES (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_late_fees (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL CHECK (fee_type IN ('percentage', 'flat')),
  fee_amount REAL NOT NULL,
  calculated_fee REAL NOT NULL,
  invoice_total_before REAL NOT NULL,
  invoice_total_after REAL NOT NULL,
  applied_type TEXT NOT NULL DEFAULT 'manual' CHECK (applied_type IN ('manual', 'automatic')),
  reversed INTEGER DEFAULT 0,
  applied_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoice_late_fees_user_id ON invoice_late_fees(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_late_fees_invoice_id ON invoice_late_fees(invoice_id);

-- ============================================
-- TRIGGERS: auto-update updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_reminder_settings_updated_at AFTER UPDATE ON reminder_settings
BEGIN UPDATE reminder_settings SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_late_fee_settings_updated_at AFTER UPDATE ON late_fee_settings
BEGIN UPDATE late_fee_settings SET updated_at = datetime('now') WHERE id = NEW.id; END;
