-- Books Made Easy - Turso/libSQL Schema
-- Run this against your Turso database to create all tables.
-- UUIDs are generated in the application layer (crypto.randomUUID()).
-- Timestamps are stored as ISO 8601 TEXT strings.

PRAGMA foreign_keys = ON;

-- ============================================
-- USERS (NextAuth)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  business_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- CUSTOMERS
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'United States',
  notes TEXT,
  balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  external_id TEXT,
  external_source TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_external ON customers(external_source, external_id);

-- ============================================
-- VENDORS
-- ============================================
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'United States',
  tax_id TEXT,
  notes TEXT,
  balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  external_id TEXT,
  external_source TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_external ON vendors(external_source, external_id);

-- ============================================
-- CHART OF ACCOUNTS
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  subtype TEXT,
  description TEXT,
  balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, code)
);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(user_id, type);

-- ============================================
-- CATEGORIES (products, services, expenses)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'product', 'service')),
  icon TEXT,
  color TEXT,
  tax_deductible INTEGER DEFAULT 0,
  deduction_percentage REAL DEFAULT 0,
  irs_category TEXT,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(user_id, type);

-- ============================================
-- PRODUCTS/SERVICES
-- ============================================
CREATE TABLE IF NOT EXISTS products_services (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('product', 'service')),
  sku TEXT,
  price REAL DEFAULT 0,
  cost REAL DEFAULT 0,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  tax_rate REAL DEFAULT 0,
  is_taxable INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_services_user_id ON products_services(user_id);
CREATE INDEX IF NOT EXISTS idx_products_services_type ON products_services(user_id, type);

-- ============================================
-- JOBS (job costing / project tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  job_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  start_date TEXT,
  end_date TEXT,
  estimated_revenue REAL DEFAULT 0,
  estimated_cost REAL DEFAULT 0,
  actual_revenue REAL DEFAULT 0,
  actual_cost REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- ============================================
-- JOB PHASES
-- ============================================
CREATE TABLE IF NOT EXISTS job_phases (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  estimated_hours REAL DEFAULT 0,
  estimated_cost REAL DEFAULT 0,
  actual_hours REAL DEFAULT 0,
  actual_cost REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_job_phases_job_id ON job_phases(job_id);

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  job_phase_id TEXT REFERENCES job_phases(id) ON DELETE SET NULL,
  estimate_id TEXT,
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issue_date TEXT NOT NULL DEFAULT (date('now')),
  due_date TEXT NOT NULL,
  subtotal REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  amount_paid REAL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  external_id TEXT,
  external_source TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_estimate_id ON invoices(estimate_id);
CREATE INDEX IF NOT EXISTS idx_invoices_external ON invoices(external_source, external_id);

-- ============================================
-- INVOICE LINE ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_service_id TEXT REFERENCES products_services(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  rate REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- ESTIMATES
-- ============================================
CREATE TABLE IF NOT EXISTS estimates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  estimate_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted')),
  issue_date TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  subtotal REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  converted_invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_customer_id ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);

-- ============================================
-- ESTIMATE LINE ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS estimate_items (
  id TEXT PRIMARY KEY,
  estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  product_service_id TEXT REFERENCES products_services(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  rate REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id);

-- ============================================
-- BILLS
-- ============================================
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  job_phase_id TEXT REFERENCES job_phases(id) ON DELETE SET NULL,
  bill_number TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'unpaid', 'paid', 'overdue', 'cancelled')),
  bill_date TEXT NOT NULL DEFAULT (date('now')),
  due_date TEXT NOT NULL,
  category TEXT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  subtotal REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  amount_paid REAL DEFAULT 0,
  description TEXT,
  notes TEXT,
  external_id TEXT,
  external_source TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_vendor_id ON bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_job_id ON bills(job_id);
CREATE INDEX IF NOT EXISTS idx_bills_external ON bills(external_source, external_id);

-- ============================================
-- BILL LINE ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS bill_items (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  rate REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- PAYMENTS (unified)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('received', 'made')),
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  bill_id TEXT REFERENCES bills(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('cash', 'check', 'credit_card', 'bank_transfer', 'other')),
  reference TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- ============================================
-- PAYMENTS RECEIVED (legacy)
-- ============================================
CREATE TABLE IF NOT EXISTS payments_received (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL DEFAULT (date('now')),
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- PAYMENTS MADE (legacy)
-- ============================================
CREATE TABLE IF NOT EXISTS payments_made (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_id TEXT REFERENCES bills(id) ON DELETE SET NULL,
  vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL DEFAULT (date('now')),
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- JOURNAL ENTRIES
-- ============================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  total_debits REAL DEFAULT 0,
  total_credits REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);

-- ============================================
-- JOURNAL ENTRY LINES
-- ============================================
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id TEXT PRIMARY KEY,
  journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  description TEXT,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);

-- ============================================
-- CUSTOM REPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS custom_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  data_source TEXT NOT NULL CHECK (data_source IN ('invoices', 'bills', 'payments', 'customers', 'vendors', 'products', 'jobs', 'journal_entries')),
  columns TEXT NOT NULL DEFAULT '[]',
  filters TEXT NOT NULL DEFAULT '[]',
  sort_by TEXT,
  sort_order TEXT DEFAULT 'asc' CHECK (sort_order IN ('asc', 'desc')),
  group_by TEXT,
  date_field TEXT,
  is_favorite INTEGER DEFAULT 0,
  last_run_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_custom_reports_user_id ON custom_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_data_source ON custom_reports(data_source);
CREATE INDEX IF NOT EXISTS idx_custom_reports_is_favorite ON custom_reports(is_favorite);

-- ============================================
-- COMPANY SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'United States',
  tax_id TEXT,
  fiscal_year_start TEXT DEFAULT 'january',
  currency TEXT DEFAULT 'USD',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  logo_url TEXT,
  industry_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- EXPENSES (from Expenses Made Easy integration)
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor TEXT,
  description TEXT,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  is_business INTEGER DEFAULT 1,
  payment_method TEXT,
  receipt_url TEXT,
  po_number TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);

