import { daysAgo, daysFromNow } from './seedHelpers';
import { normalBalanceByType, getAccountHelpText } from '@/data/accountHelp';

// ════════════════════════════════════════════════════════════════
// Phase 1 — Foundation
// ════════════════════════════════════════════════════════════════

export function getCompanySettings(userId: string) {
  return {
    user_id: userId,
    company_name: 'Cascade Consulting Group',
    email: 'info@cascadeconsulting.com',
    phone: '(303) 555-0100',
    address: '1200 17th Street, Suite 400',
    city: 'Denver',
    state: 'CO',
    zip: '80202',
    country: 'United States',
    tax_id: '84-1234567',
    fiscal_year_start: 'january',
    currency: 'USD',
    date_format: 'MM/DD/YYYY',
    industry_id: 'consulting',
  };
}

export function getDefaultAccounts(userId: string) {
  const raw = [
    { user_id: userId, code: '1000', name: 'Cash on Hand', type: 'asset', subtype: 'Cash' },
    { user_id: userId, code: '1010', name: 'Business Checking', type: 'asset', subtype: 'Bank' },
    { user_id: userId, code: '1020', name: 'Business Savings', type: 'asset', subtype: 'Bank' },
    { user_id: userId, code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'Accounts Receivable' },
    { user_id: userId, code: '1200', name: 'Inventory', type: 'asset', subtype: 'Inventory' },
    { user_id: userId, code: '1500', name: 'Equipment', type: 'asset', subtype: 'Fixed Assets' },
    { user_id: userId, code: '1510', name: 'Accumulated Depreciation', type: 'asset', subtype: 'Fixed Assets' },
    { user_id: userId, code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'Accounts Payable' },
    { user_id: userId, code: '2100', name: 'Credit Card', type: 'liability', subtype: 'Credit Card' },
    { user_id: userId, code: '2200', name: 'Sales Tax Payable', type: 'liability', subtype: 'Other Current Liabilities' },
    { user_id: userId, code: '2500', name: 'Loans Payable', type: 'liability', subtype: 'Loans' },
    { user_id: userId, code: '3000', name: "Owner's Equity", type: 'equity', subtype: 'Owner Equity' },
    { user_id: userId, code: '3100', name: 'Retained Earnings', type: 'equity', subtype: 'Retained Earnings' },
    { user_id: userId, code: '3200', name: "Owner's Draw", type: 'equity', subtype: 'Owner Equity' },
    { user_id: userId, code: '4000', name: 'Service Revenue', type: 'income', subtype: 'Service Revenue' },
    { user_id: userId, code: '4100', name: 'Product Sales', type: 'income', subtype: 'Sales' },
    { user_id: userId, code: '4900', name: 'Other Income', type: 'income', subtype: 'Other Income' },
    { user_id: userId, code: '5000', name: 'Cost of Goods Sold', type: 'expense', subtype: 'Cost of Goods Sold' },
    { user_id: userId, code: '6000', name: 'Advertising & Marketing', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '6100', name: 'Bank Charges & Fees', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '6200', name: 'Contract Labor', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '6300', name: 'Depreciation Expense', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '6400', name: 'Insurance', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '6500', name: 'Interest Expense', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '6600', name: 'Office Expenses', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '6700', name: 'Professional Services', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '6800', name: 'Rent Expense', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '6900', name: 'Repairs & Maintenance', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '7000', name: 'Supplies', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '7100', name: 'Travel & Meals', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '7200', name: 'Utilities', type: 'expense', subtype: 'Utilities' },
    { user_id: userId, code: '7300', name: 'Vehicle Expenses', type: 'expense', subtype: 'Operating Expenses' },
    { user_id: userId, code: '7400', name: 'Wages & Payroll', type: 'expense', subtype: 'Payroll' },
    { user_id: userId, code: '7500', name: 'Payroll Taxes', type: 'expense', subtype: 'Payroll' },
    { user_id: userId, code: '7900', name: 'Other Expenses', type: 'expense', subtype: 'Other Expenses' },
  ];
  return raw.map(acct => ({
    ...acct,
    normal_balance: normalBalanceByType[acct.type] || 'debit',
    help_text: getAccountHelpText(acct.subtype, acct.type),
  }));
}

export function getCategories(userId: string) {
  return [
    // Service / Income
    { user_id: userId, name: 'Consulting Services', type: 'service', tax_deductible: 0, irs_category: 'Gross Receipts', is_active: 1 },
    { user_id: userId, name: 'Advisory Services', type: 'service', tax_deductible: 0, irs_category: 'Gross Receipts', is_active: 1 },
    { user_id: userId, name: 'Project Management', type: 'service', tax_deductible: 0, irs_category: 'Gross Receipts', is_active: 1 },
    { user_id: userId, name: 'Training & Workshops', type: 'service', tax_deductible: 0, irs_category: 'Gross Receipts', is_active: 1 },
    { user_id: userId, name: 'Retainer Fees', type: 'service', tax_deductible: 0, irs_category: 'Gross Receipts', is_active: 1 },
    // Expenses
    { user_id: userId, name: 'Professional Development', type: 'expense', tax_deductible: 1, irs_category: 'Education', is_active: 1 },
    { user_id: userId, name: 'Software Subscriptions', type: 'expense', tax_deductible: 1, irs_category: 'Office Expense', is_active: 1 },
    { user_id: userId, name: 'Professional Memberships', type: 'expense', tax_deductible: 1, irs_category: 'Dues & Subscriptions', is_active: 1 },
    { user_id: userId, name: 'Client Entertainment', type: 'expense', tax_deductible: 1, irs_category: 'Meals & Entertainment', is_active: 1 },
    { user_id: userId, name: 'Travel - Client Visits', type: 'expense', tax_deductible: 1, irs_category: 'Travel', is_active: 1 },
    { user_id: userId, name: 'Office Supplies', type: 'expense', tax_deductible: 1, irs_category: 'Office Expense', is_active: 1 },
    { user_id: userId, name: 'Marketing & Advertising', type: 'expense', tax_deductible: 1, irs_category: 'Advertising', is_active: 1 },
    { user_id: userId, name: 'Insurance - Professional Liability', type: 'expense', tax_deductible: 1, irs_category: 'Insurance', is_active: 1 },
  ];
}

// ════════════════════════════════════════════════════════════════
// Phase 2 — Entities
// ════════════════════════════════════════════════════════════════

