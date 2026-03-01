import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';
import { execSql } from '@/lib/turso';
import { clearDemoData, getAccountIdMap, getCategoryIdMap } from './seedHelpers';
import {
  getCompanySettings, getDefaultAccounts, getCategories,
  getCustomers, getVendors, getProductsServices,
  getJobs, getJobPhases, getEstimates, getEstimateItems,
  getInvoices, getInvoiceItems, getBills, getBillItems,
  getPayments, getPaymentsReceived, getPaymentsMade,
  getBankAccounts, getDeposits, getDepositItems, getReconciliations, getBankTransactions,
  getExpenses, getJournalEntries, getJournalEntryLines,
  getCustomerNotes, getCustomerTodos,
  getReminderSettings, getLateFeeSettings, getInvoiceReminders, getInvoiceLateFees,
  getMerchantRules, getItemCategoryRules, getRecurringExpenses,
  getDetectedSubscriptions, getSubscriptionPriceHistory,
  getBudgets, getMileage, getCustomReports,
} from './seedData';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ids(rows: any[]): string[] {
  return rows.map(r => String(r.id));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = body.user_id;
    const action = body.action || 'seed';

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // ── CLEAR ACTION ──────────────────────────────────────────
    if (action === 'clear') {
      const result = await clearDemoData(userId);
      return NextResponse.json({ success: true, ...result });
    }

    // ── FRESH: clear first, then seed ─────────────────────────
    if (body.fresh) {
      await clearDemoData(userId);
    }

    const seeded: Record<string, number> = {};

    // ══════════════════════════════════════════════════════════
    // PHASE 1 — Foundation
    // ══════════════════════════════════════════════════════════

    // Company Settings (upsert)
    await supabaseAdmin.from('company_settings')
      .upsert(getCompanySettings(userId), { onConflict: 'user_id' });
    seeded.company_settings = 1;

    // Chart of Accounts (upsert to avoid duplicates on re-run)
    const accounts = getDefaultAccounts(userId);
    for (const acct of accounts) {
      await supabaseAdmin.from('accounts')
        .upsert(acct, { onConflict: 'code' });
    }
    seeded.accounts = accounts.length;

    // Categories (check if exist first)
    const existingCats = await execSql(
      'SELECT COUNT(*) as cnt FROM "categories" WHERE "user_id" = ?', [userId],
    );
    if (!existingCats[0]?.cnt || Number(existingCats[0].cnt) === 0) {
      await supabaseAdmin.from('categories').insert(getCategories(userId));
    }
    seeded.categories = getCategories(userId).length;

    // Load lookup maps for FK references
    const acctMap = await getAccountIdMap(userId);
    const catMap = await getCategoryIdMap(userId);

    // ══════════════════════════════════════════════════════════
    // PHASE 2 — Entities
    // ══════════════════════════════════════════════════════════

    const { data: customerRows } = await supabaseAdmin.from('customers')
      .insert(getCustomers(userId)).select('*');
    const customerIds = ids(customerRows || []);
    seeded.customers = customerIds.length;

    const { data: vendorRows } = await supabaseAdmin.from('vendors')
      .insert(getVendors(userId)).select('*');
    const vendorIds = ids(vendorRows || []);
    seeded.vendors = vendorIds.length;

    const { data: productRows } = await supabaseAdmin.from('products_services')
      .insert(getProductsServices(userId, catMap, acctMap)).select('*');
    seeded.products_services = (productRows || []).length;

    // ══════════════════════════════════════════════════════════
    // PHASE 3 — Jobs & Estimates
    // ══════════════════════════════════════════════════════════

    const { data: jobRows } = await supabaseAdmin.from('jobs')
      .insert(getJobs(userId, customerIds)).select('*');
    const jobIds = ids(jobRows || []);
    seeded.jobs = jobIds.length;

    await supabaseAdmin.from('job_phases').insert(getJobPhases(jobIds));
    seeded.job_phases = getJobPhases(jobIds).length;

    const { data: estimateRows } = await supabaseAdmin.from('estimates')
      .insert(getEstimates(userId, customerIds)).select('*');
    const estimateIds = ids(estimateRows || []);
    seeded.estimates = estimateIds.length;

    await supabaseAdmin.from('estimate_items').insert(getEstimateItems(estimateIds));
    seeded.estimate_items = getEstimateItems(estimateIds).length;

    // ══════════════════════════════════════════════════════════
    // PHASE 4 — Invoices & Bills
    // ══════════════════════════════════════════════════════════

    const { data: invoiceRows } = await supabaseAdmin.from('invoices')
      .insert(getInvoices(userId, customerIds, jobIds, estimateIds)).select('*');
    const invoiceIds = ids(invoiceRows || []);
    seeded.invoices = invoiceIds.length;

    await supabaseAdmin.from('invoice_items').insert(getInvoiceItems(invoiceIds, acctMap));
    seeded.invoice_items = getInvoiceItems(invoiceIds, acctMap).length;

    // Link converted estimate to its invoice
    if (estimateIds[3] && invoiceIds[1]) {
      await execSql(
        'UPDATE "estimates" SET "converted_invoice_id" = ? WHERE "id" = ?',
        [invoiceIds[1], estimateIds[3]],
      );
    }

    const { data: billRows } = await supabaseAdmin.from('bills')
      .insert(getBills(userId, vendorIds, catMap)).select('*');
    const billIds = ids(billRows || []);
    seeded.bills = billIds.length;

    await supabaseAdmin.from('bill_items').insert(getBillItems(billIds, catMap, acctMap));
    seeded.bill_items = getBillItems(billIds, catMap, acctMap).length;

    // ══════════════════════════════════════════════════════════
    // PHASE 5 — Payments
    // ══════════════════════════════════════════════════════════

    await supabaseAdmin.from('payments')
      .insert(getPayments(userId, invoiceIds, billIds));
    seeded.payments = getPayments(userId, invoiceIds, billIds).length;

    const { data: prRows } = await supabaseAdmin.from('payments_received')
      .insert(getPaymentsReceived(userId, invoiceIds, customerIds)).select('*');
    const prIds = ids(prRows || []);
    seeded.payments_received = prIds.length;

    await supabaseAdmin.from('payments_made')
      .insert(getPaymentsMade(userId, billIds, vendorIds));
    seeded.payments_made = getPaymentsMade(userId, billIds, vendorIds).length;

    // ══════════════════════════════════════════════════════════
    // PHASE 6 — Banking
    // ══════════════════════════════════════════════════════════

    const { data: baRows } = await supabaseAdmin.from('bank_accounts')
      .insert(getBankAccounts(userId, acctMap)).select('*');
    const bankAccountIds = ids(baRows || []);
    seeded.bank_accounts = bankAccountIds.length;

    const { data: depRows } = await supabaseAdmin.from('deposits')
      .insert(getDeposits(userId, bankAccountIds)).select('*');
    const depositIds = ids(depRows || []);
    seeded.deposits = depositIds.length;

    await supabaseAdmin.from('deposit_items')
      .insert(getDepositItems(depositIds, prIds));
    seeded.deposit_items = getDepositItems(depositIds, prIds).length;

    // Link payments_received to deposits
    if (prIds[0] && depositIds[0]) {
      await execSql('UPDATE "payments_received" SET "deposit_id" = ? WHERE "id" = ?', [depositIds[0], prIds[0]]);
    }
    if (prIds[1] && depositIds[0]) {
      await execSql('UPDATE "payments_received" SET "deposit_id" = ? WHERE "id" = ?', [depositIds[0], prIds[1]]);
    }
    if (prIds[2] && depositIds[1]) {
      await execSql('UPDATE "payments_received" SET "deposit_id" = ? WHERE "id" = ?', [depositIds[1], prIds[2]]);
    }

    const { data: reconRows } = await supabaseAdmin.from('reconciliations')
      .insert(getReconciliations(userId, bankAccountIds)).select('*');
    const reconIds = ids(reconRows || []);
    seeded.reconciliations = reconIds.length;

    // Update bank_account last_reconciled for the completed reconciliation
    if (bankAccountIds[0] && reconRows && reconRows[0]) {
      await execSql(
        'UPDATE "bank_accounts" SET "last_reconciled_date" = ?, "last_reconciled_balance" = ? WHERE "id" = ?',
        [String(reconRows[0].statement_date), reconRows[0].statement_balance, bankAccountIds[0]],
      );
    }

    const bankTxns = getBankTransactions(userId, bankAccountIds, reconIds, catMap);
    await supabaseAdmin.from('bank_transactions').insert(bankTxns);
    seeded.bank_transactions = bankTxns.length;

    // ══════════════════════════════════════════════════════════
    // PHASE 7 — Everything Else
    // ══════════════════════════════════════════════════════════

    await supabaseAdmin.from('expenses').insert(getExpenses(userId, catMap));
    seeded.expenses = getExpenses(userId, catMap).length;

    const { data: jeRows } = await supabaseAdmin.from('journal_entries')
      .insert(getJournalEntries(userId)).select('*');
    const jeIds = ids(jeRows || []);
    seeded.journal_entries = jeIds.length;

    await supabaseAdmin.from('journal_entry_lines')
      .insert(getJournalEntryLines(jeIds, acctMap));
    seeded.journal_entry_lines = getJournalEntryLines(jeIds, acctMap).length;

    await supabaseAdmin.from('customer_notes')
      .insert(getCustomerNotes(userId, customerIds));
    seeded.customer_notes = getCustomerNotes(userId, customerIds).length;

    await supabaseAdmin.from('customer_todos')
      .insert(getCustomerTodos(userId, customerIds));
    seeded.customer_todos = getCustomerTodos(userId, customerIds).length;

    await supabaseAdmin.from('reminder_settings')
      .upsert(getReminderSettings(userId), { onConflict: 'user_id' });
    seeded.reminder_settings = 1;

    await supabaseAdmin.from('late_fee_settings')
      .upsert(getLateFeeSettings(userId), { onConflict: 'user_id' });
    seeded.late_fee_settings = 1;

    await supabaseAdmin.from('invoice_reminders')
      .insert(getInvoiceReminders(userId, invoiceIds));
    seeded.invoice_reminders = getInvoiceReminders(userId, invoiceIds).length;

    // Late fees (also update invoice totals)
    const lateFees = getInvoiceLateFees(userId, invoiceIds);
    await supabaseAdmin.from('invoice_late_fees').insert(lateFees);
    seeded.invoice_late_fees = lateFees.length;

    // Update overdue invoice totals to reflect late fees
    for (const fee of lateFees) {
      await execSql(
        'UPDATE "invoices" SET "total" = ? WHERE "id" = ?',
        [fee.invoice_total_after, fee.invoice_id],
      );
    }

    await supabaseAdmin.from('merchant_rules')
      .insert(getMerchantRules(userId, catMap));
    seeded.merchant_rules = getMerchantRules(userId, catMap).length;

    await supabaseAdmin.from('item_category_rules')
      .insert(getItemCategoryRules(userId, catMap));
    seeded.item_category_rules = getItemCategoryRules(userId, catMap).length;

    await supabaseAdmin.from('recurring_expenses')
      .insert(getRecurringExpenses(userId, catMap));
    seeded.recurring_expenses = getRecurringExpenses(userId, catMap).length;

    const { data: subRows } = await supabaseAdmin.from('detected_subscriptions')
      .insert(getDetectedSubscriptions(userId, catMap)).select('*');
    const subIds = ids(subRows || []);
    seeded.detected_subscriptions = subIds.length;

    await supabaseAdmin.from('subscription_price_history')
      .insert(getSubscriptionPriceHistory(userId, subIds));
    seeded.subscription_price_history = getSubscriptionPriceHistory(userId, subIds).length;

    await supabaseAdmin.from('budgets').insert(getBudgets(userId, catMap));
    seeded.budgets = getBudgets(userId, catMap).length;

    await supabaseAdmin.from('mileage').insert(getMileage(userId));
    seeded.mileage = getMileage(userId).length;

    await supabaseAdmin.from('custom_reports').insert(getCustomReports(userId));
    seeded.custom_reports = getCustomReports(userId).length;

    // ══════════════════════════════════════════════════════════
    // PHASE 8 — Balance Reconciliation
    // ══════════════════════════════════════════════════════════

    // Customer balances = SUM of outstanding (sent + overdue) invoice totals
    const custBalances: Record<string, number> = {};
    const allInvoices = getInvoices(userId, customerIds, jobIds, estimateIds);
    for (let i = 0; i < allInvoices.length; i++) {
      const inv = allInvoices[i];
      if (inv.status === 'sent' || inv.status === 'overdue') {
        const custId = inv.customer_id;
        // Use the potentially updated total (after late fees)
        const lf = lateFees.find(f => f.invoice_id === invoiceIds[i]);
        const total = lf ? lf.invoice_total_after : inv.total;
        custBalances[custId] = (custBalances[custId] || 0) + total;
      }
    }
    for (const [custId, balance] of Object.entries(custBalances)) {
      await execSql('UPDATE "customers" SET "balance" = ? WHERE "id" = ?', [balance, custId]);
    }

    // Vendor balances = SUM of outstanding (unpaid + overdue) bill totals
    const vendBalances: Record<string, number> = {};
    const allBills = getBills(userId, vendorIds, catMap);
    for (const bill of allBills) {
      if (bill.status === 'unpaid' || bill.status === 'overdue') {
        const vid = bill.vendor_id;
        vendBalances[vid] = (vendBalances[vid] || 0) + bill.total;
      }
    }
    for (const [vid, balance] of Object.entries(vendBalances)) {
      await execSql('UPDATE "vendors" SET "balance" = ? WHERE "id" = ?', [balance, vid]);
    }

    return NextResponse.json({
      success: true,
      message: 'Demo data seeded successfully — all 38 tables populated',
      seeded,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Seed error:', error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to seed or clear demo data',
    actions: {
      seed: 'POST { "user_id": "...", "action": "seed" } — Seeds all tables with demo data',
      clear: 'POST { "user_id": "...", "action": "clear" } — Deletes all data for the user',
      fresh: 'POST { "user_id": "...", "action": "seed", "fresh": true } — Clears then seeds',
    },
    tables: '38 tables covered across 8 phases',
  });
}
