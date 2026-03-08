-- ============================================
-- PHASE 5: SiteSense Sync Layer
-- ============================================
-- PostgreSQL notes for future AWS migration:
--   datetime('now') → NOW()
--   INTEGER (0/1) → BOOLEAN
--   TEXT for JSON → JSONB
--   UNIQUE constraints → same syntax
--   Triggers → similar but different syntax

-- SYNC CONNECTIONS (one per external system per entity)
CREATE TABLE IF NOT EXISTS sync_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'sitesense'
    CHECK (source IN ('sitesense', 'expenses_made_easy', 'other')),
  display_name TEXT NOT NULL DEFAULT 'SiteSense',
  endpoint_url TEXT,
  -- Stored encrypted (AES-256), not plaintext — needed for HMAC verification
  webhook_secret_encrypted TEXT,
  -- Hashed API key for pull mode auth
  api_key_encrypted TEXT,
  is_active INTEGER DEFAULT 1,
  auto_sync INTEGER DEFAULT 1,
  last_pull_at TEXT,
  last_push_at TEXT,
  last_error TEXT,
  pull_interval_minutes INTEGER DEFAULT 60,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, entity_id, source)
);
CREATE INDEX IF NOT EXISTS idx_sync_connections_user ON sync_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_connections_source ON sync_connections(source);
CREATE INDEX IF NOT EXISTS idx_sync_connections_entity ON sync_connections(entity_id);

-- SYNC EVENTS (raw inbound log — every webhook/pull recorded before processing)
CREATE TABLE IF NOT EXISTS sync_events (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES sync_connections(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  object_type TEXT NOT NULL,
  external_id TEXT,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'skipped')),
  error_message TEXT,
  processed_at TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sync_events_connection ON sync_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_status ON sync_events(status);
