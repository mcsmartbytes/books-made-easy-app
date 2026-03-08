'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface RetainageDetail {
  invoice_id?: string;
  invoice_number?: string;
  issue_date?: string;
  invoice_total?: number;
  bill_id?: string;
  bill_number?: string;
  bill_date?: string;
  bill_total?: number;
  retainage_percent: number;
  retainage_held: number;
  retainage_released: number;
  retainage_outstanding: number;
  days_aged: number;
  aging_bucket: string;
  customer?: { id: string; name: string; company: string } | null;
  vendor?: { id: string; name: string; company: string } | null;
  job: { id: string; job_number: string; name: string } | null;
}

interface AgingSummary {
  current: number;
  '31_60': number;
  '61_90': number;
  '91_120': number;
  over_120: number;
}

interface Summary {
  total_held: number;
  total_released: number;
  total_outstanding: number;
  invoice_count?: number;
  bill_count?: number;
  aging: AgingSummary;
}

interface JobGroup {
  job_id: string;
  job_number: string;
  job_name: string;
  outstanding: number;
  count: number;
}

interface VendorGroup {
  vendor_id: string;
  vendor_name: string;
  outstanding: number;
  count: number;
}

export default function RetainageReportPage() {
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<'receivable' | 'payable'>('receivable');
  const [details, setDetails] = useState<RetainageDetail[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byJob, setByJob] = useState<JobGroup[]>([]);
  const [byVendor, setByVendor] = useState<VendorGroup[]>([]);

  useEffect(() => {
    loadData();
  }, [reportType]);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(`/api/reports/retainage?user_id=${session.user.id}&type=${reportType}`);
      const result = await res.json();
      if (result.success) {
        setDetails(result.data);
        setSummary(result.summary);
        setByJob(result.by_job || []);
        setByVendor(result.by_vendor || []);
      }
    } catch (err) {
      console.error('Failed to load retainage data:', err);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString();

  const getAgingColor = (bucket: string) => {
    if (bucket === 'current') return 'text-green-600';
    if (bucket === '31-60') return 'text-yellow-600';
    if (bucket === '61-90') return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/dashboard/reports" className="text-corporate-gray hover:text-corporate-dark">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-corporate-dark">Retainage Report</h1>
          </div>
          <p className="text-corporate-gray mt-1 ml-8">
            {reportType === 'receivable'
              ? 'Retainage receivable — amounts withheld by customers'
              : 'Retainage payable — amounts withheld from subcontractors/vendors'}
          </p>
        </div>
        <button onClick={loadData} className="btn-secondary text-sm">
          <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Type Toggle */}
      <div className="card">
        <div className="flex gap-2">
          <button
            onClick={() => setReportType('receivable')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              reportType === 'receivable'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-corporate-gray hover:bg-gray-200'
            }`}
          >
            Retainage Receivable (A/R)
          </button>
          <button
            onClick={() => setReportType('payable')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              reportType === 'payable'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-corporate-gray hover:bg-gray-200'
            }`}
          >
            Retainage Payable (A/P)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Total Held</p>
                <p className="text-xl font-bold text-corporate-dark">{formatCurrency(summary.total_held)}</p>
                <p className="text-xs text-corporate-gray">
                  {summary.invoice_count ?? summary.bill_count ?? 0} {reportType === 'receivable' ? 'invoices' : 'bills'}
                </p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Released</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(summary.total_released)}</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Outstanding</p>
                <p className="text-xl font-bold text-amber-600">{formatCurrency(summary.total_outstanding)}</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Over 90 Days</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(summary.aging['91_120'] + summary.aging.over_120)}
                </p>
              </div>
            </div>
          )}

          {/* Aging Breakdown */}
          {summary && summary.total_outstanding > 0 && (
            <div className="card">
              <h3 className="font-semibold text-corporate-dark mb-4">Aging Breakdown</h3>
              <div className="grid grid-cols-5 gap-4">
                {[
                  { label: 'Current', value: summary.aging.current, color: 'bg-green-500' },
                  { label: '31-60 Days', value: summary.aging['31_60'], color: 'bg-yellow-500' },
                  { label: '61-90 Days', value: summary.aging['61_90'], color: 'bg-orange-500' },
                  { label: '91-120 Days', value: summary.aging['91_120'], color: 'bg-red-400' },
                  { label: '120+ Days', value: summary.aging.over_120, color: 'bg-red-600' },
                ].map(bucket => (
                  <div key={bucket.label} className="text-center">
                    <p className="text-xs text-corporate-gray mb-1">{bucket.label}</p>
                    <p className="font-bold text-corporate-dark">{formatCurrency(bucket.value)}</p>
                    {summary.total_outstanding > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${bucket.color}`}
                            style={{ width: `${(bucket.value / summary.total_outstanding) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-corporate-gray mt-1">
                          {((bucket.value / summary.total_outstanding) * 100).toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Job / By Vendor Summary */}
          {(byJob.length > 0 || byVendor.length > 0) && (
            <div className="card">
              <h3 className="font-semibold text-corporate-dark mb-4">
                {reportType === 'receivable' ? 'By Job' : 'By Vendor'}
              </h3>
              <div className="space-y-2">
                {reportType === 'receivable'
                  ? byJob.sort((a, b) => b.outstanding - a.outstanding).map(j => (
                      <div key={j.job_id} className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <span className="font-medium text-primary-600">{j.job_number}</span>
                          <span className="text-corporate-slate ml-2">{j.job_name}</span>
                          <span className="text-xs text-corporate-gray ml-2">({j.count} invoice{j.count !== 1 ? 's' : ''})</span>
                        </div>
                        <span className="font-medium text-amber-600">{formatCurrency(j.outstanding)}</span>
                      </div>
                    ))
                  : byVendor.sort((a, b) => b.outstanding - a.outstanding).map(v => (
                      <div key={v.vendor_id} className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <span className="font-medium text-corporate-dark">{v.vendor_name}</span>
                          <span className="text-xs text-corporate-gray ml-2">({v.count} bill{v.count !== 1 ? 's' : ''})</span>
                        </div>
                        <span className="font-medium text-amber-600">{formatCurrency(v.outstanding)}</span>
                      </div>
                    ))
                }
              </div>
            </div>
          )}

          {/* Detail Table */}
          {details.length === 0 ? (
            <div className="card text-center py-12">
              <svg className="w-16 h-16 text-corporate-gray mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-corporate-dark mb-2">No Retainage Found</h3>
              <p className="text-corporate-gray">
                {reportType === 'receivable'
                  ? 'No invoices with retainage withheld. Add retainage % when creating invoices.'
                  : 'No bills with retainage withheld. Add retainage % when entering bills.'}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{reportType === 'receivable' ? 'Invoice' : 'Bill'} #</th>
                      <th>Date</th>
                      <th>{reportType === 'receivable' ? 'Customer' : 'Vendor'}</th>
                      <th>Job</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Ret. %</th>
                      <th className="text-right">Held</th>
                      <th className="text-right">Released</th>
                      <th className="text-right">Outstanding</th>
                      <th className="text-center">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d, i) => (
                      <tr key={i}>
                        <td className="font-medium text-primary-600">
                          {d.invoice_number || d.bill_number || '—'}
                        </td>
                        <td className="text-sm">{formatDate(d.issue_date || d.bill_date || '')}</td>
                        <td className="text-sm text-corporate-slate">
                          {reportType === 'receivable'
                            ? (d.customer?.company || d.customer?.name || '—')
                            : (d.vendor?.company || d.vendor?.name || '—')}
                        </td>
                        <td className="text-sm">
                          {d.job ? (
                            <Link href={`/dashboard/jobs/${d.job.id}`} className="text-primary-600 hover:text-primary-700">
                              {d.job.job_number}
                            </Link>
                          ) : '—'}
                        </td>
                        <td className="text-right">{formatCurrency(d.invoice_total || d.bill_total || 0)}</td>
                        <td className="text-right">{d.retainage_percent}%</td>
                        <td className="text-right">{formatCurrency(d.retainage_held)}</td>
                        <td className="text-right text-green-600">{formatCurrency(d.retainage_released)}</td>
                        <td className="text-right font-medium text-amber-600">{formatCurrency(d.retainage_outstanding)}</td>
                        <td className={`text-center text-sm font-medium ${getAgingColor(d.aging_bucket)}`}>
                          {d.days_aged}d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {summary && (
                    <tfoot>
                      <tr className="bg-corporate-light font-semibold border-t-2 border-corporate-dark">
                        <td colSpan={6}>Totals</td>
                        <td className="text-right">{formatCurrency(summary.total_held)}</td>
                        <td className="text-right text-green-600">{formatCurrency(summary.total_released)}</td>
                        <td className="text-right text-amber-600">{formatCurrency(summary.total_outstanding)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="card bg-corporate-light">
            <h3 className="font-semibold text-corporate-dark mb-3">About Retainage</h3>
            <div className="text-sm text-corporate-slate space-y-1">
              <p>Retainage (typically 5-10%) is withheld from progress payments until project completion or substantial completion.</p>
              {reportType === 'receivable' ? (
                <p><strong>Receivable:</strong> Amounts your customers are holding back from your invoices. This is an asset on your balance sheet.</p>
              ) : (
                <p><strong>Payable:</strong> Amounts you are holding back from subcontractor/vendor bills. This is a liability on your balance sheet.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
