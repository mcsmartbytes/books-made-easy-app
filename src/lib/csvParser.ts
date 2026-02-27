// Generic CSV parser for bank transaction imports
// Handles quoted fields, date/amount detection, and various bank formats

export interface CSVParseResult {
  headers: string[];
  rows: Record<string, string>[];
  detectedMapping: ColumnMapping;
}

export interface ColumnMapping {
  date: string | null;
  description: string | null;
  amount: string | null;
  debit: string | null;
  credit: string | null;
  reference: string | null;
  checkNumber: string | null;
  category: string | null;
}

const DATE_PATTERNS = [
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,       // MM/DD/YYYY or M/D/YY
  /^\d{4}-\d{2}-\d{2}$/,                 // YYYY-MM-DD
  /^\d{1,2}-\d{1,2}-\d{2,4}$/,           // MM-DD-YYYY
  /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,         // MM.DD.YYYY
  /^[A-Z][a-z]{2}\s+\d{1,2},?\s+\d{4}$/, // Jan 15, 2024
];

const AMOUNT_PATTERN = /^-?\$?[\d,]+\.?\d{0,2}$/;

const DATE_COLUMN_NAMES = ['date', 'transaction date', 'trans date', 'posting date', 'post date', 'effective date'];
const DESCRIPTION_COLUMN_NAMES = ['description', 'memo', 'narrative', 'details', 'payee', 'transaction description', 'name'];
const AMOUNT_COLUMN_NAMES = ['amount', 'transaction amount', 'trans amount'];
const DEBIT_COLUMN_NAMES = ['debit', 'withdrawal', 'withdrawals', 'debit amount', 'money out'];
const CREDIT_COLUMN_NAMES = ['credit', 'deposit', 'deposits', 'credit amount', 'money in'];
const REFERENCE_COLUMN_NAMES = ['reference', 'ref', 'reference number', 'ref no', 'confirmation', 'transaction id'];
const CHECK_COLUMN_NAMES = ['check number', 'check no', 'check #', 'cheque number'];
const CATEGORY_COLUMN_NAMES = ['category', 'type', 'transaction type'];

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function detectColumnByName(header: string, candidates: string[]): boolean {
  const normalized = header.toLowerCase().trim();
  return candidates.some(c => normalized === c || normalized.includes(c));
}

function detectColumnByContent(values: string[], testFn: (val: string) => boolean): number {
  if (values.length === 0) return 0;
  const matches = values.filter(v => v && testFn(v.trim())).length;
  return matches / values.length;
}

function isDateValue(value: string): boolean {
  return DATE_PATTERNS.some(p => p.test(value.trim()));
}

function isAmountValue(value: string): boolean {
  return AMOUNT_PATTERN.test(value.replace(/[$,\s]/g, '').trim());
}

function detectMapping(headers: string[], sampleRows: Record<string, string>[]): ColumnMapping {
  const mapping: ColumnMapping = {
    date: null,
    description: null,
    amount: null,
    debit: null,
    credit: null,
    reference: null,
    checkNumber: null,
    category: null,
  };

  // First pass: match by column name
  for (const header of headers) {
    if (!mapping.date && detectColumnByName(header, DATE_COLUMN_NAMES)) mapping.date = header;
    if (!mapping.description && detectColumnByName(header, DESCRIPTION_COLUMN_NAMES)) mapping.description = header;
    if (!mapping.amount && detectColumnByName(header, AMOUNT_COLUMN_NAMES)) mapping.amount = header;
    if (!mapping.debit && detectColumnByName(header, DEBIT_COLUMN_NAMES)) mapping.debit = header;
    if (!mapping.credit && detectColumnByName(header, CREDIT_COLUMN_NAMES)) mapping.credit = header;
    if (!mapping.reference && detectColumnByName(header, REFERENCE_COLUMN_NAMES)) mapping.reference = header;
    if (!mapping.checkNumber && detectColumnByName(header, CHECK_COLUMN_NAMES)) mapping.checkNumber = header;
    if (!mapping.category && detectColumnByName(header, CATEGORY_COLUMN_NAMES)) mapping.category = header;
  }

  // Second pass: detect by content for unmapped columns
  if (!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit)) {
    for (const header of headers) {
      if (header === mapping.date || header === mapping.description || header === mapping.amount ||
          header === mapping.debit || header === mapping.credit) continue;

      const values = sampleRows.map(r => r[header] || '');

      if (!mapping.date && detectColumnByContent(values, isDateValue) > 0.7) {
        mapping.date = header;
      } else if (!mapping.amount && !mapping.debit && detectColumnByContent(values, isAmountValue) > 0.7) {
        mapping.amount = header;
      } else if (!mapping.description && values.filter(v => v.length > 5).length > values.length * 0.5) {
        mapping.description = header;
      }
    }
  }

  return mapping;
}

export function parseCSV(csvText: string): CSVParseResult {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [], detectedMapping: { date: null, description: null, amount: null, debit: null, credit: null, reference: null, checkNumber: null, category: null } };
  }

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i]);
    if (fields.length === 0 || (fields.length === 1 && !fields[0])) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j] || '';
    }
    rows.push(row);
  }

  const sampleRows = rows.slice(0, Math.min(10, rows.length));
  const detectedMapping = detectMapping(headers, sampleRows);

  return { headers, rows, detectedMapping };
}

export function parseAmount(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function normalizeDate(value: string): string {
  if (!value) return '';
  const trimmed = value.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return trimmed;
}
