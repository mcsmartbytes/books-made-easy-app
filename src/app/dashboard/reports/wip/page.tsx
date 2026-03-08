'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface WipJob {
  id: string;
  job_number: string;
  name: string;
  customer_name: string;
  status: string;
  contract_value: number;
  estimated_cost: number;
  actual_cost: number;
  percent_complete: number;
  percent_complete_cost: number;
  percent_complete_phases: number;
  revenue_recognized: number;
  billings_to_date: number;
  overbilling: number;
  underbilling: number;
  earned_revenue: number;
  remaining_backlog: number;
  gross_profit: number;
  gross_profit_margin: number;
  total_phases: number;
  completed_phases: number;
}

interface WipSummary {
  total_contract_value: number;
  total_revenue_recognized: number;
  total_billings: number;
  total_overbilling: number;
  total_underbilling: number;
  total_remaining_backlog: number;
  total_earned_revenue: number;
  total_gross_profit: number;
  total_actual_cost: number;
  total_estimated_cost: number;
  job_count: number;
  net_overbilling: number;
}

export default function WipReportPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<WipJob[]>([]);
  const [summary, setSummary] = useState<WipSummary | null>(null);
  const [method, setMethod] = useState<'cost' | 'phases'>('cost');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof WipJob>('job_number');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    loadWipData();
  }, [method, statusFilter]);

  const loadWipData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let url = `/api/reports/wip?user_id=${session.user.id}&method=${method}`;
    if (statusFilter) url += `&status=${statusFilter}`;

    try {
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        setJobs(result.data);
        setSummary(result.summary);
      }
    } catch (err) {
      console.error('Failed to load WIP data:', err);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatPercent = (pct: number) => `${pct.toFixed(1)}%`;

  const handleSort = (field: keyof WipJob) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedJobs = [...jobs].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    return sortAsc
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const SortHeader = ({ field, label, align }: { field: keyof WipJob; label: string; align?: string }) => (
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      on_hold: 'bg-yellow-100 text-yellow-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      on_hold: 'On Hold',
      cancelled: 'Cancelled',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getBillingIndicator = (job: WipJob) => {
    if (job.overbilling > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          Over
        </span>
      );
    }
    if (job.underbilling > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-red-600 font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          Under
        </span>
      );
    }
    return <span className="text-green-600 font-medium">Even</span>;
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
            <h1 className="text-2xl font-bold text-corporate-dark">Work In Progress (WIP) Report</h1>
          </div>
          <p className="text-corporate-gray mt-1 ml-8">
            Revenue recognition, overbilling/underbilling, and backlog analysis
          </p>
        </div>
        <button
          onClick={loadWipData}
          className="btn-secondary text-sm"
        >
          <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="label">Completion Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as 'cost' | 'phases')}
              className="input-field"
            >
              <option value="cost">Cost-to-Cost (Actual Cost / Estimated Cost)</option>
              <option value="phases">Phase Completion (Completed Phases / Total Phases)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Job Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              <option value="">All Jobs</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
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
                <p className="text-sm text-corporate-gray">Total Contract Value</p>
                <p className="text-xl font-bold text-corporate-dark">{formatCurrency(summary.total_contract_value)}</p>
                <p className="text-xs text-corporate-gray">{summary.job_count} job{summary.job_count !== 1 ? 's' : ''}</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Revenue Recognized</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(summary.total_revenue_recognized)}</p>
                <p className="text-xs text-corporate-gray">
                  {summary.total_contract_value > 0
                    ? formatPercent((summary.total_revenue_recognized / summary.total_contract_value) * 100)
                    : '0%'} of contract value
                </p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Remaining Backlog</p>
                <p className="text-xl font-bold text-corporate-dark">{formatCurrency(summary.total_remaining_backlog)}</p>
                <p className="text-xs text-corporate-gray">Unearned contract value</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Gross Profit</p>
                <p className={`text-xl font-bold ${summary.total_gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.total_gross_profit)}
                </p>
                <p className="text-xs text-corporate-gray">
                  {summary.total_revenue_recognized > 0
                    ? formatPercent((summary.total_gross_profit / summary.total_revenue_recognized) * 100)
                    : '0%'} margin
                </p>
              </div>
            </div>
          )}

          {/* Overbilling / Underbilling Summary Bar */}
          {summary && (summary.total_overbilling > 0 || summary.total_underbilling > 0) && (
            <div className="card">
              <h3 className="text-sm font-semibold text-corporate-dark mb-3">Billing Position</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700">Overbilled (Liability)</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(summary.total_overbilling)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-red-700">Underbilled (Asset)</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(summary.total_underbilling)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-corporate-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-corporate-gray">Net Position</p>
                    <p className={`text-lg font-bold ${summary.net_overbilling >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(summary.net_overbilling))}
                      <span className="text-xs font-normal ml-1">
                        {summary.net_overbilling >= 0 ? 'net overbilled' : 'net underbilled'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WIP Detail Table */}
          {jobs.length === 0 ? (
            <div className="card text-center py-12">
              <svg className="w-16 h-16 text-corporate-gray mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-lg font-semibold text-corporate-dark mb-2">No Jobs Found</h3>
              <p className="text-corporate-gray mb-4">Create jobs with estimated revenue and costs to see WIP calculations.</p>
              <Link href="/dashboard/jobs/new" className="btn-primary">Create a Job</Link>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortHeader field="job_number" label="Job #" />
                      <SortHeader field="name" label="Job Name" />
                      <SortHeader field="customer_name" label="Customer" />
                      <th>Status</th>
                      <SortHeader field="contract_value" label="Contract Value" align="right" />
                      <SortHeader field="percent_complete" label="% Complete" align="right" />
                      <SortHeader field="revenue_recognized" label="Revenue Recognized" align="right" />
                      <SortHeader field="billings_to_date" label="Billings to Date" align="right" />
                      <th className="text-right">Over / Under</th>
                      <SortHeader field="remaining_backlog" label="Backlog" align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedJobs.map((job) => (
                      <>
                        <tr
                          key={job.id}
                          className="cursor-pointer hover:bg-blue-50 transition-colors"
                          onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                        >
                          <td className="font-medium text-primary-600">
                            <Link href={`/dashboard/jobs/${job.id}`} onClick={(e) => e.stopPropagation()}>
                              {job.job_number}
                            </Link>
                          </td>
                          <td className="font-medium text-corporate-dark">{job.name}</td>
                          <td className="text-corporate-slate">{job.customer_name}</td>
                          <td>{getStatusBadge(job.status)}</td>
                          <td className="text-right font-medium">{formatCurrency(job.contract_value)}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    job.percent_complete >= 100 ? 'bg-green-500' :
                                    job.percent_complete >= 50 ? 'bg-blue-500' :
                                    'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(job.percent_complete, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium w-12 text-right">
                                {formatPercent(job.percent_complete)}
                              </span>
                            </div>
                          </td>
                          <td className="text-right font-medium text-green-600">{formatCurrency(job.revenue_recognized)}</td>
                          <td className="text-right font-medium">{formatCurrency(job.billings_to_date)}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {getBillingIndicator(job)}
                              <span className="text-sm">
                                {job.overbilling > 0
                                  ? formatCurrency(job.overbilling)
                                  : job.underbilling > 0
                                    ? formatCurrency(job.underbilling)
                                    : '$0.00'}
                              </span>
                            </div>
                          </td>
                          <td className="text-right font-medium text-corporate-slate">{formatCurrency(job.remaining_backlog)}</td>
                        </tr>
                        {/* Expanded detail row */}
                        {expandedJob === job.id && (
                          <tr key={`${job.id}-detail`} className="bg-blue-50/50">
                            <td colSpan={10} className="p-0">
                              <div className="p-4 border-t border-blue-100">
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                  <div>
                                    <p className="text-xs text-corporate-gray">Estimated Cost</p>
                                    <p className="font-medium text-corporate-dark">{formatCurrency(job.estimated_cost)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-corporate-gray">Actual Cost to Date</p>
                                    <p className="font-medium text-corporate-dark">{formatCurrency(job.actual_cost)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-corporate-gray">Earned Revenue</p>
                                    <p className="font-medium text-green-600">{formatCurrency(job.earned_revenue)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-corporate-gray">Gross Profit</p>
                                    <p className={`font-medium ${job.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(job.gross_profit)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-corporate-gray">Gross Margin</p>
                                    <p className={`font-medium ${job.gross_profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatPercent(job.gross_profit_margin)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-corporate-gray">Phases</p>
                                    <p className="font-medium text-corporate-dark">
                                      {job.completed_phases} / {job.total_phases} completed
                                    </p>
                                  </div>
                                </div>
                                {/* Cost vs Phase comparison */}
                                <div className="mt-3 pt-3 border-t border-blue-100">
                                  <p className="text-xs text-corporate-gray mb-2">Completion Method Comparison</p>
                                  <div className="flex gap-6">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded-full ${method === 'cost' ? 'bg-primary-600' : 'bg-gray-300'}`} />
                                      <span className="text-sm text-corporate-slate">
                                        Cost-to-Cost: <span className="font-medium">{formatPercent(job.percent_complete_cost)}</span>
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded-full ${method === 'phases' ? 'bg-primary-600' : 'bg-gray-300'}`} />
                                      <span className="text-sm text-corporate-slate">
                                        Phase-based: <span className="font-medium">{formatPercent(job.percent_complete_phases)}</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                  {/* Totals row */}
                  {summary && jobs.length > 0 && (
                    <tfoot>
                      <tr className="bg-corporate-light font-semibold border-t-2 border-corporate-dark">
                        <td colSpan={4} className="text-corporate-dark">Totals ({summary.job_count} jobs)</td>
                        <td className="text-right">{formatCurrency(summary.total_contract_value)}</td>
                        <td className="text-right">
                          {summary.total_contract_value > 0
                            ? formatPercent((summary.total_revenue_recognized / summary.total_contract_value) * 100)
                            : '0%'}
                        </td>
                        <td className="text-right text-green-600">{formatCurrency(summary.total_revenue_recognized)}</td>
                        <td className="text-right">{formatCurrency(summary.total_billings)}</td>
                        <td className="text-right">
                          <span className={summary.net_overbilling >= 0 ? 'text-amber-600' : 'text-red-600'}>
                            {formatCurrency(Math.abs(summary.net_overbilling))}
                            <span className="text-xs ml-1">{summary.net_overbilling >= 0 ? 'over' : 'under'}</span>
                          </span>
                        </td>
                        <td className="text-right">{formatCurrency(summary.total_remaining_backlog)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Method Explanation */}
          <div className="card bg-corporate-light">
            <h3 className="font-semibold text-corporate-dark mb-3">Understanding WIP Calculations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-corporate-slate">
              <div>
                <p className="font-medium text-corporate-dark mb-1">Revenue Recognized</p>
                <p>% Complete x Contract Value. The amount of revenue you&apos;ve earned based on work completed.</p>
              </div>
              <div>
                <p className="font-medium text-corporate-dark mb-1">Overbilling (Liability)</p>
                <p>When you&apos;ve billed more than you&apos;ve earned. Shows as a current liability &mdash; you owe the work.</p>
              </div>
              <div>
                <p className="font-medium text-corporate-dark mb-1">Underbilling (Asset)</p>
                <p>When you&apos;ve earned more than you&apos;ve billed. Shows as a current asset &mdash; you&apos;re owed payment.</p>
              </div>
              <div>
                <p className="font-medium text-corporate-dark mb-1">Remaining Backlog</p>
                <p>Contract Value minus Revenue Recognized. The work and revenue still ahead of you.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
