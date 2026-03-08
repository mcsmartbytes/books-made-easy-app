'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface CostCodeVariance {
  cost_code_id: string;
  code: string;
  division: string;
  name: string;
  budget: number;
  actual: number;
  variance: number;
  variance_pct: number;
  percent_complete: number;
  trend: 'under' | 'on_track' | 'over' | 'critical';
  bill_count: number;
  expense_count: number;
  remaining: number;
}

interface Summary {
  total_budget: number;
  total_actual: number;
  total_variance: number;
  total_variance_pct: number;
  codes_over_budget: number;
  codes_on_track: number;
  codes_under_budget: number;
  overall_trend: string;
}

interface Job {
  id: string;
  job_number: string;
  name: string;
}

export default function CostCodeVariancePage() {
  const [loading, setLoading] = useState(true);
  const [variances, setVariances] = useState<CostCodeVariance[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [sortField, setSortField] = useState<keyof CostCodeVariance>('code');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    loadVarianceData();
  }, [selectedJob]);

  const loadJobs = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(`/api/jobs?user_id=${session.user.id}`);
      const result = await res.json();
      if (result.success) {
        setJobs(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

  const loadVarianceData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let url = `/api/reports/cost-code-variance?user_id=${session.user.id}`;
    if (selectedJob) url += `&job_id=${selectedJob}`;

    try {
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        setVariances(result.data);
        setSummary(result.summary);
      }
    } catch (err) {
      console.error('Failed to load variance data:', err);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const handleSort = (field: keyof CostCodeVariance) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedVariances = [...variances].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
  });

  const getTrendBadge = (trend: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      under: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Under Budget' },
      on_track: { bg: 'bg-green-100', text: 'text-green-700', label: 'On Track' },
      over: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Near Limit' },
      critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Over Budget' },
    };
    const c = config[trend] || config.on_track;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'critical') return <span className="text-red-500">&#9650;</span>;
    if (trend === 'over') return <span className="text-yellow-500">&#9650;</span>;
    if (trend === 'under') return <span className="text-blue-500">&#9660;</span>;
    return <span className="text-green-500">&#9654;</span>;
  };

  const SortHeader = ({ field, label, align }: { field: keyof CostCodeVariance; label: string; align?: string }) => (
    <th
      className={`cursor-pointer hover:text-primary-600 select-none ${align === 'right' ? 'text-right' : ''}`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d={sortAsc ? 'M5 10l5-5 5 5H5z' : 'M5 10l5 5 5-5H5z'} />
          </svg>
        )}
      </span>
    </th>
  );

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
            <h1 className="text-2xl font-bold text-corporate-dark">Cost Code Variance Report</h1>
          </div>
          <p className="text-corporate-gray mt-1 ml-8">Budget vs actual spending by CSI cost code</p>
        </div>
        <button onClick={loadVarianceData} className="btn-secondary text-sm">
          <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="label">Job / Project</label>
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="input-field"
            >
              <option value="">All Jobs (Combined)</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>{job.job_number} — {job.name}</option>
              ))}
            </select>
          </div>
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
                <p className="text-sm text-corporate-gray">Total Budget</p>
                <p className="text-xl font-bold text-corporate-dark">{formatCurrency(summary.total_budget)}</p>
                <p className="text-xs text-corporate-gray">{variances.length} cost code{variances.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Total Actual</p>
                <p className="text-xl font-bold text-corporate-dark">{formatCurrency(summary.total_actual)}</p>
                <p className="text-xs text-corporate-gray">
                  {summary.total_budget > 0
                    ? `${((summary.total_actual / summary.total_budget) * 100).toFixed(1)}% of budget`
                    : '—'}
                </p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Total Variance</p>
                <p className={`text-xl font-bold ${summary.total_variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(summary.total_variance))}
                </p>
                <p className={`text-xs ${summary.total_variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.total_variance >= 0 ? 'Under budget' : 'Over budget'}
                  {summary.total_variance_pct !== 0 && ` (${Math.abs(summary.total_variance_pct).toFixed(1)}%)`}
                </p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Trend Overview</p>
                <div className="flex items-center gap-3 mt-1">
                  {summary.codes_over_budget > 0 && (
                    <span className="text-sm">
                      <span className="text-red-600 font-bold">{summary.codes_over_budget}</span>
                      <span className="text-corporate-gray ml-1">over</span>
                    </span>
                  )}
                  <span className="text-sm">
                    <span className="text-green-600 font-bold">{summary.codes_on_track}</span>
                    <span className="text-corporate-gray ml-1">on track</span>
                  </span>
                  {summary.codes_under_budget > 0 && (
                    <span className="text-sm">
                      <span className="text-blue-600 font-bold">{summary.codes_under_budget}</span>
                      <span className="text-corporate-gray ml-1">under</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Variance Table */}
          {variances.length === 0 ? (
            <div className="card text-center py-12">
              <svg className="w-16 h-16 text-corporate-gray mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <h3 className="text-lg font-semibold text-corporate-dark mb-2">No Cost Code Budgets Found</h3>
              <p className="text-corporate-gray mb-4">
                Assign cost code budgets to your jobs to see variance tracking.
                {selectedJob && ' Try selecting "All Jobs" or a different project.'}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortHeader field="code" label="Code" />
                      <SortHeader field="name" label="Cost Code" />
                      <th className="text-center">Trend</th>
                      <SortHeader field="budget" label="Budget" align="right" />
                      <SortHeader field="actual" label="Actual" align="right" />
                      <SortHeader field="variance" label="Variance" align="right" />
                      <SortHeader field="percent_complete" label="% Used" align="right" />
                      <SortHeader field="remaining" label="Remaining" align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVariances.map((v) => (
                      <tr key={v.cost_code_id}>
                        <td className="font-mono text-sm font-medium text-primary-600">{v.code}</td>
                        <td>
                          <div className="font-medium text-corporate-dark">{v.name}</div>
                          <div className="text-xs text-corporate-gray">
                            {v.bill_count} bill{v.bill_count !== 1 ? 's' : ''}, {v.expense_count} expense{v.expense_count !== 1 ? 's' : ''}
                          </div>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getTrendIcon(v.trend)}
                            {getTrendBadge(v.trend)}
                          </div>
                        </td>
                        <td className="text-right font-medium">{formatCurrency(v.budget)}</td>
                        <td className="text-right font-medium">{formatCurrency(v.actual)}</td>
                        <td className={`text-right font-medium ${v.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {v.variance >= 0 ? '' : '-'}{formatCurrency(Math.abs(v.variance))}
                          <span className="text-xs ml-1">({Math.abs(v.variance_pct).toFixed(1)}%)</span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  v.percent_complete > 100 ? 'bg-red-500' :
                                  v.percent_complete > 90 ? 'bg-yellow-500' :
                                  v.percent_complete > 50 ? 'bg-blue-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(v.percent_complete, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm w-12 text-right">{v.percent_complete.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="text-right font-medium text-corporate-slate">{formatCurrency(v.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals */}
                  {summary && (
                    <tfoot>
                      <tr className="bg-corporate-light font-semibold border-t-2 border-corporate-dark">
                        <td colSpan={3} className="text-corporate-dark">Totals</td>
                        <td className="text-right">{formatCurrency(summary.total_budget)}</td>
                        <td className="text-right">{formatCurrency(summary.total_actual)}</td>
                        <td className={`text-right ${summary.total_variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {summary.total_variance >= 0 ? '' : '-'}{formatCurrency(Math.abs(summary.total_variance))}
                        </td>
                        <td className="text-right">
                          {summary.total_budget > 0
                            ? `${((summary.total_actual / summary.total_budget) * 100).toFixed(0)}%`
                            : '—'}
                        </td>
                        <td className="text-right">
                          {formatCurrency(Math.max(summary.total_budget - summary.total_actual, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="card bg-corporate-light">
            <h3 className="font-semibold text-corporate-dark mb-3">Trend Indicators</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {getTrendBadge('under')}
                <span className="text-corporate-slate">Less than 50% of budget used</span>
              </div>
              <div className="flex items-center gap-2">
                {getTrendBadge('on_track')}
                <span className="text-corporate-slate">50-90% of budget used</span>
              </div>
              <div className="flex items-center gap-2">
                {getTrendBadge('over')}
                <span className="text-corporate-slate">Over 90% of budget used</span>
              </div>
              <div className="flex items-center gap-2">
                {getTrendBadge('critical')}
                <span className="text-corporate-slate">Exceeded budget</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