export function getCustomers(userId: string) {
  return [
    { user_id: userId, name: 'Sarah Mitchell', email: 'sarah@pinnaclehealth.com', phone: '(303) 555-1001', company: 'Pinnacle Health Systems', address: '4500 Cherry Creek Dr S', city: 'Denver', state: 'CO', zip: '80246', balance: 0, is_active: 1 },
    { user_id: userId, name: 'David Chen', email: 'david@techvista.io', phone: '(303) 555-1002', company: 'TechVista Solutions', address: '1600 Wynkoop St', city: 'Denver', state: 'CO', zip: '80202', balance: 0, is_active: 1 },
    { user_id: userId, name: 'Maria Garcia', email: 'maria@verdelandscaping.com', phone: '(720) 555-1003', company: 'Verde Landscaping LLC', address: '890 S Colorado Blvd', city: 'Denver', state: 'CO', zip: '80246', balance: 0, is_active: 1 },
    { user_id: userId, name: 'Robert Thompson', email: 'rthompson@thompsonlaw.com', phone: '(303) 555-1004', company: 'Thompson & Associates Law', address: '1801 California St, Suite 3200', city: 'Denver', state: 'CO', zip: '80202', balance: 0, is_active: 1 },
    { user_id: userId, name: 'Jennifer Walsh', email: 'jwalsh@brighthorizons.edu', phone: '(720) 555-1005', company: 'Bright Horizons Academy', address: '2300 S University Blvd', city: 'Denver', state: 'CO', zip: '80210', balance: 0, is_active: 1 },
    { user_id: userId, name: 'Marcus Johnson', email: 'mjohnson@apexmfg.com', phone: '(303) 555-1006', company: 'Apex Manufacturing', address: '7800 E Hampden Ave', city: 'Denver', state: 'CO', zip: '80231', balance: 0, is_active: 1 },
    { user_id: userId, name: 'Lisa Park', email: 'lisa@parkplaceprops.com', phone: '(720) 555-1007', company: 'Park Place Properties', address: '3333 Quebec St, Suite 5100', city: 'Denver', state: 'CO', zip: '80207', balance: 0, is_active: 1 },
  ];
}

export function getVendors(userId: string) {
  return [
    { user_id: userId, name: 'Colorado Office Supply', email: 'orders@coofficesupply.com', phone: '(303) 555-2001', company: 'Colorado Office Supply Inc', address: '1550 Wazee St', city: 'Denver', state: 'CO', zip: '80202', balance: 0, is_active: 1 },
    { user_id: userId, name: 'Xcel Energy', email: 'business@xcelenergy.com', phone: '(800) 895-4999', company: 'Xcel Energy', address: '1800 Larimer St', city: 'Denver', state: 'CO', zip: '80202', balance: 0, is_active: 1 },
    { user_id: userId, name: 'CloudStack Hosting', email: 'billing@cloudstack.io', phone: '(415) 555-2003', company: 'CloudStack Technologies LLC', address: '500 Sansome St', city: 'San Francisco', state: 'CA', zip: '94111', tax_id: '87-6543210', balance: 0, is_active: 1 },
    { user_id: userId, name: 'ProGraphics Design', email: 'studio@prographics.com', phone: '(303) 555-2004', company: 'ProGraphics Design Studio', address: '2500 Lawrence St', city: 'Denver', state: 'CO', zip: '80205', tax_id: '83-9876543', balance: 0, is_active: 1 },
    { user_id: userId, name: 'Mountain View Insurance', email: 'agents@mtviewins.com', phone: '(303) 555-2005', company: 'Mountain View Insurance Co', address: '950 17th St', city: 'Denver', state: 'CO', zip: '80202', balance: 0, is_active: 1 },
    { user_id: userId, name: 'DataFlow Analytics', email: 'invoices@dataflow.ai', phone: '(512) 555-2006', company: 'DataFlow Analytics Inc', address: '200 Congress Ave', city: 'Austin', state: 'TX', zip: '78701', tax_id: '86-1122334', balance: 0, is_active: 1 },
    { user_id: userId, name: 'Mile High Printing', email: 'orders@milehighprint.com', phone: '(720) 555-2007', company: 'Mile High Print Shop', address: '3100 Brighton Blvd', city: 'Denver', state: 'CO', zip: '80216', balance: 0, is_active: 1 },
  ];
}

export function getProductsServices(
  userId: string,
  catMap: Record<string, string>,
  acctMap: Record<string, string>,
) {
  return [
    { user_id: userId, name: 'Strategic Consulting - Hourly', type: 'service', price: 250, cost: 0, tax_rate: 0, is_taxable: 0, category_id: catMap['Consulting Services'] || null, account_id: acctMap['4000'] || null, is_active: 1 },
    { user_id: userId, name: 'Project Management - Hourly', type: 'service', price: 200, cost: 0, tax_rate: 0, is_taxable: 0, category_id: catMap['Project Management'] || null, account_id: acctMap['4000'] || null, is_active: 1 },
    { user_id: userId, name: 'Business Analysis - Hourly', type: 'service', price: 225, cost: 0, tax_rate: 0, is_taxable: 0, category_id: catMap['Advisory Services'] || null, account_id: acctMap['4000'] || null, is_active: 1 },
    { user_id: userId, name: 'Training Workshop (Half-Day)', type: 'service', price: 1500, cost: 0, tax_rate: 0, is_taxable: 0, category_id: catMap['Training & Workshops'] || null, account_id: acctMap['4000'] || null, is_active: 1 },
    { user_id: userId, name: 'Training Workshop (Full-Day)', type: 'service', price: 2800, cost: 0, tax_rate: 0, is_taxable: 0, category_id: catMap['Training & Workshops'] || null, account_id: acctMap['4000'] || null, is_active: 1 },
    { user_id: userId, name: 'Advisory Retainer - Monthly', type: 'service', price: 3500, cost: 0, tax_rate: 0, is_taxable: 0, category_id: catMap['Retainer Fees'] || null, account_id: acctMap['4000'] || null, is_active: 1 },
    { user_id: userId, name: 'Assessment & Audit', type: 'service', price: 5000, cost: 0, tax_rate: 0, is_taxable: 0, category_id: catMap['Consulting Services'] || null, account_id: acctMap['4000'] || null, is_active: 1 },
    { user_id: userId, name: 'Custom Report Package', type: 'product', price: 750, cost: 150, tax_rate: 8.31, is_taxable: 1, category_id: catMap['Consulting Services'] || null, account_id: acctMap['4100'] || null, is_active: 1 },
    { user_id: userId, name: 'Process Documentation', type: 'product', price: 1200, cost: 200, tax_rate: 8.31, is_taxable: 1, category_id: catMap['Advisory Services'] || null, account_id: acctMap['4100'] || null, is_active: 1 },
    { user_id: userId, name: 'Strategy Playbook', type: 'product', price: 2500, cost: 350, tax_rate: 8.31, is_taxable: 1, category_id: catMap['Consulting Services'] || null, account_id: acctMap['4100'] || null, is_active: 1 },
  ];
}

// ════════════════════════════════════════════════════════════════
// Phase 3 — Jobs & Estimates
// ════════════════════════════════════════════════════════════════

export function getJobs(userId: string, customerIds: string[]) {
  return [
    { user_id: userId, customer_id: customerIds[0], job_number: 'JOB-001', name: 'Digital Transformation Initiative', description: 'Full digital transformation for Pinnacle Health Systems', status: 'in_progress', start_date: daysAgo(90), end_date: daysFromNow(60), estimated_revenue: 45000, estimated_cost: 22000, actual_revenue: 12500, actual_cost: 6200 },
    { user_id: userId, customer_id: customerIds[1], job_number: 'JOB-002', name: 'Process Optimization', description: 'End-to-end process optimization for TechVista', status: 'completed', start_date: daysAgo(150), end_date: daysAgo(30), estimated_revenue: 18000, estimated_cost: 9000, actual_revenue: 18500, actual_cost: 8700 },
    { user_id: userId, customer_id: customerIds[3], job_number: 'JOB-003', name: 'Strategic Planning Engagement', description: 'Strategic planning for Thompson & Associates Law', status: 'pending', start_date: daysFromNow(14), end_date: daysFromNow(90), estimated_revenue: 12000, estimated_cost: 5500, actual_revenue: 0, actual_cost: 0 },
    { user_id: userId, customer_id: customerIds[4], job_number: 'JOB-004', name: 'Staff Training Program', description: 'Leadership training program for Bright Horizons Academy', status: 'in_progress', start_date: daysAgo(30), end_date: daysFromNow(30), estimated_revenue: 8500, estimated_cost: 3200, actual_revenue: 2800, actual_cost: 1200 },
  ];
}

