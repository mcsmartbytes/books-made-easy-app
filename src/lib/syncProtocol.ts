/**
 * Sync Protocol — TypeScript interfaces and pure functions
 *
 * Defines the contract between SiteSense / Expenses Made Easy and Books Made Easy.
 * All mapping, verification, and checksum functions are pure (no DB, no HTTP).
 */

import crypto from 'crypto';

// ============================================
// SOURCE TYPES
// ============================================

export type SyncSource = 'sitesense' | 'expenses_made_easy' | 'other';

// ============================================
// SITESENSE EVENT TYPES
// ============================================

export type SiteSenseEventType =
  | 'job.created'
  | 'job.updated'
  | 'timecard.submitted'
  | 'timecard.approved'
  | 'cost_code.synced'
  | 'change_order.approved'
  | 'sov.updated'
  | 'equipment.logged'
  | 'contractor.updated'
  | 'contractor_compliance.updated'
  | 'contractor_invoice.submitted'
  | 'bulk_sync';

export type ExpensesEventType =
  | 'expense.created'
  | 'expense.updated'
  | 'receipt.scanned'
  | 'mileage.logged'
  | 'expense_report.submitted'
  | 'bulk_sync';

export type SyncEventType = SiteSenseEventType | ExpensesEventType;

export type SyncObjectType =
  | 'job'
  | 'timecard'
  | 'cost_code'
  | 'change_order'
  | 'sov_line'
  | 'equipment'
  | 'contractor'
  | 'contractor_compliance'
  | 'contractor_invoice'
  | 'expense'
  | 'receipt'
  | 'mileage'
  | 'expense_report';

export type SyncEventStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'skipped';
export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';
export type ConflictStatus = 'open' | 'resolved_local' | 'resolved_remote' | 'dismissed';
export type ComplianceStatus = 'compliant' | 'expiring' | 'expired' | 'missing';

// ============================================
// WEBHOOK PAYLOAD SHAPES
// ============================================

