import { execSql } from '@/lib/turso';

// ── Date Helpers ──────────────────────────────────────────────

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export function isoNow(): string {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

export function isoAt(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().replace('T', ' ').split('.')[0];
}

// ── Clear All Demo Data ───────────────────────────────────────

// Tables with user_id, in reverse dependency order.
// Child tables without user_id (invoice_items, bill_items, etc.)
// cascade-delete from their parents.
const CLEAR_ORDER = [
  'subscription_price_history',
  'detected_subscriptions',
  'invoice_late_fees',
  'invoice_reminders',
  'late_fee_settings',
  'reminder_settings',
  'customer_todos',
  'customer_notes',
  'journal_entries',       // CASCADE → journal_entry_lines
  'bank_transactions',
  'reconciliations',
  'deposits',              // CASCADE → deposit_items
  'bank_accounts',
  'recurring_expenses',
  'item_category_rules',
  'merchant_rules',
  'budgets',
  'mileage',
  'custom_reports',
  'expenses',
  'payments',
  'payments_made',
  'payments_received',
  'bills',                 // CASCADE → bill_items
  'invoices',              // CASCADE → invoice_items
  'estimates',             // CASCADE → estimate_items
  'jobs',                  // CASCADE → job_phases
  'products_services',
  'vendors',
  'customers',
  'categories',
  'accounts',
  'company_settings',
];

export async function clearDemoData(userId: string): Promise<{ tablesCleared: string[] }> {
  const cleared: string[] = [];

  for (const table of CLEAR_ORDER) {
    try {
      await execSql(`DELETE FROM "${table}" WHERE "user_id" = ?`, [userId]);
      cleared.push(table);
    } catch {
      // Table may not exist or may not have user_id — skip
    }
  }

  return { tablesCleared: cleared };
}

// ── Lookup Helpers ────────────────────────────────────────────

export async function findAccountIdByCode(userId: string, code: string): Promise<string | null> {
  const rows = await execSql(
    'SELECT "id" FROM "accounts" WHERE "user_id" = ? AND "code" = ? LIMIT 1',
    [userId, code],
  );
  return rows.length > 0 ? String(rows[0].id) : null;
}

export async function findCategoryIdByName(userId: string, name: string): Promise<string | null> {
  const rows = await execSql(
    'SELECT "id" FROM "categories" WHERE "user_id" = ? AND "name" = ? LIMIT 1',
    [userId, name],
  );
  return rows.length > 0 ? String(rows[0].id) : null;
}

export async function getAccountIdMap(userId: string): Promise<Record<string, string>> {
  const rows = await execSql(
    'SELECT "id", "code" FROM "accounts" WHERE "user_id" = ?',
    [userId],
  );
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[String(r.code)] = String(r.id);
  }
  return map;
}

export async function getCategoryIdMap(userId: string): Promise<Record<string, string>> {
  const rows = await execSql(
    'SELECT "id", "name" FROM "categories" WHERE "user_id" = ?',
    [userId],
  );
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[String(r.name)] = String(r.id);
  }
  return map;
}