export function getJobPhases(jobIds: string[]) {
  return [
    // JOB-001 phases
    { job_id: jobIds[0], name: 'Discovery & Assessment', status: 'completed', estimated_hours: 40, estimated_cost: 5000, actual_hours: 38, actual_cost: 4750, sort_order: 1 },
    { job_id: jobIds[0], name: 'Implementation', status: 'in_progress', estimated_hours: 120, estimated_cost: 12000, actual_hours: 45, actual_cost: 4500, sort_order: 2 },
    { job_id: jobIds[0], name: 'Training & Handoff', status: 'pending', estimated_hours: 50, estimated_cost: 5000, actual_hours: 0, actual_cost: 0, sort_order: 3 },
    // JOB-002 phases
    { job_id: jobIds[1], name: 'Process Audit', status: 'completed', estimated_hours: 30, estimated_cost: 3000, actual_hours: 28, actual_cost: 2800, sort_order: 1 },
    { job_id: jobIds[1], name: 'Redesign & Implementation', status: 'completed', estimated_hours: 60, estimated_cost: 6000, actual_hours: 55, actual_cost: 5500, sort_order: 2 },
    // JOB-003 phases
    { job_id: jobIds[2], name: 'Stakeholder Interviews', status: 'pending', estimated_hours: 20, estimated_cost: 2000, actual_hours: 0, actual_cost: 0, sort_order: 1 },
    { job_id: jobIds[2], name: 'Strategy Development', status: 'pending', estimated_hours: 35, estimated_cost: 3500, actual_hours: 0, actual_cost: 0, sort_order: 2 },
    // JOB-004 phases
    { job_id: jobIds[3], name: 'Curriculum Design', status: 'completed', estimated_hours: 15, estimated_cost: 1200, actual_hours: 14, actual_cost: 1120, sort_order: 1 },
    { job_id: jobIds[3], name: 'Workshop Delivery', status: 'in_progress', estimated_hours: 25, estimated_cost: 2000, actual_hours: 10, actual_cost: 800, sort_order: 2 },
  ];
}

export function getEstimates(userId: string, customerIds: string[]) {
  return [
    { user_id: userId, customer_id: customerIds[5], estimate_number: 'EST-001', status: 'draft', issue_date: daysAgo(5), expiry_date: daysFromNow(25), subtotal: 15000, tax_amount: 0, total: 15000, notes: 'Manufacturing process consultation proposal' },
    { user_id: userId, customer_id: customerIds[6], estimate_number: 'EST-002', status: 'sent', issue_date: daysAgo(10), expiry_date: daysFromNow(20), subtotal: 8500, tax_amount: 0, total: 8500, notes: 'Property management consulting' },
    { user_id: userId, customer_id: customerIds[0], estimate_number: 'EST-003', status: 'accepted', issue_date: daysAgo(100), expiry_date: daysAgo(70), subtotal: 22000, tax_amount: 0, total: 22000, notes: 'Healthcare IT strategy engagement' },
    { user_id: userId, customer_id: customerIds[1], estimate_number: 'EST-004', status: 'converted', issue_date: daysAgo(160), expiry_date: daysAgo(130), subtotal: 6500, tax_amount: 0, total: 6500, notes: 'Process optimization project' },
  ];
}

export function getEstimateItems(estimateIds: string[]) {
  return [
    // EST-001
    { estimate_id: estimateIds[0], description: 'Manufacturing Assessment', quantity: 1, rate: 5000, amount: 5000, sort_order: 1 },
    { estimate_id: estimateIds[0], description: 'Process Redesign', quantity: 40, rate: 250, amount: 10000, sort_order: 2 },
    // EST-002
    { estimate_id: estimateIds[1], description: 'Property Portfolio Analysis', quantity: 1, rate: 3500, amount: 3500, sort_order: 1 },
    { estimate_id: estimateIds[1], description: 'Management Strategy Report', quantity: 1, rate: 5000, amount: 5000, sort_order: 2 },
    // EST-003
    { estimate_id: estimateIds[2], description: 'IT Infrastructure Audit', quantity: 1, rate: 7000, amount: 7000, sort_order: 1 },
    { estimate_id: estimateIds[2], description: 'Digital Strategy Development', quantity: 60, rate: 250, amount: 15000, sort_order: 2 },
    // EST-004
    { estimate_id: estimateIds[3], description: 'Process Optimization Engagement', quantity: 1, rate: 6500, amount: 6500, sort_order: 1 },
  ];
}

// ════════════════════════════════════════════════════════════════
// Phase 4 — Invoices & Bills
// ════════════════════════════════════════════════════════════════

export function getInvoices(
  userId: string,
  customerIds: string[],
  jobIds: string[],
  estimateIds: string[],
) {
  return [
    // PAID
    { user_id: userId, customer_id: customerIds[0], job_id: jobIds[0], invoice_number: 'INV-001', status: 'paid', issue_date: daysAgo(150), due_date: daysAgo(120), subtotal: 5000, tax_rate: 0, tax_amount: 0, total: 5000, amount_paid: 5000, notes: 'Digital transformation - Phase 1 discovery' },
    { user_id: userId, customer_id: customerIds[1], job_id: jobIds[1], estimate_id: estimateIds[3], invoice_number: 'INV-002', status: 'paid', issue_date: daysAgo(120), due_date: daysAgo(90), subtotal: 4500, tax_rate: 0, tax_amount: 0, total: 4500, amount_paid: 4500, notes: 'Process optimization - Final billing' },
    { user_id: userId, customer_id: customerIds[0], job_id: jobIds[0], invoice_number: 'INV-010', status: 'paid', issue_date: daysAgo(100), due_date: daysAgo(70), subtotal: 7500, tax_rate: 0, tax_amount: 0, total: 7500, amount_paid: 7500, notes: 'Digital transformation - Phase 2 implementation start' },
    // SENT (outstanding)
    { user_id: userId, customer_id: customerIds[2], invoice_number: 'INV-003', status: 'sent', issue_date: daysAgo(25), due_date: daysFromNow(5), subtotal: 1850, tax_rate: 0, tax_amount: 0, total: 1850, amount_paid: 0, notes: 'Monthly advisory services - Verde Landscaping' },
    { user_id: userId, customer_id: customerIds[4], job_id: jobIds[3], invoice_number: 'INV-005', status: 'sent', issue_date: daysAgo(15), due_date: daysFromNow(15), subtotal: 2800, tax_rate: 0, tax_amount: 0, total: 2800, amount_paid: 0, notes: 'Staff training program - Workshop delivery' },
    { user_id: userId, customer_id: customerIds[0], invoice_number: 'INV-006', status: 'sent', issue_date: daysAgo(20), due_date: daysFromNow(10), subtotal: 4200, tax_rate: 0, tax_amount: 0, total: 4200, amount_paid: 0, notes: 'Monthly retainer - Pinnacle Health' },
    // OVERDUE
    { user_id: userId, customer_id: customerIds[3], invoice_number: 'INV-004', status: 'overdue', issue_date: daysAgo(60), due_date: daysAgo(30), subtotal: 3500, tax_rate: 0, tax_amount: 0, total: 3500, amount_paid: 0, notes: 'Legal strategy consulting - Thompson Law' },
    { user_id: userId, customer_id: customerIds[6], invoice_number: 'INV-007', status: 'overdue', issue_date: daysAgo(50), due_date: daysAgo(20), subtotal: 2100, tax_rate: 0, tax_amount: 0, total: 2100, amount_paid: 0, notes: 'Property portfolio assessment - Park Place' },
    // DRAFT
    { user_id: userId, customer_id: customerIds[1], invoice_number: 'INV-008', status: 'draft', issue_date: daysAgo(5), due_date: daysFromNow(25), subtotal: 3200, tax_rate: 0, tax_amount: 0, total: 3200, amount_paid: 0, notes: 'TechVista Q1 advisory services' },
    // CANCELLED
    { user_id: userId, customer_id: customerIds[2], invoice_number: 'INV-009', status: 'cancelled', issue_date: daysAgo(90), due_date: daysAgo(60), subtotal: 900, tax_rate: 0, tax_amount: 0, total: 900, amount_paid: 0, notes: 'CANCELLED - scope changed' },
  ];
}