export interface SyncWebhookPayload {
  event_type: SyncEventType;
  object_type: SyncObjectType;
  external_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface BulkSyncPayload {
  event_type: 'bulk_sync';
  object_type: 'bulk_sync';
  items: SyncWebhookPayload[];
}

// ============================================
// SITESENSE DATA SHAPES
// ============================================

export interface SiteSenseJob {
  id: string;
  name: string;
  number?: string;
  status: string;
  client_name?: string;
  client_id?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  contract_amount?: number;
  estimated_cost?: number;
  start_date?: string;
  end_date?: string;
  project_manager?: string;
  description?: string;
  updated_at?: string;
}

export interface SiteSenseTimecard {
  id: string;
  job_id: string;
  employee_name: string;
  employee_id?: string;
  work_date: string;
  hours_regular: number;
  hours_overtime: number;
  rate_regular?: number;
  rate_overtime?: number;
  cost_code?: string;
  cost_code_id?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  updated_at?: string;
}

export interface SiteSenseCostCode {
  id: string;
  code: string;
  description: string;
  division?: string;
  is_default?: boolean;
  updated_at?: string;
}

export interface SiteSenseChangeOrder {
  id: string;
  job_id: string;
  co_number: string;
  description: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  revenue_impact: number;
  cost_impact: number;
  schedule_days_impact?: number;
  approved_date?: string;
  updated_at?: string;
}

export interface SiteSenseSOVLine {
  id: string;
  job_id: string;
  line_number: number;
  description: string;
  scheduled_value: number;
  work_completed_previous?: number;
  work_completed_this_period?: number;
  materials_stored?: number;
  percent_complete?: number;
  retainage_pct?: number;
  cost_code_id?: string;
  updated_at?: string;
}

export interface SiteSenseEquipment {
  id: string;
  job_id: string;
  equipment_name: string;
  equipment_type?: string;
  hours_used: number;
  rate_per_hour?: number;
  log_date: string;
  operator_name?: string;
  cost_code_id?: string;
  notes?: string;
  updated_at?: string;
}

export interface SiteSenseContractor {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  tax_id?: string;
  payment_terms?: string;
  contractor_type?: 'contractor' | 'subcontractor';
  updated_at?: string;
}

export interface SiteSenseContractorCompliance {
  id: string;
  contractor_id: string;
  w9_on_file: boolean;
  w9_received_date?: string;
  tax_classification?: string;
  insurance_gl_carrier?: string;
  insurance_gl_policy?: string;
  insurance_gl_expiry?: string;
  insurance_gl_amount?: number;
  insurance_wc_carrier?: string;
  insurance_wc_policy?: string;
  insurance_wc_expiry?: string;
  insurance_wc_amount?: number;
  insurance_auto_carrier?: string;
  insurance_auto_policy?: string;
  insurance_auto_expiry?: string;
  insurance_auto_amount?: number;
  insurance_umbrella_carrier?: string;
  insurance_umbrella_policy?: string;
  insurance_umbrella_expiry?: string;
  insurance_umbrella_amount?: number;
  license_number?: string;
  license_state?: string;
  license_type?: string;
  license_expiry?: string;
  safety_cert_type?: string;
  safety_cert_expiry?: string;
  osha_number?: string;
  emr_rate?: number;
  updated_at?: string;
}

export interface SiteSenseContractorInvoice {
  id: string;
  contractor_id: string;
  job_id: string;
  invoice_number: string;
  amount: number;
  description?: string;
  cost_code_id?: string;
  date: string;
  due_date?: string;
  updated_at?: string;
}

// ============================================
// EXPENSES MADE EASY DATA SHAPES
// ============================================

export interface ExpenseRecord {
  id: string;
  amount: number;
  description: string;
  category_name?: string;
  vendor?: string;
  date: string;
  receipt_url?: string;
  tax_amount?: number;
  is_reimbursable?: boolean;
  job_id?: string;
  entity_id?: string;
  updated_at?: string;
}

export interface MileageRecord {
  id: string;
  distance: number;
  purpose?: string;
  start_location?: string;
  end_location?: string;
  date: string;
  job_id?: string;
  updated_at?: string;
}

export interface ExpenseReport {
  id: string;
  title: string;
  employee_name: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  total_amount: number;
  expense_ids: string[];
  submitted_date?: string;
  approved_date?: string;
  updated_at?: string;
}

// ============================================
// SYNC ENGINE TYPES
// ============================================

export interface SyncConnection {
  id: string;
  user_id: string;
  entity_id: string | null;
  source: SyncSource;
  display_name: string;
  endpoint_url: string | null;
  webhook_secret_encrypted: string | null;
  api_key_encrypted: string | null;
  is_active: number;
  auto_sync: number;
  last_pull_at: string | null;
  last_push_at: string | null;
  last_error: string | null;
  pull_interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface SyncEvent {
  id: string;
  connection_id: string;
  event_type: string;
  object_type: string;
  external_id: string | null;
  payload: string;
  status: SyncEventStatus;
  error_message: string | null;
  processed_at: string | null;
  retry_count: number;
  created_at: string;
}

export interface SyncLogEntry {
  id: string;
  connection_id: string;
  object_type: string;
  external_id: string;
  local_id: string;
  local_table: string;
  sync_direction: SyncDirection;
  last_synced_at: string;
  source_checksum: string | null;
  local_checksum: string | null;
  sync_count: number;
  last_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncConflict {
  id: string;
  connection_id: string;
  sync_log_id: string;
  object_type: string;
  external_id: string;
  local_id: string;
  field_name: string;
  local_value: string | null;
  remote_value: string | null;
  local_updated_at: string | null;
  remote_updated_at: string | null;
  status: ConflictStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// ============================================
// PROTECTED FIELDS — per object type
// SiteSense wins for operational, Books wins for financial
// ============================================

export const PROTECTED_FIELDS: Record<string, { sitesense_wins: string[]; books_wins: string[] }> = {
  job: {
    sitesense_wins: ['status', 'start_date', 'end_date', 'project_manager', 'address', 'city', 'state', 'zip'],
    books_wins: ['contract_amount', 'estimated_cost', 'retainage_percent'],
  },
  timecard: {
    sitesense_wins: ['hours_regular', 'hours_overtime', 'work_date', 'employee_name', 'status', 'approved_by'],
    books_wins: ['rate_regular', 'rate_overtime', 'total_cost', 'bill_id'],
  },
  change_order: {
    sitesense_wins: ['status', 'description', 'approved_date', 'schedule_days_impact'],
    books_wins: ['revenue_impact', 'cost_impact'],
  },
  sov_line: {
    sitesense_wins: ['percent_complete', 'work_completed_this_period', 'materials_stored'],
    books_wins: ['scheduled_value', 'retainage_pct'],
  },
  equipment: {
    sitesense_wins: ['hours_used', 'operator_name', 'log_date', 'notes'],
    books_wins: ['rate_per_hour', 'total_cost', 'bill_id'],
  },
  contractor: {
    sitesense_wins: ['name', 'company_name', 'email', 'phone', 'address', 'city', 'state', 'zip'],
    books_wins: ['balance', 'is_1099_eligible', 'default_cost_code_id'],
  },
  contractor_compliance: {
    sitesense_wins: [
      'w9_on_file', 'w9_received_date', 'tax_classification',
      'insurance_gl_carrier', 'insurance_gl_policy', 'insurance_gl_expiry', 'insurance_gl_amount',
      'insurance_wc_carrier', 'insurance_wc_policy', 'insurance_wc_expiry', 'insurance_wc_amount',
      'insurance_auto_carrier', 'insurance_auto_policy', 'insurance_auto_expiry', 'insurance_auto_amount',
      'insurance_umbrella_carrier', 'insurance_umbrella_policy', 'insurance_umbrella_expiry', 'insurance_umbrella_amount',
      'license_number', 'license_state', 'license_type', 'license_expiry',
      'safety_cert_type', 'safety_cert_expiry', 'osha_number', 'emr_rate',
    ],
    books_wins: ['notes'],
  },
};

// ============================================
// OBJECT TYPE → LOCAL TABLE MAPPING
// ============================================

export const OBJECT_TABLE_MAP: Record<SyncObjectType, string> = {
  job: 'jobs',
  timecard: 'timecards',
  cost_code: 'cost_codes',
  change_order: 'change_orders',
  sov_line: 'sov_lines',
  equipment: 'equipment_log',
  contractor: 'vendors',
  contractor_compliance: 'contractor_compliance',
  contractor_invoice: 'bills',
  expense: 'bills',
  receipt: 'bills',
  mileage: 'bills',
  expense_report: 'bills',
};

// ============================================
// PURE FUNCTIONS
// ============================================

/**
 * Verify HMAC-SHA256 webhook signature
 * IMPORTANT: rawBody must be the raw request text (before JSON.parse)
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

/**
 * Compute SHA-256 checksum of canonical JSON (sorted keys)
 */
export function computeChecksum(data: Record<string, unknown>): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Detect conflicts between local and remote data for protected fields.
 * Returns array of field-level conflicts where both sides changed and neither wins automatically.
 */
export function detectConflicts(
  objectType: string,
  localData: Record<string, unknown>,
  remoteData: Record<string, unknown>,
  localUpdatedAt?: string,
  remoteUpdatedAt?: string
): { field: string; localValue: unknown; remoteValue: unknown; winner: 'local' | 'remote' | 'conflict' }[] {
  const rules = PROTECTED_FIELDS[objectType];
  if (!rules) return [];

  const results: { field: string; localValue: unknown; remoteValue: unknown; winner: 'local' | 'remote' | 'conflict' }[] = [];

  const allFields = new Set([...Object.keys(localData), ...Object.keys(remoteData)]);

  for (const field of allFields) {
    const localVal = localData[field];
    const remoteVal = remoteData[field];

    // Skip if values are the same
    if (JSON.stringify(localVal) === JSON.stringify(remoteVal)) continue;

    // Only one side has a value — no conflict
    if (localVal === undefined || localVal === null) {
      results.push({ field, localValue: localVal, remoteValue: remoteVal, winner: 'remote' });
      continue;
    }
    if (remoteVal === undefined || remoteVal === null) {
      results.push({ field, localValue: localVal, remoteValue: remoteVal, winner: 'local' });
      continue;
    }

    // Both sides have different values — check protected field rules
    if (rules.sitesense_wins.includes(field)) {
      results.push({ field, localValue: localVal, remoteValue: remoteVal, winner: 'remote' });
    } else if (rules.books_wins.includes(field)) {
      results.push({ field, localValue: localVal, remoteValue: remoteVal, winner: 'local' });
    } else {
      // Field not in either list — flag as conflict for manual resolution
      results.push({ field, localValue: localVal, remoteValue: remoteVal, winner: 'conflict' });
    }
  }

  return results;
}

// ============================================
// FIELD MAPPING FUNCTIONS
// SiteSense payloads → Books Made Easy table columns
// ============================================

export function mapSiteSenseJob(data: SiteSenseJob, userId: string, entityId?: string): Record<string, unknown> {
  return {
    user_id: userId,
    entity_id: entityId || null,
    name: data.name,
    number: data.number || null,
    status: data.status || 'active',
    customer_name: data.client_name || null,
    address: data.address || null,
    city: data.city || null,
    state: data.state || null,
    zip: data.zip || null,
    contract_amount: data.contract_amount || 0,
    estimated_cost: data.estimated_cost || 0,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    description: data.description || null,
  };
}

export function mapSiteSenseTimecard(data: SiteSenseTimecard, userId: string, entityId?: string): Record<string, unknown> {
  const hoursTotal = (data.hours_regular || 0) + (data.hours_overtime || 0);
  const rateRegular = data.rate_regular || 0;
  const rateOvertime = data.rate_overtime || rateRegular * 1.5;
  const totalCost = (data.hours_regular || 0) * rateRegular + (data.hours_overtime || 0) * rateOvertime;

  return {
    user_id: userId,
    entity_id: entityId || null,
    job_id: data.job_id,
    employee_name: data.employee_name,
    employee_id: data.employee_id || null,
    work_date: data.work_date,
    hours_regular: data.hours_regular || 0,
    hours_overtime: data.hours_overtime || 0,
    hours_total: hoursTotal,
    rate_regular: rateRegular,
    rate_overtime: rateOvertime,
    total_cost: totalCost,
    status: data.status || 'pending',
    cost_code_id: data.cost_code_id || null,
    approved_by: data.approved_by || null,
    notes: data.notes || null,
  };
}

export function mapSiteSenseSOVLine(data: SiteSenseSOVLine, userId: string, entityId?: string): Record<string, unknown> {
  const balanceToFinish = data.scheduled_value -
    (data.work_completed_previous || 0) -
    (data.work_completed_this_period || 0) -
    (data.materials_stored || 0);

  return {
    user_id: userId,
    entity_id: entityId || null,
    job_id: data.job_id,
    line_number: data.line_number,
    description: data.description,
    scheduled_value: data.scheduled_value,
    work_completed_previous: data.work_completed_previous || 0,
    work_completed_this_period: data.work_completed_this_period || 0,
    materials_stored: data.materials_stored || 0,
    percent_complete: data.percent_complete || 0,
    balance_to_finish: balanceToFinish,
    retainage_pct: data.retainage_pct ?? 10,
    cost_code_id: data.cost_code_id || null,
  };
}

export function mapSiteSenseEquipment(data: SiteSenseEquipment, userId: string, entityId?: string): Record<string, unknown> {
  const totalCost = (data.hours_used || 0) * (data.rate_per_hour || 0);

  return {
    user_id: userId,
    entity_id: entityId || null,
    job_id: data.job_id,
    equipment_name: data.equipment_name,
    equipment_type: data.equipment_type || null,
    hours_used: data.hours_used || 0,
    rate_per_hour: data.rate_per_hour || 0,
    total_cost: totalCost,
    log_date: data.log_date,
    operator_name: data.operator_name || null,
    notes: data.notes || null,
    cost_code_id: data.cost_code_id || null,
  };
}

export function mapSiteSenseContractor(data: SiteSenseContractor, userId: string, entityId?: string): Record<string, unknown> {
  return {
    user_id: userId,
    entity_id: entityId || null,
    name: data.name || data.company_name || 'Unknown Contractor',
    email: data.email || null,
    phone: data.phone || null,
    company: data.company_name || null,
    address: data.address || null,
    city: data.city || null,
    state: data.state || null,
    zip: data.zip || null,
    tax_id: data.tax_id || null,
    vendor_type: data.contractor_type || 'contractor',
    is_1099_eligible: 1,
    notes: `Synced from SiteSense. Payment terms: ${data.payment_terms || 'Net 30'}`,
  };
}

export function mapSiteSenseContractorCompliance(
  data: SiteSenseContractorCompliance,
  userId: string,
  entityId?: string
): Record<string, unknown> {
  return {
    user_id: userId,
    entity_id: entityId || null,
    w9_on_file: data.w9_on_file ? 1 : 0,
    w9_received_date: data.w9_received_date || null,
    tax_classification: data.tax_classification || null,
    insurance_gl_carrier: data.insurance_gl_carrier || null,
    insurance_gl_policy: data.insurance_gl_policy || null,
    insurance_gl_expiry: data.insurance_gl_expiry || null,
    insurance_gl_amount: data.insurance_gl_amount || null,
    insurance_wc_carrier: data.insurance_wc_carrier || null,
    insurance_wc_policy: data.insurance_wc_policy || null,
    insurance_wc_expiry: data.insurance_wc_expiry || null,
    insurance_wc_amount: data.insurance_wc_amount || null,
    insurance_auto_carrier: data.insurance_auto_carrier || null,
    insurance_auto_policy: data.insurance_auto_policy || null,
    insurance_auto_expiry: data.insurance_auto_expiry || null,
    insurance_auto_amount: data.insurance_auto_amount || null,
    insurance_umbrella_carrier: data.insurance_umbrella_carrier || null,
    insurance_umbrella_policy: data.insurance_umbrella_policy || null,
    insurance_umbrella_expiry: data.insurance_umbrella_expiry || null,
    insurance_umbrella_amount: data.insurance_umbrella_amount || null,
    license_number: data.license_number || null,
    license_state: data.license_state || null,
    license_type: data.license_type || null,
    license_expiry: data.license_expiry || null,
    safety_cert_type: data.safety_cert_type || null,
    safety_cert_expiry: data.safety_cert_expiry || null,
    osha_number: data.osha_number || null,
    emr_rate: data.emr_rate || null,
    compliance_status: computeComplianceStatus(data),
    last_synced_at: new Date().toISOString(),
  };
}

export function mapSiteSenseContractorInvoice(
  data: SiteSenseContractorInvoice,
  userId: string,
  entityId?: string
): Record<string, unknown> {
  return {
    user_id: userId,
    entity_id: entityId || null,
    external_id: `sitesense:contractor_invoice:${data.id}`,
    external_source: 'sitesense',
    bill_number: data.invoice_number || `CINV-${data.id.slice(0, 8)}`,
    bill_date: data.date,
    due_date: data.due_date || data.date,
    job_id: data.job_id || null,
    cost_code_id: data.cost_code_id || null,
    category: 'Subcontractor',
    description: data.description || 'Contractor invoice from SiteSense',
    subtotal: data.amount,
    total: data.amount,
    status: 'unpaid',
  };
}

export function mapExpense(data: ExpenseRecord, userId: string, entityId?: string): Record<string, unknown> {
  return {
    user_id: userId,
    entity_id: entityId || null,
    external_id: `expenses:${data.id}`,
    external_source: 'expenses_made_easy',
    bill_number: `EXP-${data.id.slice(0, 8)}`,
    bill_date: data.date,
    due_date: data.date,
    category: data.category_name || 'Uncategorized',
    description: data.description,
    subtotal: data.amount,
    tax_amount: data.tax_amount || 0,
    total: data.amount,
    amount_paid: data.amount,
    status: 'paid',
    job_id: data.job_id || null,
    notes: `Synced from Expenses Made Easy. Vendor: ${data.vendor || 'N/A'}`,
  };
}

export function mapMileage(data: MileageRecord, userId: string, entityId?: string): Record<string, unknown> {
  const IRS_RATE = 0.70; // 2026 IRS rate
  const deduction = data.distance * IRS_RATE;

  return {
    user_id: userId,
    entity_id: entityId || null,
    external_id: `mileage:${data.id}`,
    external_source: 'expenses_made_easy',
    bill_number: `MIL-${data.id.slice(0, 8)}`,
    bill_date: data.date,
    due_date: data.date,
    category: 'Vehicle Expense',
    description: `Mileage: ${data.distance.toFixed(1)} miles @ $${IRS_RATE}/mile - ${data.purpose || 'Business'}`,
    subtotal: deduction,
    total: deduction,
    amount_paid: deduction,
    status: 'paid',
    job_id: data.job_id || null,
    notes: `Route: ${data.start_location || 'N/A'} to ${data.end_location || 'N/A'}`,
  };
}

// ============================================
// COMPLIANCE STATUS COMPUTATION
// ============================================

/**
 * Compute compliance status from compliance data fields.
 * - missing: no W-9 and no insurance on file
 * - expired: any required doc past expiry
 * - expiring: any required doc expiring within 30 days
 * - compliant: everything current
 */
export function computeComplianceStatus(data: SiteSenseContractorCompliance): ComplianceStatus {
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Missing: no W-9 and no GL insurance
  if (!data.w9_on_file && !data.insurance_gl_expiry) {
    return 'missing';
  }

  const expiryDates = [
    data.insurance_gl_expiry,
    data.insurance_wc_expiry,
    data.insurance_auto_expiry,
    data.insurance_umbrella_expiry,
    data.license_expiry,
    data.safety_cert_expiry,
  ].filter(Boolean) as string[];

  // Check for expired
  for (const dateStr of expiryDates) {
    if (new Date(dateStr) < now) return 'expired';
  }

  // Check for expiring soon
  for (const dateStr of expiryDates) {
    if (new Date(dateStr) < thirtyDays) return 'expiring';
  }

  return 'compliant';
}

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}
