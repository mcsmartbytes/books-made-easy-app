-- Migration 001: Add DR/CR markers and help text to Chart of Accounts
-- Run against Turso database

ALTER TABLE accounts ADD COLUMN normal_balance TEXT DEFAULT 'debit' CHECK (normal_balance IN ('debit', 'credit'));
ALTER TABLE accounts ADD COLUMN help_text TEXT;

-- Set normal_balance based on account type for existing rows
UPDATE accounts SET normal_balance = 'debit' WHERE type IN ('asset', 'expense');
UPDATE accounts SET normal_balance = 'credit' WHERE type IN ('liability', 'equity', 'income');