CREATE INDEX IF NOT EXISTS idx_sync_events_object_type ON sync_events(object_type);
CREATE INDEX IF NOT EXISTS idx_sync_events_external_id ON sync_events(external_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_created_at ON sync_events(created_at);

-- SYNC LOG (canonical mapping: external_id ↔ local_id per object)
CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES sync_connections(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  local_id TEXT NOT NULL,
  local_table TEXT NOT NULL,
  sync_direction TEXT NOT NULL DEFAULT 'inbound'
    CHECK (sync_direction IN ('inbound', 'outbound', 'bidirectional')),
  last_synced_at TEXT NOT NULL,
  source_checksum TEXT,
  local_checksum TEXT,
  sync_count INTEGER DEFAULT 1,
  last_event_id TEXT REFERENCES sync_events(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(connection_id, object_type, external_id)
);
CREATE INDEX IF NOT EXISTS idx_sync_log_connection ON sync_log(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_object_type ON sync_log(object_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_external_id ON sync_log(external_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_local_id ON sync_log(local_id);

-- SYNC CONFLICTS (where auto-resolution failed — needs manual review)
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES sync_connections(id) ON DELETE CASCADE,
  sync_log_id TEXT NOT NULL REFERENCES sync_log(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  local_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  local_value TEXT,
  remote_value TEXT,
  local_updated_at TEXT,
  remote_updated_at TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved_local', 'resolved_remote', 'dismissed')),
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_connection ON sync_conflicts(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON sync_conflicts(status);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_object_type ON sync_conflicts(object_type);

-- SOV LINES (Schedule of Values — synced from SiteSense)
CREATE TABLE IF NOT EXISTS sov_lines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  external_id TEXT,
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  scheduled_value REAL NOT NULL DEFAULT 0,
  work_completed_previous REAL DEFAULT 0,
  work_completed_this_period REAL DEFAULT 0,
  materials_stored REAL DEFAULT 0,
  percent_complete REAL DEFAULT 0,
  balance_to_finish REAL DEFAULT 0,
  retainage_pct REAL DEFAULT 10,
  cost_code_id TEXT REFERENCES cost_codes(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(job_id, line_number)
);
CREATE INDEX IF NOT EXISTS idx_sov_lines_job ON sov_lines(job_id);
CREATE INDEX IF NOT EXISTS idx_sov_lines_user ON sov_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_sov_lines_entity ON sov_lines(entity_id);

-- EQUIPMENT LOG (field equipment usage — synced from SiteSense)
CREATE TABLE IF NOT EXISTS equipment_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  external_id TEXT,
  equipment_name TEXT NOT NULL,
  equipment_type TEXT,
  hours_used REAL DEFAULT 0,
  rate_per_hour REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  log_date TEXT NOT NULL,
  operator_name TEXT,
  notes TEXT,
  cost_code_id TEXT REFERENCES cost_codes(id) ON DELETE SET NULL,
  bill_id TEXT REFERENCES bills(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_equipment_log_job ON equipment_log(job_id);
CREATE INDEX IF NOT EXISTS idx_equipment_log_user ON equipment_log(user_id);
CREATE INDEX IF NOT EXISTS idx_equipment_log_entity ON equipment_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_equipment_log_date ON equipment_log(log_date);

-- TIMECARDS (synced from SiteSense, feeds into payroll)
CREATE TABLE IF NOT EXISTS timecards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  external_id TEXT,
  employee_name TEXT NOT NULL,
  employee_id TEXT,
  work_date TEXT NOT NULL,
  hours_regular REAL DEFAULT 0,
  hours_overtime REAL DEFAULT 0,
  hours_total REAL DEFAULT 0,
  rate_regular REAL DEFAULT 0,
  rate_overtime REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'posted', 'rejected')),
  cost_code_id TEXT REFERENCES cost_codes(id) ON DELETE SET NULL,
  bill_id TEXT REFERENCES bills(id) ON DELETE SET NULL,
  approved_by TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_timecards_job ON timecards(job_id);
CREATE INDEX IF NOT EXISTS idx_timecards_user ON timecards(user_id);
CREATE INDEX IF NOT EXISTS idx_timecards_entity ON timecards(entity_id);
CREATE INDEX IF NOT EXISTS idx_timecards_status ON timecards(status);
CREATE INDEX IF NOT EXISTS idx_timecards_work_date ON timecards(work_date);
CREATE INDEX IF NOT EXISTS idx_timecards_external_id ON timecards(external_id);

-- CONTRACTOR COMPLIANCE (synced from SiteSense — links to vendors table)
CREATE TABLE IF NOT EXISTS contractor_compliance (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  external_id TEXT,
  -- W-9 / Tax info
  w9_on_file INTEGER DEFAULT 0,
  w9_received_date TEXT,
  tax_classification TEXT,
  -- Insurance
  insurance_gl_carrier TEXT,
  insurance_gl_policy TEXT,
  insurance_gl_expiry TEXT,
  insurance_gl_amount REAL,
  insurance_wc_carrier TEXT,
  insurance_wc_policy TEXT,
  insurance_wc_expiry TEXT,
  insurance_wc_amount REAL,
  insurance_auto_carrier TEXT,
  insurance_auto_policy TEXT,
  insurance_auto_expiry TEXT,
  insurance_auto_amount REAL,
  insurance_umbrella_carrier TEXT,
  insurance_umbrella_policy TEXT,
  insurance_umbrella_expiry TEXT,
  insurance_umbrella_amount REAL,
  -- Licensing
  license_number TEXT,
  license_state TEXT,
  license_type TEXT,
  license_expiry TEXT,
  -- Safety
  safety_cert_type TEXT,
  safety_cert_expiry TEXT,
  osha_number TEXT,
  emr_rate REAL,
  -- Overall status (computed from above fields)
  compliance_status TEXT NOT NULL DEFAULT 'missing'
    CHECK (compliance_status IN ('compliant', 'expiring', 'expired', 'missing')),
  last_verified_at TEXT,
  last_synced_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(vendor_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_contractor_compliance_vendor ON contractor_compliance(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_compliance_entity ON contractor_compliance(entity_id);
CREATE INDEX IF NOT EXISTS idx_contractor_compliance_status ON contractor_compliance(compliance_status);
CREATE INDEX IF NOT EXISTS idx_contractor_compliance_user ON contractor_compliance(user_id);

-- Add contractor_type to vendors for 1099 tracking
ALTER TABLE vendors ADD COLUMN vendor_type TEXT DEFAULT 'vendor'
  CHECK (vendor_type IN ('vendor', 'contractor', 'subcontractor'));
ALTER TABLE vendors ADD COLUMN is_1099_eligible INTEGER DEFAULT 0;
ALTER TABLE vendors ADD COLUMN default_cost_code_id TEXT REFERENCES cost_codes(id) ON DELETE SET NULL;

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_sync_connections_updated_at AFTER UPDATE ON sync_connections
BEGIN UPDATE sync_connections SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_sync_log_updated_at AFTER UPDATE ON sync_log
BEGIN UPDATE sync_log SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_sov_lines_updated_at AFTER UPDATE ON sov_lines
BEGIN UPDATE sov_lines SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_equipment_log_updated_at AFTER UPDATE ON equipment_log
BEGIN UPDATE equipment_log SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_timecards_updated_at AFTER UPDATE ON timecards
BEGIN UPDATE timecards SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_contractor_compliance_updated_at AFTER UPDATE ON contractor_compliance
BEGIN UPDATE contractor_compliance SET updated_at = datetime('now') WHERE id = NEW.id; END;