export function getInvoiceItems(invoiceIds: string[], acctMap: Record<string, string>) {
  const svcAcct = acctMap['4000'] || null;
  return [
    // INV-001
    { invoice_id: invoiceIds[0], description: 'Discovery & Assessment - 20 hours', quantity: 20, rate: 250, amount: 5000, account_id: svcAcct, sort_order: 1 },
    // INV-002
    { invoice_id: invoiceIds[1], description: 'Process Optimization Consulting', quantity: 18, rate: 250, amount: 4500, account_id: svcAcct, sort_order: 1 },
    // INV-010
    { invoice_id: invoiceIds[2], description: 'Implementation Phase - 30 hours', quantity: 30, rate: 250, amount: 7500, account_id: svcAcct, sort_order: 1 },
    // INV-003
    { invoice_id: invoiceIds[3], description: 'Monthly Advisory Services', quantity: 1, rate: 1850, amount: 1850, account_id: svcAcct, sort_order: 1 },
    // INV-005
    { invoice_id: invoiceIds[4], description: 'Training Workshop (Full-Day)', quantity: 1, rate: 2800, amount: 2800, account_id: svcAcct, sort_order: 1 },
    // INV-006
    { invoice_id: invoiceIds[5], description: 'Advisory Retainer - Monthly', quantity: 1, rate: 3500, amount: 3500, account_id: svcAcct, sort_order: 1 },
    { invoice_id: invoiceIds[5], description: 'Additional consulting hours', quantity: 2.8, rate: 250, amount: 700, account_id: svcAcct, sort_order: 2 },
    // INV-004
    { invoice_id: invoiceIds[6], description: 'Legal Strategy Consulting - 14 hours', quantity: 14, rate: 250, amount: 3500, account_id: svcAcct, sort_order: 1 },
    // INV-007
    { invoice_id: invoiceIds[7], description: 'Property Portfolio Assessment', quantity: 1, rate: 2100, amount: 2100, account_id: svcAcct, sort_order: 1 },
    // INV-008
    { invoice_id: invoiceIds[8], description: 'Q1 Advisory Services', quantity: 1, rate: 3200, amount: 3200, account_id: svcAcct, sort_order: 1 },
    // INV-009
    { invoice_id: invoiceIds[9], description: 'Landscape Business Review', quantity: 1, rate: 900, amount: 900, account_id: svcAcct, sort_order: 1 },
  ];
}

export function getBills(
  userId: string,
  vendorIds: string[],
  catMap: Record<string, string>,
) {
  return [
    { user_id: userId, vendor_id: vendorIds[0], bill_number: 'BILL-001', status: 'paid', bill_date: daysAgo(45), due_date: daysAgo(15), category_id: catMap['Office Supplies'] || null, subtotal: 285, tax_amount: 0, total: 285, amount_paid: 285, description: 'Office supplies - Q4 order' },
    { user_id: userId, vendor_id: vendorIds[1], bill_number: 'BILL-002', status: 'unpaid', bill_date: daysAgo(10), due_date: daysFromNow(20), category_id: catMap['Software Subscriptions'] || null, subtotal: 142.50, tax_amount: 0, total: 142.50, amount_paid: 0, description: 'Monthly electric service' },
    { user_id: userId, vendor_id: vendorIds[2], bill_number: 'BILL-003', status: 'paid', bill_date: daysAgo(35), due_date: daysAgo(5), category_id: catMap['Software Subscriptions'] || null, subtotal: 599, tax_amount: 0, total: 599, amount_paid: 599, description: 'Monthly cloud hosting' },
    { user_id: userId, vendor_id: vendorIds[4], bill_number: 'BILL-004', status: 'overdue', bill_date: daysAgo(60), due_date: daysAgo(30), category_id: catMap['Insurance - Professional Liability'] || null, subtotal: 1250, tax_amount: 0, total: 1250, amount_paid: 0, description: 'Quarterly professional liability insurance' },
    { user_id: userId, vendor_id: vendorIds[5], bill_number: 'BILL-005', status: 'unpaid', bill_date: daysAgo(8), due_date: daysFromNow(22), category_id: catMap['Software Subscriptions'] || null, subtotal: 450, tax_amount: 0, total: 450, amount_paid: 0, description: 'Analytics platform subscription' },
    { user_id: userId, vendor_id: vendorIds[6], bill_number: 'BILL-006', status: 'draft', bill_date: daysAgo(3), due_date: daysFromNow(27), category_id: catMap['Marketing & Advertising'] || null, subtotal: 375, tax_amount: 0, total: 375, amount_paid: 0, description: 'Marketing brochures printing' },
    { user_id: userId, vendor_id: vendorIds[0], bill_number: 'BILL-007', status: 'paid', bill_date: daysAgo(80), due_date: daysAgo(50), category_id: catMap['Office Supplies'] || null, subtotal: 195, tax_amount: 0, total: 195, amount_paid: 195, description: 'Printer paper and toner' },
  ];
}

export function getBillItems(
  billIds: string[],
  catMap: Record<string, string>,
  acctMap: Record<string, string>,
) {
  return [
    { bill_id: billIds[0], description: 'Desk organizers and filing supplies', quantity: 1, rate: 145, amount: 145, category_id: catMap['Office Supplies'] || null, account_id: acctMap['6600'] || null, sort_order: 1 },
    { bill_id: billIds[0], description: 'Printer cartridges', quantity: 2, rate: 70, amount: 140, category_id: catMap['Office Supplies'] || null, account_id: acctMap['6600'] || null, sort_order: 2 },
    { bill_id: billIds[1], description: 'Electric service - office suite', quantity: 1, rate: 142.50, amount: 142.50, account_id: acctMap['7200'] || null, sort_order: 1 },
    { bill_id: billIds[2], description: 'Cloud hosting - monthly plan', quantity: 1, rate: 599, amount: 599, category_id: catMap['Software Subscriptions'] || null, account_id: acctMap['6600'] || null, sort_order: 1 },
    { bill_id: billIds[3], description: 'Professional liability insurance - Q1', quantity: 1, rate: 1250, amount: 1250, category_id: catMap['Insurance - Professional Liability'] || null, account_id: acctMap['6400'] || null, sort_order: 1 },
    { bill_id: billIds[4], description: 'DataFlow Analytics Pro plan', quantity: 1, rate: 450, amount: 450, category_id: catMap['Software Subscriptions'] || null, account_id: acctMap['6600'] || null, sort_order: 1 },
    { bill_id: billIds[5], description: 'Tri-fold brochures (500 qty)', quantity: 500, rate: 0.75, amount: 375, category_id: catMap['Marketing & Advertising'] || null, account_id: acctMap['6000'] || null, sort_order: 1 },
    { bill_id: billIds[6], description: 'Copy paper (10 reams)', quantity: 10, rate: 12, amount: 120, category_id: catMap['Office Supplies'] || null, account_id: acctMap['6600'] || null, sort_order: 1 },
    { bill_id: billIds[6], description: 'Toner cartridge', quantity: 1, rate: 75, amount: 75, category_id: catMap['Office Supplies'] || null, account_id: acctMap['6600'] || null, sort_order: 2 },
  ];
}

