-- Migration 004: Add customer_notes and customer_todos tables
-- These support per-customer notes and task tracking from the customer detail view.

-- ============================================
-- CUSTOMER NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS customer_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_notes_user_id ON customer_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON customer_notes(customer_id);

-- ============================================
-- CUSTOMER TODOS
-- ============================================
CREATE TABLE IF NOT EXISTS customer_todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed INTEGER DEFAULT 0,
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_todos_user_id ON customer_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_todos_customer_id ON customer_todos(customer_id);

-- Triggers
CREATE TRIGGER IF NOT EXISTS update_customer_notes_updated_at AFTER UPDATE ON customer_notes
BEGIN UPDATE customer_notes SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_customer_todos_updated_at AFTER UPDATE ON customer_todos
BEGIN UPDATE customer_todos SET updated_at = datetime('now') WHERE id = NEW.id; END;
