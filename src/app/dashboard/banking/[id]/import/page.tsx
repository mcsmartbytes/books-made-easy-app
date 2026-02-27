'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSession } from 'next-auth/react';

interface ColumnMapping {
  date: string | null;
  description: string | null;
  amount: string | null;
  debit: string | null;
  credit: string | null;
  reference: string | null;
  checkNumber: string | null;
  category: string | null;
}

interface PreviewData {
  headers: string[];
  sampleRows: Record<string, string>[];
  detectedMapping: ColumnMapping;
  totalRows: number;
}

type Step = 'upload' | 'mapping' | 'preview' | 'result';

export default function ImportPage() {
  const params = useParams();
  const _router = useRouter();
  const accountId = params.id as string;

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [_csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: null, description: null, amount: null, debit: null, credit: null, reference: null, checkNumber: null, category: null });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');

    const text = await selectedFile.text();
    setCsvText(text);

    // Parse locally for preview
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      setError('CSV file must have a header row and at least one data row.');
      return;
    }

    const headers = parseCSVLine(lines[0]);
    const sampleRows: Record<string, string>[] = [];
    for (let i = 1; i < Math.min(6, lines.length); i++) {
      const fields = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = fields[idx] || ''; });
      sampleRows.push(row);
    }

    const detectedMapping = detectColumns(headers, sampleRows);

    setPreview({
      headers,
      sampleRows,
      detectedMapping,
      totalRows: lines.length - 1,
    });
    setMapping(detectedMapping);
    setStep('mapping');
  };

  const parseCSVLine = (line: string): string[] => {
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
  };

  const detectColumns = (headers: string[], _rows: Record<string, string>[]): ColumnMapping => {
    const m: ColumnMapping = { date: null, description: null, amount: null, debit: null, credit: null, reference: null, checkNumber: null, category: null };
    const dateNames = ['date', 'transaction date', 'trans date', 'posting date'];
    const descNames = ['description', 'memo', 'narrative', 'details', 'payee', 'name'];
    const amountNames = ['amount', 'transaction amount'];
    const debitNames = ['debit', 'withdrawal'];
    const creditNames = ['credit', 'deposit'];
    const refNames = ['reference', 'ref', 'confirmation'];
    const checkNames = ['check number', 'check no', 'check #'];

    for (const h of headers) {
      const low = h.toLowerCase().trim();
      if (!m.date && dateNames.some(n => low.includes(n))) m.date = h;
      if (!m.description && descNames.some(n => low.includes(n))) m.description = h;
      if (!m.amount && amountNames.some(n => low === n)) m.amount = h;
      if (!m.debit && debitNames.some(n => low.includes(n))) m.debit = h;
      if (!m.credit && creditNames.some(n => low.includes(n))) m.credit = h;
      if (!m.reference && refNames.some(n => low.includes(n))) m.reference = h;
      if (!m.checkNumber && checkNames.some(n => low.includes(n))) m.checkNumber = h;
    }

    return m;
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setError('');

    try {
      const session = await getSession();
      const userId = (session?.user as { id?: string })?.id;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', userId || '');
      formData.append('bank_account_id', accountId);
      formData.append('mapping', JSON.stringify(mapping));

      const response = await fetch('/api/bank-transactions/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Import failed');
        setImporting(false);
        return;
      }

      setResult(data.data);
      setStep('result');
    } catch {
      setError('Import failed. Please try again.');
    }
    setImporting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-corporate-gray mb-1">
          <Link href="/dashboard/banking" className="hover:text-primary-600">Banking</Link>
          <span>/</span>
          <Link href={`/dashboard/banking/${accountId}`} className="hover:text-primary-600">Account</Link>
          <span>/</span>
          <span>Import</span>
        </div>
        <h1 className="text-2xl font-bold text-corporate-dark">Import Bank Transactions</h1>
        <p className="text-corporate-gray mt-1">Upload a CSV file from your bank to import transactions</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {(['upload', 'mapping', 'preview', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? 'bg-primary-600 text-white' :
              (['upload', 'mapping', 'preview', 'result'].indexOf(step) > i) ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {['upload', 'mapping', 'preview', 'result'].indexOf(step) > i ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-sm font-medium ${step === s ? 'text-primary-600' : 'text-corporate-gray'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 3 && <div className="w-12 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <h3 className="text-lg font-medium text-corporate-dark mb-2">Upload CSV File</h3>
          <p className="text-corporate-gray mb-6 max-w-md mx-auto">
            Download a CSV or OFX file from your bank&apos;s website, then upload it here.
            Most banks offer this under &quot;Download Transactions&quot; or &quot;Export&quot;.
          </p>
          <label className="btn-primary cursor-pointer inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Choose File
            <input type="file" accept=".csv,.CSV" onChange={handleFileSelect} className="hidden" />
          </label>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && preview && (
        <div className="card">
          <h3 className="text-lg font-medium text-corporate-dark mb-4">Map Columns</h3>
          <p className="text-sm text-corporate-gray mb-6">
            We detected {preview.totalRows} rows. Please verify the column mapping below.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-corporate-dark mb-1">Date Column *</label>
              <select value={mapping.date || ''} onChange={(e) => setMapping({ ...mapping, date: e.target.value || null })} className="input-field">
                <option value="">-- Select --</option>
                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-corporate-dark mb-1">Description Column *</label>
              <select value={mapping.description || ''} onChange={(e) => setMapping({ ...mapping, description: e.target.value || null })} className="input-field">
                <option value="">-- Select --</option>
                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-corporate-dark mb-1">Amount Column (single)</label>
              <select value={mapping.amount || ''} onChange={(e) => setMapping({ ...mapping, amount: e.target.value || null })} className="input-field">
                <option value="">-- Select --</option>
                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <p className="text-xs text-corporate-gray mt-1">Use this if amounts are in one column (negative = debit)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-corporate-dark mb-1">Reference Column</label>
              <select value={mapping.reference || ''} onChange={(e) => setMapping({ ...mapping, reference: e.target.value || null })} className="input-field">
                <option value="">-- None --</option>
                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-corporate-dark mb-1">Debit Column</label>
              <select value={mapping.debit || ''} onChange={(e) => setMapping({ ...mapping, debit: e.target.value || null })} className="input-field">
                <option value="">-- None --</option>
                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-corporate-dark mb-1">Credit Column</label>
              <select value={mapping.credit || ''} onChange={(e) => setMapping({ ...mapping, credit: e.target.value || null })} className="input-field">
                <option value="">-- None --</option>
                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          {/* Preview Table */}
          <h4 className="text-sm font-medium text-corporate-dark mb-2">Preview (first 5 rows)</h4>
          <div className="overflow-x-auto border rounded-lg mb-6">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {preview.headers.map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-corporate-gray uppercase">
                      {h}
                      {h === mapping.date && <span className="ml-1 text-primary-600">(Date)</span>}
                      {h === mapping.description && <span className="ml-1 text-primary-600">(Desc)</span>}
                      {h === mapping.amount && <span className="ml-1 text-primary-600">(Amt)</span>}
                      {h === mapping.debit && <span className="ml-1 text-red-600">(Debit)</span>}
                      {h === mapping.credit && <span className="ml-1 text-green-600">(Credit)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sampleRows.map((row, i) => (
                  <tr key={i} className="border-t">
                    {preview.headers.map(h => (
                      <td key={h} className="px-3 py-2 text-corporate-slate whitespace-nowrap">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setStep('upload'); setFile(null); setPreview(null); }} className="px-4 py-2 border border-gray-300 rounded-lg text-corporate-slate hover:bg-gray-50">
              Back
            </button>
            <button
              onClick={() => {
                if (!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit)) {
                  setError('Please map at least Date, Description, and Amount (or Debit) columns.');
                  return;
                }
                setError('');
                setStep('preview');
              }}
              className="btn-primary"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'preview' && preview && (
        <div className="card">
          <h3 className="text-lg font-medium text-corporate-dark mb-4">Confirm Import</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-corporate-gray">File:</span> <span className="font-medium">{file?.name}</span></div>
              <div><span className="text-corporate-gray">Rows:</span> <span className="font-medium">{preview.totalRows}</span></div>
              <div><span className="text-corporate-gray">Date column:</span> <span className="font-medium">{mapping.date}</span></div>
              <div><span className="text-corporate-gray">Description column:</span> <span className="font-medium">{mapping.description}</span></div>
              <div><span className="text-corporate-gray">Amount column:</span> <span className="font-medium">{mapping.amount || `${mapping.debit} / ${mapping.credit}`}</span></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('mapping')} className="px-4 py-2 border border-gray-300 rounded-lg text-corporate-slate hover:bg-gray-50">
              Back
            </button>
            <button onClick={handleImport} disabled={importing} className="btn-primary flex items-center gap-2">
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Importing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import {preview.totalRows} Transactions
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 'result' && result && (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-corporate-dark mb-2">Import Complete</h3>
          <div className="text-corporate-gray space-y-1 mb-6">
            <p><span className="font-semibold text-green-600">{result.imported}</span> transactions imported</p>
            {result.skipped > 0 && <p><span className="font-semibold text-orange-600">{result.skipped}</span> rows skipped (missing data)</p>}
          </div>
          <div className="flex gap-3 justify-center">
            <Link href={`/dashboard/banking/${accountId}`} className="btn-primary">
              View Transactions
            </Link>
            <button onClick={() => { setStep('upload'); setFile(null); setPreview(null); setResult(null); }} className="px-4 py-2 border border-gray-300 rounded-lg text-corporate-slate hover:bg-gray-50">
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