// ════════════════════════════════════════════════════════════════
// Phase 5 — Payments
// ════════════════════════════════════════════════════════════════

export function getPayments(
  userId: string,
  invoiceIds: string[],
  billIds: string[],
) {
  return [
    // Received (for paid invoices: INV-001, INV-002, INV-010 → indices 0,1,2)
    { user_id: userId, payment_number: 'PMT-001', type: 'received', invoice_id: invoiceIds[0], amount: 5000, payment_date: daysAgo(118), payment_method: 'bank_transfer', reference: 'ACH-88201', notes: 'Pinnacle Health - INV-001' },
    { user_id: userId, payment_number: 'PMT-002', type: 'received', invoice_id: invoiceIds[1], amount: 4500, payment_date: daysAgo(88), payment_method: 'check', reference: 'CHK-4429', notes: 'TechVista - INV-002' },
    { user_id: userId, payment_number: 'PMT-003', type: 'received', invoice_id: invoiceIds[2], amount: 7500, payment_date: daysAgo(65), payment_method: 'bank_transfer', reference: 'ACH-91045', notes: 'Pinnacle Health - INV-010' },
    // Made (for paid bills: BILL-001, BILL-003, BILL-007 → indices 0,2,6)
    { user_id: userId, payment_number: 'PMT-004', type: 'made', bill_id: billIds[0], amount: 285, payment_date: daysAgo(14), payment_method: 'bank_transfer', reference: 'ACH-OUT-201', notes: 'CO Office Supply - BILL-001' },
    { user_id: userId, payment_number: 'PMT-005', type: 'made', bill_id: billIds[2], amount: 599, payment_date: daysAgo(4), payment_method: 'credit_card', reference: 'CC-7821', notes: 'CloudStack - BILL-003' },
    { user_id: userId, payment_number: 'PMT-006', type: 'made', bill_id: billIds[6], amount: 195, payment_date: daysAgo(48), payment_method: 'check', reference: 'CHK-1102', notes: 'CO Office Supply - BILL-007' },
  ];
}

export function getPaymentsReceived(
  userId: string,
  invoiceIds: string[],
  customerIds: string[],
) {
  return [
    { user_id: userId, invoice_id: invoiceIds[0], customer_id: customerIds[0], amount: 5000, payment_date: daysAgo(118), payment_method: 'bank_transfer', reference_number: 'ACH-88201' },
    { user_id: userId, invoice_id: invoiceIds[1], customer_id: customerIds[1], amount: 4500, payment_date: daysAgo(88), payment_method: 'check', reference_number: 'CHK-4429' },
    { user_id: userId, invoice_id: invoiceIds[2], customer_id: customerIds[0], amount: 7500, payment_date: daysAgo(65), payment_method: 'bank_transfer', reference_number: 'ACH-91045' },
  ];
}

export function getPaymentsMade(
  userId: string,
  billIds: string[],
  vendorIds: string[],
) {
  return [
    { user_id: userId, bill_id: billIds[0], vendor_id: vendorIds[0], amount: 285, payment_date: daysAgo(14), payment_method: 'bank_transfer', reference_number: 'ACH-OUT-201' },
    { user_id: userId, bill_id: billIds[2], vendor_id: vendorIds[2], amount: 599, payment_date: daysAgo(4), payment_method: 'credit_card', reference_number: 'CC-7821' },
    { user_id: userId, bill_id: billIds[6], vendor_id: vendorIds[0], amount: 195, payment_date: daysAgo(48), payment_method: 'check', reference_number: 'CHK-1102' },
  ];
}

// ════════════════════════════════════════════════════════════════
// Phase 6 — Banking
// ════════════════════════════════════════════════════════════════

export function getBankAccounts(userId: string, acctMap: Record<string, string>) {
  return [
    { user_id: userId, account_id: acctMap['1010'] || null, name: 'Business Checking - First National', institution: 'First National Bank', account_type: 'checking', account_number_last4: '4521', routing_number_last4: '0012', current_balance: 42350, available_balance: 42350, is_active: 1 },
    { user_id: userId, account_id: acctMap['1020'] || null, name: 'Business Savings - First National', institution: 'First National Bank', account_type: 'savings', account_number_last4: '8832', routing_number_last4: '0012', current_balance: 15000, available_balance: 15000, is_active: 1 },
    { user_id: userId, account_id: acctMap['2100'] || null, name: 'Business Credit Card - Chase', institution: 'Chase', account_type: 'credit_card', account_number_last4: '9901', current_balance: -2847.50, available_balance: 17152.50, is_active: 1 },
  ];
}

export function getDeposits(userId: string, bankAccountIds: string[]) {
  return [
    { user_id: userId, bank_account_id: bankAccountIds[0], deposit_number: 'DEP-001', deposit_date: daysAgo(85), total: 9500, memo: 'Deposit - INV-001 + INV-002 payments', status: 'deposited' },
    { user_id: userId, bank_account_id: bankAccountIds[0], deposit_number: 'DEP-002', deposit_date: daysAgo(60), total: 7500, memo: 'Deposit - INV-010 payment', status: 'pending' },
  ];
}

export function getDepositItems(depositIds: string[], paymentReceivedIds: string[]) {
  return [
    { deposit_id: depositIds[0], payment_id: paymentReceivedIds[0], description: 'Pinnacle Health - INV-001', amount: 5000, sort_order: 1 },
    { deposit_id: depositIds[0], payment_id: paymentReceivedIds[1], description: 'TechVista - INV-002', amount: 4500, sort_order: 2 },
    { deposit_id: depositIds[1], payment_id: paymentReceivedIds[2], description: 'Pinnacle Health - INV-010', amount: 7500, sort_order: 1 },
  ];
}

export function getReconciliations(userId: string, bankAccountIds: string[]) {
  return [
    { user_id: userId, bank_account_id: bankAccountIds[0], statement_date: daysAgo(30), statement_balance: 38500, opening_balance: 25000, cleared_balance: 38500, difference: 0, status: 'completed', completed_at: daysAgo(28), notes: 'Monthly reconciliation - all cleared' },
    { user_id: userId, bank_account_id: bankAccountIds[0], statement_date: daysAgo(0), statement_balance: 42350, opening_balance: 38500, cleared_balance: 40100, difference: 2250, status: 'in_progress', notes: 'Current month - in progress' },
  ];
}

