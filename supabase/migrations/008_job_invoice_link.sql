-- Add job_id column to invoices table to link invoices with jobs
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

-- Create index for faster job-invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
