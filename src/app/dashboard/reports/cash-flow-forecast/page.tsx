'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface WeekBucket {
  week_start: string;
  week_end: string;
  label: string;
  inflows: number;
  outflows: number;
  retainage_receivable_release: number;
  retainage_payable_release: number;
  net: number;
  cumulative: number;
}

interface Summary {
  period_weeks: number;
  start_date: string;
  end_date: string;
  total_projected_inflows: number;
  total_projected_outflows: number;
  net_cash_flow: number;
  lowest_cumulative: number;
  lowest_week: string | null;
  negative_weeks: number;
  retainage_receivable_pending: number;
  retainage_payable_pending: number;
  cash_flow_health: 'healthy' | 'caution' | 'critical';
  jobs_count: number;
}

interface Job {
  id: string;
  job_number: string;
  name: string;
}

export default function CashFlowForecastPage() {
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WeekBucket[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [weeksAhead, setWeeksAhead] = useState(12);

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedJob, weeksAhead]);

  const loadJobs = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch(`/api/jobs?user_id=${session.user.id}`);
      const result = await res.json();
      if (result.success) setJobs(result.data || []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let url = `/api/reports/cash-flow-forecast?user_id=${session.user.id}&weeks=${weeksAhead}`;
    if (selectedJob) url += `&job_id=${selectedJob}`;

    try {
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        setWeeks(result.data);
        setSummary(result.summary);
      }
    } catch (err) {
      console.error('Failed to load cash flow data:', err);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getHealthBadge = (health: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      healthy: { bg: 'bg-green-100', text: 'text-green-700', label: 'Healthy' },
      caution: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Caution' },
      critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Critical' },
    };
    const c = config[health] || config.healthy;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
  };

  // Find max value for bar chart scaling
  const maxVal = Math.max(
    ...weeks.map(w => Math.max(w.inflows, w.outflows, Math.abs(w.cumulative))),
    1
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
            <h1 className="text-2xl font-bold text-corporate-dark">Cash Flow Forecast</h1>
          </div>
          <p className="text-corporate-gray mt-1 ml-8">Projected cash inflows and outflows by week</p>
        </div>
        <button onClick={loadData} className="btn-secondary text-sm">
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
              <option value="">All Jobs (Company-wide)</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>{job.job_number} — {job.name}</option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <label className="label">Forecast Period</label>
            <select
              value={weeksAhead}
              onChange={(e) => setWeeksAhead(Number(e.target.value))}
              className="input-field"
            >
              <option value={4}>4 Weeks</option>
              <option value={8}>8 Weeks</option>
              <option value={12}>12 Weeks</option>
              <option value={16}>16 Weeks</option>
              <option value={26}>26 Weeks</option>
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
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Projected Inflows</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(summary.total_projected_inflows)}</p>
                <p className="text-xs text-corporate-gray">{summary.period_weeks} week forecast</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Projected Outflows</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(summary.total_projected_outflows)}</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Net Cash Flow</p>
                <p className={`text-xl font-bold ${summary.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.net_cash_flow)}
                </p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Lowest Point</p>
                <p className={`text-xl font-bold ${summary.lowest_cumulative >= 0 ? 'text-corporate-dark' : 'text-red-600'}`}>
                  {formatCurrency(summary.lowest_cumulative)}
                </p>
                <p className="text-xs text-corporate-gray">{summary.lowest_week || '—'}</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Health</p>
                <div className="mt-1">{getHealthBadge(summary.cash_flow_health)}</div>
                {summary.retainage_receivable_pending > 0 && (
                  <p className="text-xs text-corporate-gray mt-1">
                    Ret. pending: {formatCurrency(summary.retainage_receivable_pending)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Visual Cash Flow Chart (simplified bar chart) */}
          {weeks.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-corporate-dark mb-4">Weekly Cash Flow</h3>
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  {/* Chart */}
                  <div className="flex items-end gap-1 h-48 mb-2">
                    {weeks.map((week, i) => {
                      const inflowH = maxVal > 0 ? (week.inflows / maxVal) * 100 : 0;
                      const outflowH = maxVal > 0 ? (week.outflows / maxVal) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${week.label}: In ${formatCurrency(week.inflows)}, Out ${formatCurrency(week.outflows)}`}>
                          <div className="w-full flex gap-0.5 items-end" style={{ height: '100%' }}>
                            <div
                              className="flex-1 bg-green-400 rounded-t"
                              style={{ height: `${inflowH}%`, minHeight: week.inflows > 0 ? '2px' : '0' }}
                            />
                            <div
                              className="flex-1 bg-red-400 rounded-t"
                              style={{ height: `${outflowH}%`, minHeight: week.outflows > 0 ? '2px' : '0' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Cumulative line (simplified as text below bars) */}
                  <div className="flex gap-1">
                    {weeks.map((week, i) => (
                      <div key={i} className="flex-1 text-center">
                        <p className={`text-[10px] font-medium ${week.cumulative >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(week.cumulative)}
                        </p>
                        <p className="text-[9px] text-corporate-gray mt-0.5">
                          {formatDate(week.week_start)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex gap-4 mt-3 text-xs text-corporate-gray">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded inline-block" /> Inflows</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded inline-block" /> Outflows</span>
                    <span>Cumulative shown below bars</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detail Table */}
          {weeks.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Period</th>
                      <th className="text-right">Inflows</th>
                      <th className="text-right">Outflows</th>
                      <th className="text-right">Net</th>
                      <th className="text-right">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((week, i) => (
                      <tr key={i} className={week.cumulative < 0 ? 'bg-red-50' : ''}>
                        <td className="font-medium text-corporate-dark">{week.label}</td>
                        <td className="text-sm text-corporate-gray">
                          {formatDate(week.week_start)} — {formatDate(week.week_end)}
                        </td>
                        <td className="text-right text-green-600 font-medium">{formatCurrency(week.inflows)}</td>
                        <td className="text-right text-red-600 font-medium">{formatCurrency(week.outflows)}</td>
                        <td className={`text-right font-medium ${week.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(week.net)}
                        </td>
                        <td className={`text-right font-bold ${week.cumulative >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(week.cumulative)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {summary && (
                    <tfoot>
                      <tr className="bg-corporate-light font-semibold border-t-2 border-corporate-dark">
                        <td colSpan={2}>Totals</td>
                        <td className="text-right text-green-600">{formatCurrency(summary.total_projected_inflows)}</td>
                        <td className="text-right text-red-600">{formatCurrency(summary.total_projected_outflows)}</td>
                        <td className={`text-right ${summary.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(summary.net_cash_flow)}
                        </td>
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
            <h3 className="font-semibold text-corporate-dark mb-3">Forecast Methodology</h3>
            <div className="text-sm text-corporate-slate space-y-1">
              <p><strong>Inflows:</strong> Based on outstanding invoice due dates. Overdue invoices placed in current week.</p>
              <p><strong>Outflows:</strong> Outstanding bills by due date + projected burn rate for uncommitted job costs.</p>
              <p><strong>Retainage:</strong> Pending retainage releases estimated in the final quarter of the forecast period.</p>
              <p><strong>Burn Rate:</strong> Uncommitted remaining costs spread evenly across estimated remaining project duration.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