export function getBankTransactions(
  userId: string,
  bankAccountIds: string[],
  reconciliationIds: string[],
  catMap: Record<string, string>,
) {
  const chk = bankAccountIds[0];
  const cc = bankAccountIds[2];
  const reconDone = reconciliationIds[0];
  const reconWip = reconciliationIds[1];

  return [
    // Checking - reconciled (older)
    { user_id: userId, bank_account_id: chk, date: daysAgo(118), description: 'ACH Deposit - Pinnacle Health', amount: 5000, type: 'credit', status: 'matched', reconciliation_id: reconDone, is_reconciled: 1, reference: 'ACH-88201' },
    { user_id: userId, bank_account_id: chk, date: daysAgo(88), description: 'Check Deposit #4429', amount: 4500, type: 'credit', status: 'matched', reconciliation_id: reconDone, is_reconciled: 1, reference: 'CHK-4429' },
    { user_id: userId, bank_account_id: chk, date: daysAgo(80), description: 'CO Office Supply', amount: 195, type: 'debit', status: 'matched', reconciliation_id: reconDone, is_reconciled: 1, payee: 'Colorado Office Supply', category_id: catMap['Office Supplies'] || null },
    { user_id: userId, bank_account_id: chk, date: daysAgo(65), description: 'ACH Deposit - Pinnacle Health', amount: 7500, type: 'credit', status: 'matched', reconciliation_id: reconDone, is_reconciled: 1, reference: 'ACH-91045' },
    { user_id: userId, bank_account_id: chk, date: daysAgo(60), description: 'Xcel Energy - Auto Pay', amount: 138.75, type: 'debit', status: 'reviewed', reconciliation_id: reconDone, is_reconciled: 1, payee: 'Xcel Energy' },
    { user_id: userId, bank_account_id: chk, date: daysAgo(45), description: 'Transfer to Savings', amount: 5000, type: 'debit', status: 'reviewed', reconciliation_id: reconDone, is_reconciled: 1, memo: 'Monthly savings transfer' },
    // Checking - current month (some in WIP reconciliation)
    { user_id: userId, bank_account_id: chk, date: daysAgo(14), description: 'ACH Payment - CO Office Supply', amount: 285, type: 'debit', status: 'matched', reconciliation_id: reconWip, is_reconciled: 0, payee: 'Colorado Office Supply', category_id: catMap['Office Supplies'] || null },
    { user_id: userId, bank_account_id: chk, date: daysAgo(10), description: 'Xcel Energy - Auto Pay', amount: 142.50, type: 'debit', status: 'reviewed', reconciliation_id: reconWip, is_reconciled: 0, payee: 'Xcel Energy' },
    { user_id: userId, bank_account_id: chk, date: daysAgo(8), description: 'Starbucks - Client Meeting', amount: 24.50, type: 'debit', status: 'unreviewed', payee: 'Starbucks', category_id: catMap['Client Entertainment'] || null },
    { user_id: userId, bank_account_id: chk, date: daysAgo(5), description: 'Amazon Web Services', amount: 89.99, type: 'debit', status: 'unreviewed', payee: 'Amazon' },
    { user_id: userId, bank_account_id: chk, date: daysAgo(3), description: 'Parking - Downtown Denver', amount: 15, type: 'debit', status: 'unreviewed', payee: 'City of Denver', category_id: catMap['Travel - Client Visits'] || null },
    { user_id: userId, bank_account_id: chk, date: daysAgo(1), description: 'Uber - Client Visit', amount: 32.40, type: 'debit', status: 'unreviewed', payee: 'Uber', category_id: catMap['Travel - Client Visits'] || null },
    // Credit card
    { user_id: userId, bank_account_id: cc, date: daysAgo(25), description: 'Adobe Creative Cloud', amount: 54.99, type: 'debit', status: 'reviewed', payee: 'Adobe', category_id: catMap['Software Subscriptions'] || null },
    { user_id: userId, bank_account_id: cc, date: daysAgo(20), description: 'Zoom Pro - Monthly', amount: 14.99, type: 'debit', status: 'reviewed', payee: 'Zoom', category_id: catMap['Software Subscriptions'] || null },
    { user_id: userId, bank_account_id: cc, date: daysAgo(15), description: 'LinkedIn Premium', amount: 59.99, type: 'debit', status: 'unreviewed', payee: 'LinkedIn', category_id: catMap['Professional Memberships'] || null },
    { user_id: userId, bank_account_id: cc, date: daysAgo(10), description: 'Hilton - Client Travel', amount: 189, type: 'debit', status: 'unreviewed', payee: 'Hilton Hotels', category_id: catMap['Travel - Client Visits'] || null },
    { user_id: userId, bank_account_id: cc, date: daysAgo(4), description: 'CloudStack Hosting', amount: 599, type: 'debit', status: 'matched', payee: 'CloudStack', category_id: catMap['Software Subscriptions'] || null, reference: 'CC-7821' },
    { user_id: userId, bank_account_id: cc, date: daysAgo(2), description: 'Office Depot', amount: 67.45, type: 'debit', status: 'unreviewed', payee: 'Office Depot', category_id: catMap['Office Supplies'] || null },
  ];
}

// ════════════════════════════════════════════════════════════════
// Phase 7 — Everything Else
// ════════════════════════════════════════════════════════════════

export function getExpenses(userId: string, catMap: Record<string, string>) {
  return [
    { user_id: userId, vendor: 'Starbucks', description: 'Client meeting coffee', amount: 24.50, date: daysAgo(8), category_id: catMap['Client Entertainment'] || null, is_business: 1, payment_method: 'credit_card' },
    { user_id: userId, vendor: 'Office Depot', description: 'Presentation supplies', amount: 67.45, date: daysAgo(12), category_id: catMap['Office Supplies'] || null, is_business: 1, payment_method: 'credit_card' },
    { user_id: userId, vendor: 'Uber', description: 'Client visit - Pinnacle Health', amount: 32.40, date: daysAgo(6), category_id: catMap['Travel - Client Visits'] || null, is_business: 1, payment_method: 'credit_card' },
    { user_id: userId, vendor: 'Amazon Web Services', description: 'Cloud services - dev environment', amount: 89.99, date: daysAgo(15), category_id: catMap['Software Subscriptions'] || null, is_business: 1, payment_method: 'credit_card' },
    { user_id: userId, vendor: 'Coursera', description: 'Professional development - AI course', amount: 49.00, date: daysAgo(20), category_id: catMap['Professional Development'] || null, is_business: 1, payment_method: 'credit_card' },
    { user_id: userId, vendor: 'LinkedIn', description: 'LinkedIn Premium subscription', amount: 59.99, date: daysAgo(15), category_id: catMap['Professional Memberships'] || null, is_business: 1, payment_method: 'credit_card' },
    { user_id: userId, vendor: 'Hilton Hotels', description: 'Client travel - overnight stay', amount: 189.00, date: daysAgo(10), category_id: catMap['Travel - Client Visits'] || null, is_business: 1, payment_method: 'credit_card' },
    { user_id: userId, vendor: 'City of Denver', description: 'Downtown parking - client meeting', amount: 15.00, date: daysAgo(3), category_id: catMap['Travel - Client Visits'] || null, is_business: 1, payment_method: 'cash' },
    { user_id: userId, vendor: 'FedEx', description: 'Document shipping to Thompson Law', amount: 28.50, date: daysAgo(18), category_id: catMap['Office Supplies'] || null, is_business: 1, payment_method: 'credit_card' },
    { user_id: userId, vendor: 'Google Workspace', description: 'Monthly subscription - 5 users', amount: 72.00, date: daysAgo(5), category_id: catMap['Software Subscriptions'] || null, is_business: 1, payment_method: 'credit_card' },
    { user_id: userId, vendor: 'Target', description: 'Personal purchase', amount: 45.99, date: daysAgo(7), category_id: null, is_business: 0, payment_method: 'credit_card' },
    { user_id: userId, vendor: 'Chipotle', description: 'Team lunch', amount: 38.75, date: daysAgo(4), category_id: catMap['Client Entertainment'] || null, is_business: 1, payment_method: 'credit_card' },
  ];
}

