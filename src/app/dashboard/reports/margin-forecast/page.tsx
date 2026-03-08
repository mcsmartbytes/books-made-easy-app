'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface JobForecast {
  job_id: string;
  job_number: string;
  job_name: string;
  status: string;
  customer: { name: string; company: string } | null;
  contract_value: number;
  estimated_cost: number;
  actual_cost: number;
  billings_to_date: number;
  percent_complete: number;
  cpi: number;
  original_margin: number;
  current_margin_pct: number;
  projected_margin: number;
  projected_profit: number;
  projected_total_cost: number;
  margin_erosion: number;
  margin_health: 'healthy' | 'warning' | 'critical';
  confidence: 'high' | 'medium' | 'low';
  confidence_reason: string;
  method_used: string;
  burn_rate_trend: 'accelerating' | 'steady' | 'decelerating';
  vac: number;
}

interface Summary {
  total_contract_value: number;
  total_estimated_cost: number;
  total_actual_cost: number;
  total_projected_cost: number;
  total_projected_profit: number;
  weighted_projected_margin: number;
  weighted_original_margin: number;
  portfolio_margin_erosion: number;
  jobs_healthy: number;
  jobs_warning: number;
  jobs_critical: number;
  avg_confidence: string;
}

export default function MarginForecastPage() {
  const [loading, setLoading] = useState(true);
  const [forecasts, setForecasts] = useState<JobForecast[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sortField, setSortField] = useState<keyof JobForecast>('margin_health');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(`/api/reports/margin-forecast?user_id=${session.user.id}`);
      const result = await res.json();
      if (result.success) {
        setForecasts(result.data);
        setSummary(result.summary);
      }
    } catch (err) {
      console.error('Failed to load margin forecast data:', err);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatPct = (pct: number) => `${pct >= 0 ? '' : ''}${pct.toFixed(1)}%`;

  const handleSort = (field: keyof JobForecast) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedForecasts = [...forecasts].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
  });

  const getHealthBadge = (health: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      healthy: { bg: 'bg-green-100', text: 'text-green-700', label: 'Healthy' },
      warning: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Warning' },
      critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Critical' },
    };
    const c = config[health] || config.healthy;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
  };

  const getConfidenceBadge = (conf: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      high: { bg: 'bg-green-50', text: 'text-green-600' },
      medium: { bg: 'bg-yellow-50', text: 'text-yellow-600' },
      low: { bg: 'bg-gray-100', text: 'text-gray-500' },
    };
    const c = config[conf] || config.low;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{conf}</span>;
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'accelerating') return <span className="text-red-500" title="Costs accelerating">&#9650;</span>;
    if (trend === 'decelerating') return <span className="text-green-500" title="Costs decelerating">&#9660;</span>;
    return <span className="text-gray-400" title="Steady burn rate">&#9654;</span>;
  };

  const SortHeader = ({ field, label, align }: { field: keyof JobForecast; label: string; align?: string }) => (
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
            <h1 className="text-2xl font-bold text-corporate-dark">Margin Forecast Report</h1>
          </div>
          <p className="text-corporate-gray mt-1 ml-8">Projected margins across all active jobs with cost-to-complete analysis</p>
        </div>
        <button onClick={loadData} className="btn-secondary text-sm">
          <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Portfolio Summary */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Portfolio Value</p>
                <p className="text-xl font-bold text-corporate-dark">{formatCurrency(summary.total_contract_value)}</p>
                <p className="text-xs text-corporate-gray">{forecasts.length} active job{forecasts.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Projected Profit</p>
                <p className={`text-xl font-bold ${summary.total_projected_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.total_projected_profit)}
                </p>
                <p className="text-xs text-corporate-gray">
                  {formatPct(summary.weighted_projected_margin)} margin
                </p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Margin Erosion</p>
                <p className={`text-xl font-bold ${summary.portfolio_margin_erosion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.portfolio_margin_erosion >= 0 ? '+' : ''}{formatPct(summary.portfolio_margin_erosion)}
                </p>
                <p className="text-xs text-corporate-gray">
                  vs original {formatPct(summary.weighted_original_margin)}
                </p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Job Health</p>
                <div className="flex items-center gap-3 mt-1">
                  {summary.jobs_critical > 0 && (
                    <span className="text-sm">
                      <span className="text-red-600 font-bold">{summary.jobs_critical}</span>
                      <span className="text-corporate-gray ml-1">critical</span>
                    </span>
                  )}
                  {summary.jobs_warning > 0 && (
                    <span className="text-sm">
                      <span className="text-yellow-600 font-bold">{summary.jobs_warning}</span>
                      <span className="text-corporate-gray ml-1">warning</span>
                    </span>
                  )}
                  <span className="text-sm">
                    <span className="text-green-600 font-bold">{summary.jobs_healthy}</span>
                    <span className="text-corporate-gray ml-1">healthy</span>
                  </span>
                </div>
                <p className="text-xs text-corporate-gray mt-1">Confidence: {summary.avg_confidence}</p>
              </div>
            </div>
          )}

          {/* Forecast Table */}
          {forecasts.length === 0 ? (
            <div className="card text-center py-12">
              <svg className="w-16 h-16 text-corporate-gray mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-lg font-semibold text-corporate-dark mb-2">No Active Jobs Found</h3>
              <p className="text-corporate-gray">Create jobs with estimated revenue and cost to see margin forecasts.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortHeader field="job_number" label="Job" />
                      <th>Customer</th>
                      <th className="text-center">Health</th>
                      <SortHeader field="contract_value" label="Contract" align="right" />
                      <SortHeader field="percent_complete" label="% Done" align="right" />
                      <SortHeader field="cpi" label="CPI" align="right" />
                      <SortHeader field="original_margin" label="Est. Margin" align="right" />
                      <SortHeader field="projected_margin" label="Proj. Margin" align="right" />
                      <SortHeader field="margin_erosion" label="Erosion" align="right" />
                      <SortHeader field="projected_profit" label="Proj. Profit" align="right" />
                      <th className="text-center">Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedForecasts.map((f) => (
                      <>
                        <tr
                          key={f.job_id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedJob(expandedJob === f.job_id ? null : f.job_id)}
                        >
                          <td>
                            <div className="font-medium text-primary-600">{f.job_number}</div>
                            <div className="text-xs text-corporate-gray truncate max-w-[150px]">{f.job_name}</div>
                          </td>
                          <td className="text-sm text-corporate-slate">
                            {f.customer?.company || f.customer?.name || '—'}
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {getTrendIcon(f.burn_rate_trend)}
                              {getHealthBadge(f.margin_health)}
                            </div>
                          </td>
                          <td className="text-right font-medium">{formatCurrency(f.contract_value)}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 bg-gray-200 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full bg-primary-500"
                                  style={{ width: `${Math.min(f.percent_complete, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm w-10 text-right">{f.percent_complete.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className={`text-right font-medium ${f.cpi < 0.9 ? 'text-red-600' : f.cpi > 1.1 ? 'text-green-600' : ''}`}>
                            {f.cpi.toFixed(2)}
                          </td>
                          <td className="text-right text-corporate-slate">{formatPct(f.original_margin)}</td>
                          <td className={`text-right font-bold ${f.projected_margin < 5 ? 'text-red-600' : f.projected_margin < 15 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {formatPct(f.projected_margin)}
                          </td>
                          <td className={`text-right font-medium ${f.margin_erosion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {f.margin_erosion >= 0 ? '+' : ''}{formatPct(f.margin_erosion)}
                          </td>
                          <td className={`text-right font-medium ${f.projected_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(f.projected_profit)}
                          </td>
                          <td className="text-center">{getConfidenceBadge(f.confidence)}</td>
                        </tr>
                        {expandedJob === f.job_id && (
                          <tr key={`${f.job_id}-detail`} className="bg-gray-50">
                            <td colSpan={11} className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-corporate-gray">Estimated Cost</p>
                                  <p className="font-medium">{formatCurrency(f.estimated_cost)}</p>
                                </div>
                                <div>
                                  <p className="text-corporate-gray">Actual Cost</p>
                                  <p className="font-medium">{formatCurrency(f.actual_cost)}</p>
                                </div>
                                <div>
                                  <p className="text-corporate-gray">Projected Total Cost</p>
                                  <p className="font-medium">{formatCurrency(f.projected_total_cost)}</p>
                                </div>
                                <div>
                                  <p className="text-corporate-gray">Variance at Completion</p>
                                  <p className={`font-medium ${f.vac >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(f.vac)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-corporate-gray">Billings to Date</p>
                                  <p className="font-medium">{formatCurrency(f.billings_to_date)}</p>
                                </div>
                                <div>
                                  <p className="text-corporate-gray">Current Margin</p>
                                  <p className="font-medium">{formatPct(f.current_margin_pct)}</p>
                                </div>
                                <div>
                                  <p className="text-corporate-gray">Forecast Method</p>
                                  <p className="font-medium text-xs">{f.method_used}</p>
                                </div>
                                <div>
                                  <p className="text-corporate-gray">Confidence</p>
                                  <p className="font-medium text-xs">{f.confidence_reason}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex justify-end">
                                <Link
                                  href={`/dashboard/jobs/${f.job_id}`}
                                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                >
                                  View Job Details &rarr;
                                </Link>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                  {/* Portfolio Totals */}
                  {summary && (
                    <tfoot>
                      <tr className="bg-corporate-light font-semibold border-t-2 border-corporate-dark">
                        <td colSpan={3} className="text-corporate-dark">Portfolio Totals</td>
                        <td className="text-right">{formatCurrency(summary.total_contract_value)}</td>
                        <td></td>
                        <td></td>
                        <td className="text-right">{formatPct(summary.weighted_original_margin)}</td>
                        <td className={`text-right font-bold ${summary.weighted_projected_margin < 5 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatPct(summary.weighted_projected_margin)}
                        </td>
                        <td className={`text-right ${summary.portfolio_margin_erosion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {summary.portfolio_margin_erosion >= 0 ? '+' : ''}{formatPct(summary.portfolio_margin_erosion)}
                        </td>
                        <td className={`text-right ${summary.total_projected_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(summary.total_projected_profit)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="card bg-corporate-light">
            <h3 className="font-semibold text-corporate-dark mb-3">How to Read This Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-corporate-slate">
              <div>
                <p className="font-medium text-corporate-dark mb-1">Margin Health</p>
                <ul className="space-y-1">
                  <li><span className="text-green-600 font-medium">Healthy</span> — Projected margin within 80% of estimate</li>
                  <li><span className="text-yellow-600 font-medium">Warning</span> — Projected margin below 80% of estimate</li>
                  <li><span className="text-red-600 font-medium">Critical</span> — Projected margin below 50% of estimate or under 5%</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-corporate-dark mb-1">Key Metrics</p>
                <ul className="space-y-1">
                  <li><strong>CPI</strong> — Cost Performance Index (1.0 = on budget, &lt;1 = over budget)</li>
                  <li><strong>Erosion</strong> — Change from original estimated margin</li>
                  <li><strong>VAC</strong> — Variance at Completion (negative = projected overrun)</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
