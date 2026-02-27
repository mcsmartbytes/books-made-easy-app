-- Add external sync tracking columns to tables
-- Run this in Supabase SQL Editor to enable sync functionality

-- Add to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS external_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_customers_external ON customers(external_source, external_id);

-- Add to vendors table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS external_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_vendors_external ON vendors(external_source, external_id);

-- Add to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS external_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_invoices_external ON invoices(external_source, external_id);

-- Add to bills table
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS external_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_bills_external ON bills(external_source, external_id);

-- Add comments for documentation
COMMENT ON COLUMN customers.external_id IS 'External system ID for synced records (e.g., sitesense:client:uuid)';
COMMENT ON COLUMN customers.external_source IS 'Source system name (e.g., sitesense, expenses_made_easy)';
COMMENT ON COLUMN vendors.external_id IS 'External system ID for synced records';
COMMENT ON COLUMN vendors.external_source IS 'Source system name';
COMMENT ON COLUMN invoices.external_id IS 'External system ID for synced records (e.g., sitesense:estimate:uuid)';
COMMENT ON COLUMN invoices.external_source IS 'Source system name';
COMMENT ON COLUMN bills.external_id IS 'External system ID for synced records (e.g., expenses:uuid, mileage:uuid)';
COMMENT ON COLUMN bills.external_source IS 'Source system name';