export function getJournalEntries(userId: string) {
  return [
    { user_id: userId, entry_number: 'JE-001', entry_date: daysAgo(180), description: 'Opening balances - business start', status: 'posted', total_debits: 40000, total_credits: 40000 },
    { user_id: userId, entry_number: 'JE-002', entry_date: daysAgo(30), description: 'Depreciation - Equipment Q4', status: 'posted', total_debits: 500, total_credits: 500 },
    { user_id: userId, entry_number: 'JE-003', entry_date: daysAgo(5), description: 'Year-end accrual adjustment', status: 'draft', total_debits: 1200, total_credits: 1200 },
  ];
}

export function getJournalEntryLines(
  journalEntryIds: string[],
  acctMap: Record<string, string>,
) {
  return [
    // JE-001: Opening balances
    { journal_entry_id: journalEntryIds[0], account_id: acctMap['1010']!, description: 'Opening balance - Checking', debit: 25000, credit: 0, sort_order: 1 },
    { journal_entry_id: journalEntryIds[0], account_id: acctMap['1020']!, description: 'Opening balance - Savings', debit: 10000, credit: 0, sort_order: 2 },
    { journal_entry_id: journalEntryIds[0], account_id: acctMap['1500']!, description: 'Opening balance - Equipment', debit: 5000, credit: 0, sort_order: 3 },
    { journal_entry_id: journalEntryIds[0], account_id: acctMap['3000']!, description: 'Owner investment', debit: 0, credit: 40000, sort_order: 4 },
    // JE-002: Depreciation
    { journal_entry_id: journalEntryIds[1], account_id: acctMap['6300']!, description: 'Depreciation - Office equipment', debit: 500, credit: 0, sort_order: 1 },
    { journal_entry_id: journalEntryIds[1], account_id: acctMap['1510']!, description: 'Accumulated depreciation', debit: 0, credit: 500, sort_order: 2 },
    // JE-003: Year-end accrual
    { journal_entry_id: journalEntryIds[2], account_id: acctMap['6800']!, description: 'Accrued rent - December', debit: 1200, credit: 0, sort_order: 1 },
    { journal_entry_id: journalEntryIds[2], account_id: acctMap['2000']!, description: 'Rent payable', debit: 0, credit: 1200, sort_order: 2 },
  ];
}

export function getCustomerNotes(userId: string, customerIds: string[]) {
  return [
    { user_id: userId, customer_id: customerIds[0], content: 'Initial consultation completed. Key contact is Sarah Mitchell (VP Operations). Prefers email communication for non-urgent matters.' },
    { user_id: userId, customer_id: customerIds[1], content: 'Referred by existing client Lisa Park. David is very responsive and prefers Slack for quick questions.' },
    { user_id: userId, customer_id: customerIds[3], content: 'Robert prefers formal proposals in writing. Law firm requires detailed time tracking on all invoices.' },
  ];
}

export function getCustomerTodos(userId: string, customerIds: string[]) {
  return [
    { user_id: userId, customer_id: customerIds[0], title: 'Schedule quarterly business review', description: 'Q1 review for Digital Transformation project progress', is_completed: 0, due_date: daysFromNow(14) },
    { user_id: userId, customer_id: customerIds[3], title: 'Follow up on overdue invoice INV-004', description: 'Invoice is 30+ days overdue. Call Robert directly.', is_completed: 0, due_date: daysFromNow(3) },
    { user_id: userId, customer_id: customerIds[5], title: 'Send proposal for manufacturing assessment', description: 'Marcus requested a formal proposal. EST-001 is ready for review.', is_completed: 0, due_date: daysFromNow(7) },
  ];
}

export function getReminderSettings(userId: string) {
  return {
    user_id: userId,
    enabled: 1,
    grace_period_days: 5,
    frequency_days: 7,
    max_reminders: 3,
    default_message: 'This is a friendly reminder that your invoice is past due. Please arrange payment at your earliest convenience.',
  };
}

export function getLateFeeSettings(userId: string) {
  return {
    user_id: userId,
    enabled: 1,
    fee_type: 'percentage',
    fee_amount: 1.5,
    grace_period_days: 10,
    auto_apply: 0,
    max_fees_per_invoice: 3,
  };
}

export function getInvoiceReminders(userId: string, invoiceIds: string[]) {
  // For overdue invoices: INV-004 (index 6) and INV-007 (index 7)
  return [
    { user_id: userId, invoice_id: invoiceIds[6], reminder_type: 'automatic', message: 'This is a friendly reminder that Invoice INV-004 for $3,500.00 is past due. Please arrange payment at your earliest convenience.', sent_at: daysAgo(12) + ' 09:00:00' },
    { user_id: userId, invoice_id: invoiceIds[6], reminder_type: 'manual', message: 'Hi Robert, following up on Invoice INV-004. Please let us know if you have any questions about the balance.', sent_at: daysAgo(5) + ' 14:30:00' },
    { user_id: userId, invoice_id: invoiceIds[7], reminder_type: 'automatic', message: 'This is a friendly reminder that Invoice INV-007 for $2,100.00 is past due. Please arrange payment at your earliest convenience.', sent_at: daysAgo(3) + ' 09:00:00' },
  ];
}

export function getInvoiceLateFees(userId: string, invoiceIds: string[]) {
  // For overdue invoices: INV-004 (index 6) and INV-007 (index 7)
  return [
    { user_id: userId, invoice_id: invoiceIds[6], fee_type: 'percentage', fee_amount: 1.5, calculated_fee: 52.50, invoice_total_before: 3500, invoice_total_after: 3552.50, applied_type: 'automatic', reversed: 0 },
    { user_id: userId, invoice_id: invoiceIds[7], fee_type: 'percentage', fee_amount: 1.5, calculated_fee: 31.50, invoice_total_before: 2100, invoice_total_after: 2131.50, applied_type: 'manual', reversed: 0 },
  ];
}

export function getMerchantRules(userId: string, catMap: Record<string, string>) {
  return [
    { user_id: userId, merchant_pattern: 'XCEL%', category_id: catMap['Software Subscriptions'] || null, is_business: 1, priority: 10 },
    { user_id: userId, merchant_pattern: '%OFFICE%SUPPLY%', category_id: catMap['Office Supplies'] || null, is_business: 1, priority: 5 },
    { user_id: userId, merchant_pattern: 'CLOUDSTACK%', category_id: catMap['Software Subscriptions'] || null, is_business: 1, priority: 10 },
    { user_id: userId, merchant_pattern: '%STARBUCKS%', category_id: catMap['Client Entertainment'] || null, is_business: 1, priority: 1 },
  ];
}

export function getItemCategoryRules(userId: string, catMap: Record<string, string>) {
  return [
    { user_id: userId, item_pattern: '%hosting%', category_id: catMap['Software Subscriptions'] || null, is_business: 1, priority: 5 },
    { user_id: userId, item_pattern: '%subscription%', category_id: catMap['Software Subscriptions'] || null, is_business: 1, priority: 5 },
    { user_id: userId, item_pattern: '%insurance%', category_id: catMap['Insurance - Professional Liability'] || null, is_business: 1, priority: 5 },
  ];
}