-- ============================================
-- MERCHANT RULES (auto-categorization by merchant name)
-- ============================================
CREATE TABLE IF NOT EXISTS merchant_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_pattern TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  is_business INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_merchant_rules_user_id ON merchant_rules(user_id);

-- ============================================
-- ITEM CATEGORY RULES (auto-categorization by line item)
-- ============================================
CREATE TABLE IF NOT EXISTS item_category_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_pattern TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  is_business INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_item_category_rules_user_id ON item_category_rules(user_id);

-- ============================================
-- RECURRING EXPENSES
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
  next_due_date TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user_id ON recurring_expenses(user_id);

-- ============================================
-- DETECTED SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS detected_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL,
  vendor_normalized TEXT,
  avg_amount REAL,
  min_amount REAL,
  max_amount REAL,
  frequency TEXT,
  confidence REAL DEFAULT 0,
  first_seen TEXT,
  last_seen TEXT,
  next_expected TEXT,
  occurrence_count INTEGER DEFAULT 0,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  category_name TEXT,
  is_confirmed INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  is_dismissed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, vendor_normalized)
);
CREATE INDEX IF NOT EXISTS idx_detected_subscriptions_user_id ON detected_subscriptions(user_id);

-- ============================================
-- SUBSCRIPTION PRICE HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_price_history (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES detected_subscriptions(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  detected_date TEXT NOT NULL,
  expense_id TEXT REFERENCES expenses(id) ON DELETE SET NULL,
  price_change REAL,
  price_change_pct REAL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(subscription_id, detected_date)
);
CREATE INDEX IF NOT EXISTS idx_subscription_price_history_sub_id ON subscription_price_history(subscription_id);

-- ============================================
-- BUDGETS
-- ============================================
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'quarterly', 'annually')),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);

-- ============================================
-- MILEAGE TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS mileage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  distance REAL NOT NULL,
  is_business INTEGER DEFAULT 1,
  purpose TEXT,
  start_location TEXT,
  end_location TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mileage_user_id ON mileage(user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_date ON mileage(date);

-- ============================================
-- TRIGGERS: auto-update updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_users_updated_at AFTER UPDATE ON users
BEGIN UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_customers_updated_at AFTER UPDATE ON customers
BEGIN UPDATE customers SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_vendors_updated_at AFTER UPDATE ON vendors
BEGIN UPDATE vendors SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_accounts_updated_at AFTER UPDATE ON accounts
BEGIN UPDATE accounts SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_categories_updated_at AFTER UPDATE ON categories
BEGIN UPDATE categories SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_products_services_updated_at AFTER UPDATE ON products_services
BEGIN UPDATE products_services SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_jobs_updated_at AFTER UPDATE ON jobs
BEGIN UPDATE jobs SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_job_phases_updated_at AFTER UPDATE ON job_phases
BEGIN UPDATE job_phases SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_invoices_updated_at AFTER UPDATE ON invoices
BEGIN UPDATE invoices SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_estimates_updated_at AFTER UPDATE ON estimates
BEGIN UPDATE estimates SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_bills_updated_at AFTER UPDATE ON bills
BEGIN UPDATE bills SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_payments_updated_at AFTER UPDATE ON payments
BEGIN UPDATE payments SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_journal_entries_updated_at AFTER UPDATE ON journal_entries
BEGIN UPDATE journal_entries SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_custom_reports_updated_at AFTER UPDATE ON custom_reports
BEGIN UPDATE custom_reports SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_company_settings_updated_at AFTER UPDATE ON company_settings
BEGIN UPDATE company_settings SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_expenses_updated_at AFTER UPDATE ON expenses
BEGIN UPDATE expenses SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_merchant_rules_updated_at AFTER UPDATE ON merchant_rules
BEGIN UPDATE merchant_rules SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_item_category_rules_updated_at AFTER UPDATE ON item_category_rules
BEGIN UPDATE item_category_rules SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_recurring_expenses_updated_at AFTER UPDATE ON recurring_expenses
BEGIN UPDATE recurring_expenses SET updated_at = datetime('now') WHERE id = NEW.id; END;
