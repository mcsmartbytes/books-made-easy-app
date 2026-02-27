'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface ColumnConfig {
  field: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'status';
}

interface FilterConfig {
  field: string;
  operator: string;
  value: string;
  value2?: string;
}

interface CustomReport {
  id: string;
  name: string;
  description: string;
  data_source: string;
  columns: ColumnConfig[];
  filters: FilterConfig[];
  sort_by: string | null;
  sort_order: 'asc' | 'desc';
  is_favorite: boolean;
}

export default function RunCustomReportPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<CustomReport | null>(null);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    loadReport();
  }, [params.id]);

  const loadReport = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('custom_reports')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !data) {
      router.push('/dashboard/reports/custom');
      return;
    }

    setReport(data);
    setLoading(false);
  };

  const runReport = async () => {
    if (!report) return;

    setRunning(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any;
    const source = report.data_source;

    // Build query based on data source
    switch (source) {
      case 'invoices':
        query = supabase
          .from('invoices')
          .select(`
            id, invoice_number, issue_date, due_date, total, amount_paid, status,
            customers (name)
          `)
          .eq('user_id', session.user.id);
        break;

      case 'bills':
        query = supabase
          .from('bills')
          .select(`
            id, bill_number, bill_date, due_date, total, amount_paid, status, category,
            vendors (name)
          `)
          .eq('user_id', session.user.id);
        break;

      case 'payments':
        query = supabase
          .from('payments')
          .select('*')
          .eq('user_id', session.user.id);
        break;

      case 'customers':
        query = supabase
          .from('customers')
          .select('*')
          .eq('user_id', session.user.id);
        break;

      case 'vendors':
        query = supabase
          .from('vendors')
          .select('*')
          .eq('user_id', session.user.id);
        break;

      case 'products':
        query = supabase
          .from('products')
          .select('*')
          .eq('user_id', session.user.id);
        break;

      case 'jobs':
        query = supabase
          .from('jobs')
          .select(`
            id, job_number, name, start_date, end_date, budget, actual_cost, actual_revenue, status,
            customers (name)
          `)
          .eq('user_id', session.user.id);
        break;

      case 'journal_entries':
        query = supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', session.user.id);
        break;

      default:
        setRunning(false);
        return;
    }

    // Apply date range filter if dates are provided
    if (dateRange.start && dateRange.end) {
      const dateField = getDateField(source);
      if (dateField) {
        query = query.gte(dateField, dateRange.start).lte(dateField, dateRange.end);
      }
    }

    // Apply custom filters
    report.filters.forEach(filter => {
      if (filter.operator === 'is_empty') {
        query = query.is(filter.field, null);
      } else if (filter.operator === 'is_not_empty') {
        query = query.not(filter.field, 'is', null);
      } else if (filter.operator === 'equals') {
        query = query.eq(filter.field, filter.value);
      } else if (filter.operator === 'contains') {
        query = query.ilike(filter.field, `%${filter.value}%`);
      } else if (filter.operator === 'greater_than') {
        query = query.gt(filter.field, filter.value);
      } else if (filter.operator === 'less_than') {
        query = query.lt(filter.field, filter.value);
      } else if (filter.operator === 'between' && filter.value2) {
        query = query.gte(filter.field, filter.value).lte(filter.field, filter.value2);
      }
    });

    // Apply sorting
    if (report.sort_by) {
      query = query.order(report.sort_by, { ascending: report.sort_order === 'asc' });
    }

    const { data: queryData, error } = await query;

    if (error) {
      console.error('Error running report:', error);
      setRunning(false);
      return;
    }

    // Transform data to include computed fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedData = (queryData || []).map((row: any) => {
      const transformed: Record<string, unknown> = { ...row };

      // Handle joined tables
      if (source === 'invoices' || source === 'jobs') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const customer = (row as any).customers;
        transformed.customer_name = customer?.name || 'N/A';
      }
      if (source === 'bills') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vendor = (row as any).vendors;
        transformed.vendor_name = vendor?.name || 'N/A';
      }

      // Compute balance
      if ('total' in row && 'amount_paid' in row) {
        transformed.balance = ((row.total as number) || 0) - ((row.amount_paid as number) || 0);
      }

      return transformed;
    });

    setResults(transformedData);

    // Update last_run_at
    await supabase
      .from('custom_reports')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', report.id);

    setRunning(false);
  };

  const getDateField = (source: string): string | null => {
    const dateFields: Record<string, string> = {
      invoices: 'issue_date',
      bills: 'bill_date',
      payments: 'payment_date',
      jobs: 'start_date',
      journal_entries: 'entry_date',
    };
    return dateFields[source] || null;
  };

  const formatValue = (value: unknown, type: string): string => {
    if (value === null || value === undefined) return '—';

    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value as number);
      case 'date':
        return new Date(value as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      case 'status':
        return String(value).charAt(0).toUpperCase() + String(value).slice(1);
      default:
        return String(value);
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    const statusClasses: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      sent: 'bg-blue-100 text-blue-700',
      draft: 'bg-gray-100 text-gray-700',
      overdue: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
      partial: 'bg-orange-100 text-orange-700',
      active: 'bg-green-100 text-green-700',
      completed: 'bg-blue-100 text-blue-700',
      cancelled: 'bg-red-100 text-red-700',
      posted: 'bg-green-100 text-green-700',
    };
    return statusClasses[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const exportCSV = () => {
    if (!report || results.length === 0) return;

    const headers = report.columns.map(c => c.label).join(',');
    const rows = results.map(row =>
      report.columns.map(col => {
        const value = row[col.field];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
        return String(value);
      }).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports/custom" className="text-corporate-gray hover:text-corporate-dark">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-corporate-dark">{report.name}</h1>
            {report.description && (
              <p className="text-corporate-gray">{report.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/reports/custom/${report.id}/edit`} className="btn-secondary text-sm">
            Edit Report
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          {getDateField(report.data_source) && (
            <>
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="input-field"
                />
              </div>
            </>
          )}
          <button
            onClick={runReport}
            disabled={running}
            className="btn-primary"
          >
            {running ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Report
              </>
            )}
          </button>
          {results.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          )}
        </div>

        {report.filters.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-corporate-gray">
              <span className="font-medium">Active Filters:</span>{' '}
              {report.filters.map((f, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs mr-2">
                  {f.field} {f.operator} {f.value}
                </span>
              ))}
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-corporate-dark">
              Results ({results.length} records)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {report.columns.map(col => (
                    <th key={col.field} className={col.type === 'currency' || col.type === 'number' ? 'text-right' : ''}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => (
                  <tr key={index}>
                    {report.columns.map(col => (
                      <td
                        key={col.field}
                        className={col.type === 'currency' || col.type === 'number' ? 'text-right' : ''}
                      >
                        {col.type === 'status' ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(String(row[col.field] || ''))}`}>
                            {formatValue(row[col.field], col.type)}
                          </span>
                        ) : (
                          formatValue(row[col.field], col.type)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary for currency columns */}
          {report.columns.some(c => c.type === 'currency') && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-corporate-gray mb-3">Totals</h3>
              <div className="flex flex-wrap gap-6">
                {report.columns.filter(c => c.type === 'currency').map(col => {
                  const total = results.reduce((sum, row) => sum + (Number(row[col.field]) || 0), 0);
                  return (
                    <div key={col.field}>
                      <p className="text-xs text-corporate-gray">{col.label}</p>
                      <p className="text-lg font-bold text-corporate-dark">
                        {formatValue(total, 'currency')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : !running ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-corporate-gray mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-corporate-dark mb-2">Ready to Run</h3>
          <p className="text-corporate-gray mb-6">
            Click &quot;Run Report&quot; to generate your results
          </p>
        </div>
      ) : null}
    </div>
  );
}