export function getRecurringExpenses(userId: string, catMap: Record<string, string>) {
  return [
    { user_id: userId, vendor: 'CloudStack Hosting', description: 'Monthly cloud hosting', amount: 599, category_id: catMap['Software Subscriptions'] || null, frequency: 'monthly', next_due_date: daysFromNow(15), is_active: 1 },
    { user_id: userId, vendor: 'Xcel Energy', description: 'Monthly electric service', amount: 142.50, category_id: catMap['Software Subscriptions'] || null, frequency: 'monthly', next_due_date: daysFromNow(5), is_active: 1 },
    { user_id: userId, vendor: 'Mountain View Insurance', description: 'Professional liability insurance', amount: 1250, category_id: catMap['Insurance - Professional Liability'] || null, frequency: 'quarterly', next_due_date: daysFromNow(60), is_active: 1 },
  ];
}

export function getDetectedSubscriptions(userId: string, catMap: Record<string, string>) {
  return [
    { user_id: userId, vendor: 'CloudStack Hosting', vendor_normalized: 'cloudstack hosting', avg_amount: 599, min_amount: 599, max_amount: 599, frequency: 'monthly', confidence: 0.95, first_seen: daysAgo(180), last_seen: daysAgo(4), next_expected: daysFromNow(26), occurrence_count: 6, category_id: catMap['Software Subscriptions'] || null, category_name: 'Software Subscriptions', is_confirmed: 1, is_active: 1, is_dismissed: 0 },
    { user_id: userId, vendor: 'Zoom Pro', vendor_normalized: 'zoom pro', avg_amount: 14.99, min_amount: 14.99, max_amount: 14.99, frequency: 'monthly', confidence: 0.88, first_seen: daysAgo(180), last_seen: daysAgo(20), next_expected: daysFromNow(10), occurrence_count: 6, category_id: catMap['Software Subscriptions'] || null, category_name: 'Software Subscriptions', is_confirmed: 0, is_active: 1, is_dismissed: 0 },
    { user_id: userId, vendor: 'Adobe Creative Cloud', vendor_normalized: 'adobe creative cloud', avg_amount: 54.99, min_amount: 52.99, max_amount: 54.99, frequency: 'monthly', confidence: 0.92, first_seen: daysAgo(120), last_seen: daysAgo(25), next_expected: daysFromNow(5), occurrence_count: 4, category_id: catMap['Software Subscriptions'] || null, category_name: 'Software Subscriptions', is_confirmed: 1, is_active: 1, is_dismissed: 0 },
  ];
}

export function getSubscriptionPriceHistory(
  userId: string,
  subscriptionIds: string[],
) {
  return [
    // CloudStack
    { subscription_id: subscriptionIds[0], user_id: userId, amount: 599, detected_date: daysAgo(180), price_change: null, price_change_pct: null },
    { subscription_id: subscriptionIds[0], user_id: userId, amount: 599, detected_date: daysAgo(90), price_change: 0, price_change_pct: 0 },
    // Zoom
    { subscription_id: subscriptionIds[1], user_id: userId, amount: 14.99, detected_date: daysAgo(180), price_change: null, price_change_pct: null },
    { subscription_id: subscriptionIds[1], user_id: userId, amount: 14.99, detected_date: daysAgo(90), price_change: 0, price_change_pct: 0 },
    // Adobe
    { subscription_id: subscriptionIds[2], user_id: userId, amount: 52.99, detected_date: daysAgo(120), price_change: null, price_change_pct: null },
    { subscription_id: subscriptionIds[2], user_id: userId, amount: 54.99, detected_date: daysAgo(60), price_change: 2.00, price_change_pct: 3.77 },
  ];
}

export function getBudgets(userId: string, catMap: Record<string, string>) {
  return [
    { user_id: userId, category: 'Software Subscriptions', category_id: catMap['Software Subscriptions'] || null, amount: 1500, period: 'monthly', is_active: 1 },
    { user_id: userId, category: 'Travel - Client Visits', category_id: catMap['Travel - Client Visits'] || null, amount: 2000, period: 'monthly', is_active: 1 },
    { user_id: userId, category: 'Marketing & Advertising', category_id: catMap['Marketing & Advertising'] || null, amount: 3000, period: 'quarterly', is_active: 1 },
    { user_id: userId, category: 'Office Supplies', category_id: catMap['Office Supplies'] || null, amount: 500, period: 'monthly', is_active: 1 },
  ];
}

export function getMileage(userId: string) {
  return [
    { user_id: userId, date: daysAgo(5), distance: 24.5, is_business: 1, purpose: 'Client meeting - Pinnacle Health Systems', start_location: '1200 17th St, Denver', end_location: '4500 Cherry Creek Dr S, Denver' },
    { user_id: userId, date: daysAgo(10), distance: 18.2, is_business: 1, purpose: 'Client visit - Thompson & Associates', start_location: '1200 17th St, Denver', end_location: '1801 California St, Denver' },
    { user_id: userId, date: daysAgo(15), distance: 42.8, is_business: 1, purpose: 'Quarterly review - Bright Horizons', start_location: '1200 17th St, Denver', end_location: '2300 S University Blvd, Denver' },
    { user_id: userId, date: daysAgo(22), distance: 15.3, is_business: 1, purpose: 'Networking event - Denver Tech Center', start_location: '1200 17th St, Denver', end_location: '8000 E Belleview Ave, Greenwood Village' },
    { user_id: userId, date: daysAgo(30), distance: 8.5, is_business: 0, purpose: 'Personal errand', start_location: 'Home', end_location: 'Cherry Creek Mall' },
    { user_id: userId, date: daysAgo(35), distance: 56.1, is_business: 1, purpose: 'Client site visit - Apex Manufacturing', start_location: '1200 17th St, Denver', end_location: '7800 E Hampden Ave, Denver' },
  ];
}

export function getCustomReports(userId: string) {
  return [
    {
      user_id: userId,
      name: 'Outstanding Invoices',
      description: 'All invoices awaiting payment',
      data_source: 'invoices',
      columns: JSON.stringify(['invoice_number', 'customer', 'issue_date', 'due_date', 'total', 'amount_paid', 'status']),
      filters: JSON.stringify([{ field: 'status', operator: 'in', value: ['sent', 'overdue'] }]),
      sort_by: 'due_date',
      sort_order: 'asc',
      is_favorite: 1,
    },
    {
      user_id: userId,
      name: 'Vendor Spending Summary',
      description: 'Total spending by vendor this year',
      data_source: 'bills',
      columns: JSON.stringify(['vendor', 'bill_number', 'bill_date', 'total', 'status']),
      filters: JSON.stringify([]),
      sort_by: 'total',
      sort_order: 'desc',
      date_field: 'bill_date',
      is_favorite: 0,
    },
    {
      user_id: userId,
      name: 'Monthly Cash Receipts',
      description: 'Payments received by month',
      data_source: 'payments',
      columns: JSON.stringify(['payment_number', 'type', 'amount', 'payment_date', 'payment_method']),
      filters: JSON.stringify([{ field: 'type', operator: 'equals', value: 'received' }]),
      sort_by: 'payment_date',
      sort_order: 'desc',
      date_field: 'payment_date',
      is_favorite: 1,
    },
  ];
}
