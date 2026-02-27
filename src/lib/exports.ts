// Export utilities for enhanced reporting

export interface ExpenseExport {
  id: string;
  date: string;
  description: string;
  vendor: string | null;
  category: string;
  amount: number;
  is_business: boolean;
  payment_method: string | null;
  deduction_percentage: number;
  deductible_amount: number;
  schedule_c_line: string | null;
}

export interface MileageExport {
  id: string;
  date: string;
  start_location: string | null;
  end_location: string | null;
  purpose: string | null;
  distance: number;
  rate: number;
  deduction: number;
}

export interface YearEndSummary {
  year: number;
  total_expenses: number;
  total_business_expenses: number;
  total_personal_expenses: number;
  total_deductible: number;
  estimated_tax_savings: number;
  mileage_total_miles: number;
  mileage_total_deduction: number;
  by_quarter: QuarterlySummary[];
  by_schedule_c_line: ScheduleCLineSummary[];
  top_categories: CategorySummary[];
  top_vendors: VendorSummary[];
}

export interface QuarterlySummary {
  quarter: number;
  label: string;
  total: number;
  business: number;
  personal: number;
  expense_count: number;
}

export interface ScheduleCLineSummary {
  line: string;
  line_name: string;
  total: number;
  deductible: number;
  expense_count: number;
}

export interface CategorySummary {
  name: string;
  icon: string;
  total: number;
  count: number;
  percentage: number;
}

export interface VendorSummary {
  name: string;
  total: number;
  count: number;
}

// Format currency for CSV
export function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

// Escape CSV value
export function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// Generate CSV from data
export function generateCSV(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const headerRow = headers.map(escapeCSV).join(',');
  const dataRows = rows.map((row) =>
    row.map((cell) => (typeof cell === 'number' ? formatCurrency(cell) : escapeCSV(cell as string))).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

// Generate year-end summary CSV
export function generateYearEndCSV(summary: YearEndSummary): string {
  const lines: string[] = [];

  // Header
  lines.push(`Year-End Tax Summary for ${summary.year}`);
  lines.push('');

  // Overall summary
  lines.push('OVERALL SUMMARY');
  lines.push(`Total Expenses,${formatCurrency(summary.total_expenses)}`);
  lines.push(`Business Expenses,${formatCurrency(summary.total_business_expenses)}`);
  lines.push(`Personal Expenses,${formatCurrency(summary.total_personal_expenses)}`);
  lines.push(`Total Deductible,${formatCurrency(summary.total_deductible)}`);
  lines.push(`Estimated Tax Savings (24%),${formatCurrency(summary.estimated_tax_savings)}`);
  lines.push('');

  // Mileage
  lines.push('MILEAGE DEDUCTIONS');
  lines.push(`Total Miles,${summary.mileage_total_miles.toFixed(1)}`);
  lines.push(`Mileage Deduction,${formatCurrency(summary.mileage_total_deduction)}`);
  lines.push('');

  // Quarterly breakdown
  lines.push('QUARTERLY BREAKDOWN');
  lines.push('Quarter,Total,Business,Personal,Expenses');
  for (const q of summary.by_quarter) {
    lines.push(`${q.label},${formatCurrency(q.total)},${formatCurrency(q.business)},${formatCurrency(q.personal)},${q.expense_count}`);
  }
  lines.push('');

  // Schedule C breakdown
  lines.push('SCHEDULE C BREAKDOWN');
  lines.push('Line,Description,Total,Deductible,Expenses');
  for (const sc of summary.by_schedule_c_line) {
    lines.push(`${escapeCSV(sc.line)},${escapeCSV(sc.line_name)},${formatCurrency(sc.total)},${formatCurrency(sc.deductible)},${sc.expense_count}`);
  }
  lines.push('');

  // Top categories
  lines.push('TOP EXPENSE CATEGORIES');
  lines.push('Category,Total,Count,% of Total');
  for (const cat of summary.top_categories) {
    lines.push(`${escapeCSV(cat.name)},${formatCurrency(cat.total)},${cat.count},${cat.percentage.toFixed(1)}%`);
  }
  lines.push('');

  // Top vendors
  lines.push('TOP VENDORS');
  lines.push('Vendor,Total,Transactions');
  for (const vendor of summary.top_vendors) {
    lines.push(`${escapeCSV(vendor.name)},${formatCurrency(vendor.total)},${vendor.count}`);
  }

  return lines.join('\n');
}

// Generate accountant-ready expense detail CSV
export function generateExpenseDetailCSV(expenses: ExpenseExport[]): string {
  const headers = [
    'Date',
    'Description',
    'Vendor',
    'Category',
    'Amount',
    'Type',
    'Payment Method',
    'Deduction %',
    'Deductible Amount',
    'Schedule C Line',
  ];

  const rows = expenses.map((e) => [
    e.date,
    e.description,
    e.vendor,
    e.category,
    e.amount,
    e.is_business ? 'Business' : 'Personal',
    e.payment_method,
    e.deduction_percentage,
    e.deductible_amount,
    e.schedule_c_line,
  ]);

  return generateCSV(headers, rows);
}

// Generate mileage log CSV
export function generateMileageCSV(mileage: MileageExport[]): string {
  const headers = [
    'Date',
    'Start Location',
    'End Location',
    'Purpose',
    'Miles',
    'Rate',
    'Deduction',
  ];

  const rows = mileage.map((m) => [
    m.date,
    m.start_location,
    m.end_location,
    m.purpose,
    m.distance,
    m.rate,
    m.deduction,
  ]);

  return generateCSV(headers, rows);
}

// Calculate quarter from date
export function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

// Get quarter label
export function getQuarterLabel(quarter: number): string {
  const labels = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
  return labels[quarter - 1] || `Q${quarter}`;
}
