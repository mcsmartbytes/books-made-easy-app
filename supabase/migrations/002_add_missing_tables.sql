-- Books Made Easy - Add Missing Tables
-- Run this if you already have the base schema (customers, vendors, accounts, etc.)
-- This adds: jobs, estimates, payments, journal_entries, custom_reports, and related tables

-- ============================================
-- HELPER FUNCTION (create if not exists)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CATEGORIES TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('income', 'expense', 'product', 'service')),
  tax_deductible BOOLEAN DEFAULT false,
  irs_category VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTS/SERVICES TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS products_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('product', 'service')),
  sku VARCHAR(100),
  price DECIMAL(12,2) DEFAULT 0,
  cost DECIMAL(12,2) DEFAULT 0,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  is_taxable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  job_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  start_date DATE,
  end_date DATE,
  estimated_revenue DECIMAL(12,2) DEFAULT 0,
  estimated_cost DECIMAL(12,2) DEFAULT 0,
  actual_revenue DECIMAL(12,2) DEFAULT 0,
  actual_cost DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- JOB PHASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS job_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  estimated_hours DECIMAL(8,2) DEFAULT 0,
  estimated_cost DECIMAL(12,2) DEFAULT 0,
  actual_hours DECIMAL(8,2) DEFAULT 0,
  actual_cost DECIMAL(12,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADD COLUMNS TO INVOICES (if not exist)
-- ============================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_phase_id UUID REFERENCES job_phases(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS estimate_id UUID;

-- ============================================
-- ADD COLUMNS TO INVOICE_ITEMS (if not exist)
-- ============================================
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS product_service_id UUID REFERENCES products_services(id) ON DELETE SET NULL;

-- ============================================
-- ADD COLUMNS TO BILLS (if not exist)
-- ============================================
ALTER TABLE bills ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS job_phase_id UUID REFERENCES job_phases(id) ON DELETE SET NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- ============================================
-- ADD COLUMNS TO BILL_ITEMS (if not exist)
-- ============================================
ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- ============================================
-- ESTIMATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  estimate_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted')),
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  converted_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ESTIMATE LINE ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  product_service_id UUID REFERENCES products_services(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  rate DECIMAL(12,2) DEFAULT 0,
  amount DECIMAL(12,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENTS TABLE (unified)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('received', 'made')),
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('cash', 'check', 'credit_card', 'bank_transfer', 'other')),
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- JOURNAL ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  total_debits DECIMAL(12,2) DEFAULT 0,
  total_credits DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- JOURNAL ENTRY LINES
-- ============================================
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  description TEXT,
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUSTOM REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  data_source TEXT NOT NULL CHECK (data_source IN ('invoices', 'bills', 'payments', 'customers', 'vendors', 'products', 'jobs', 'journal_entries')),
  columns JSONB NOT NULL DEFAULT '[]',
  filters JSONB NOT NULL DEFAULT '[]',
  sort_by TEXT,
  sort_order TEXT DEFAULT 'asc' CHECK (sort_order IN ('asc', 'desc')),
  group_by TEXT,
  date_field TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADD industry_id TO COMPANY_SETTINGS (if not exists)
-- ============================================
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS industry_id VARCHAR(50);

-- ============================================
-- ENABLE RLS ON NEW TABLES
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: CATEGORIES
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Users can view own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- RLS POLICIES: PRODUCTS_SERVICES
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Users can view own products_services" ON products_services FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert own products_services" ON products_services FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update own products_services" ON products_services FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete own products_services" ON products_services FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- RLS POLICIES: JOBS
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Users can view their own jobs" ON jobs FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert their own jobs" ON jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update their own jobs" ON jobs FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete their own jobs" ON jobs FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- RLS POLICIES: JOB_PHASES
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Users can view phases of their jobs" ON job_phases FOR SELECT USING (
    EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_phases.job_id AND jobs.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert phases to their jobs" ON job_phases FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_phases.job_id AND jobs.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update phases of their jobs" ON job_phases FOR UPDATE USING (
    EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_phases.job_id AND jobs.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete phases of their jobs" ON job_phases FOR DELETE USING (
    EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_phases.job_id AND jobs.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- RLS POLICIES: ESTIMATES
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Users can view their own estimates" ON estimates FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert their own estimates" ON estimates FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update their own estimates" ON estimates FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete their own estimates" ON estimates FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- RLS POLICIES: ESTIMATE_ITEMS
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Users can view items of their estimates" ON estimate_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert items to their estimates" ON estimate_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update items of their estimates" ON estimate_items FOR UPDATE USING (
    EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete items of their estimates" ON estimate_items FOR DELETE USING (
    EXISTS (SELECT 1 FROM estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- RLS POLICIES: PAYMENTS
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Users can view their own payments" ON payments FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert their own payments" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update their own payments" ON payments FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete their own payments" ON payments FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- RLS POLICIES: JOURNAL_ENTRIES
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Users can view their own journal entries" ON journal_entries FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert their own journal entries" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update their own journal entries" ON journal_entries FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete their own journal entries" ON journal_entries FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- RLS POLICIES: JOURNAL_ENTRY_LINES
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Users can view lines of their journal entries" ON journal_entry_lines FOR SELECT USING (
    EXISTS (SELECT 1 FROM journal_entries WHERE journal_entries.id = journal_entry_lines.journal_entry_id AND journal_entries.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert lines to their journal entries" ON journal_entry_lines FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM journal_entries WHERE journal_entries.id = journal_entry_lines.journal_entry_id AND journal_entries.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update lines of their journal entries" ON journal_entry_lines FOR UPDATE USING (
    EXISTS (SELECT 1 FROM journal_entries WHERE journal_entries.id = journal_entry_lines.journal_entry_id AND journal_entries.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete lines of their journal entries" ON journal_entry_lines FOR DELETE USING (
    EXISTS (SELECT 1 FROM journal_entries WHERE journal_entries.id = journal_entry_lines.journal_entry_id AND journal_entries.user_id = auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- RLS POLICIES: CUSTOM_REPORTS
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Users can view their own custom reports" ON custom_reports FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert their own custom reports" ON custom_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update their own custom reports" ON custom_reports FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete their own custom reports" ON custom_reports FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_products_services_user_id ON products_services(user_id);
CREATE INDEX IF NOT EXISTS idx_products_services_type ON products_services(user_id, type);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_phases_job_id ON job_phases(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_estimate_id ON invoices(estimate_id);
CREATE INDEX IF NOT EXISTS idx_bills_job_id ON bills(job_id);
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_customer_id ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_user_id ON custom_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_data_source ON custom_reports(data_source);
CREATE INDEX IF NOT EXISTS idx_custom_reports_is_favorite ON custom_reports(is_favorite);

-- ============================================
-- TRIGGERS (drop first to avoid duplicates)
-- ============================================
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS update_products_services_updated_at ON products_services;
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
DROP TRIGGER IF EXISTS update_job_phases_updated_at ON job_phases;
DROP TRIGGER IF EXISTS update_estimates_updated_at ON estimates;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
DROP TRIGGER IF EXISTS update_custom_reports_updated_at ON custom_reports;

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_services_updated_at BEFORE UPDATE ON products_services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_phases_updated_at BEFORE UPDATE ON job_phases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_reports_updated_at BEFORE UPDATE ON custom_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
