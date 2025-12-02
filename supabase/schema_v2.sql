-- Books Made Easy - Schema Updates v2
-- Run this in your Supabase SQL Editor AFTER the initial schema

-- ============================================
-- ADD INDUSTRY TO COMPANY SETTINGS
-- ============================================
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS industry_id VARCHAR(50);

-- ============================================
-- CATEGORIES TABLE (for products, services, expenses)
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

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policies for categories
CREATE POLICY "Users can view own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(user_id, type);

-- Trigger for updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PRODUCTS/SERVICES TABLE (for invoicing)
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

-- Enable RLS
ALTER TABLE products_services ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own products_services" ON products_services FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products_services" ON products_services FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products_services" ON products_services FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products_services" ON products_services FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_services_user_id ON products_services(user_id);
CREATE INDEX IF NOT EXISTS idx_products_services_type ON products_services(user_id, type);

-- Trigger
CREATE TRIGGER update_products_services_updated_at
  BEFORE UPDATE ON products_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ADD CATEGORY TO BILLS (if not exists)
-- ============================================
-- Note: category column might already exist as VARCHAR, this adds the FK reference
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- ============================================
-- ADD PRODUCT/SERVICE TO INVOICE ITEMS
-- ============================================
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS product_service_id UUID REFERENCES products_services(id) ON DELETE SET NULL;

-- ============================================
-- ADD CATEGORY TO BILL ITEMS
-- ============================================
ALTER TABLE bill_items
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
