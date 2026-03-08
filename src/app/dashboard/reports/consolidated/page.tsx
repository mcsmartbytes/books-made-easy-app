'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface EntityFinancial {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  revenue: number;
  expenses: number;
  net_income: number;
  margin_pct: number;
  invoice_count: number;
  bill_count: number;
  expense_count: number;
  active_jobs: number;
  total_jobs: number;
  total_contract_value: number;
}

interface Summary {
  total_revenue: number;
  total_expenses: number;
  net_income: number;
  margin_pct: number;
  entity_count: number;
  intercompany_elimination: number;
  consolidated_net: number;
  total_active_jobs: number;
  total_contract_value: number;
}

interface Organization {
  id: string;
  name: string;
}

export default function ConsolidatedReportPage() {
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<EntityFinancial[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrg) loadData();
  }, [selectedOrg, startDate, endDate]);

  const loadOrganizations = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch(`/api/organizations?user_id=${session.user.id}`);
      const result = await res.json();
      if (result.success && result.data?.length > 0) {
        setOrganizations(result.data);
        setSelectedOrg(result.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let url = `/api/reports/consolidated?user_id=${session.user.id}&organization_id=${selectedOrg}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;

    try {
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        setEntities(result.data);
        setSummary(result.summary);
      }
    } catch (err) {
      console.error('Failed to load consolidated data:', err);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  const formatPct = (pct: number) => `${pct.toFixed(1)}%`;

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
            <h1 className="text-2xl font-bold text-corporate-dark">Consolidated Report</h1>
          </div>
          <p className="text-corporate-gray mt-1 ml-8">Cross-entity financial performance</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="label">Organization</label>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="input-field"
            >
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <label className="label">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="w-40">
            <label className="label">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {!selectedOrg ? (
        <div className="card text-center py-12">
          <p className="text-corporate-gray">Set up an organization with multiple entities to use consolidated reporting.</p>
          <Link href="/dashboard/settings/entities" className="btn-primary mt-4 inline-block">
            Set Up Entities
          </Link>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Total Revenue</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(summary.total_revenue)}</p>
                <p className="text-xs text-corporate-gray">{summary.entity_count} entities</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Total Expenses</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(summary.total_expenses)}</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Net Income</p>
                <p className={`text-xl font-bold ${summary.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.net_income)}
                </p>
                <p className="text-xs text-corporate-gray">Margin: {formatPct(summary.margin_pct)}</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Active Jobs</p>
                <p className="text-xl font-bold text-corporate-dark">{summary.total_active_jobs}</p>
                <p className="text-xs text-corporate-gray">{formatCurrency(summary.total_contract_value)} value</p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Consolidated Net</p>
                <p className={`text-xl font-bold ${summary.consolidated_net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.consolidated_net)}
                </p>
                {summary.intercompany_elimination > 0 && (
                  <p className="text-xs text-corporate-gray">IC elim: {formatCurrency(summary.intercompany_elimination)}</p>
                )}
              </div>
            </div>
          )}

          {/* Entity Comparison Table */}
          {entities.length > 0 ? (
            <div className="card overflow-hidden">
              <h3 className="font-semibold text-corporate-dark mb-4">Entity Performance Comparison</h3>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Entity</th>
                      <th>Type</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Expenses</th>
                      <th className="text-right">Net Income</th>
                      <th className="text-right">Margin</th>
                      <th className="text-right">Active Jobs</th>
                      <th className="text-right">Contract Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entities.map(entity => (
                      <tr key={entity.entity_id}>
                        <td className="font-medium text-corporate-dark">{entity.entity_name}</td>
                        <td>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                            {entity.entity_type}
                          </span>
                        </td>
                        <td className="text-right text-green-600 font-medium">{formatCurrency(entity.revenue)}</td>
                        <td className="text-right text-red-600 font-medium">{formatCurrency(entity.expenses)}</td>
                        <td className={`text-right font-medium ${entity.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(entity.net_income)}
                        </td>
                        <td className={`text-right ${entity.margin_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPct(entity.margin_pct)}
                        </td>
                        <td className="text-right">{entity.active_jobs}</td>
                        <td className="text-right font-medium">{formatCurrency(entity.total_contract_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {summary && (
                    <tfoot>
                      <tr className="bg-corporate-light font-semibold border-t-2 border-corporate-dark">
                        <td colSpan={2}>Consolidated Total</td>
                        <td className="text-right text-green-600">{formatCurrency(summary.total_revenue)}</td>
                        <td className="text-right text-red-600">{formatCurrency(summary.total_expenses)}</td>
                        <td className={`text-right ${summary.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(summary.net_income)}
                        </td>
                        <td className={`text-right ${summary.margin_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPct(summary.margin_pct)}
                        </td>
                        <td className="text-right">{summary.total_active_jobs}</td>
                        <td className="text-right">{formatCurrency(summary.total_contract_value)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <p className="text-corporate-gray">No entity data found. Add entities to your organization to see consolidated reporting.</p>
            </div>
          )}

          {/* Revenue Distribution Bar */}
          {entities.length > 1 && summary && summary.total_revenue > 0 && (
            <div className="card">
              <h3 className="font-semibold text-corporate-dark mb-4">Revenue Distribution</h3>
              <div className="space-y-3">
                {entities.map(entity => {
                  const pct = summary.total_revenue > 0 ? (entity.revenue / summary.total_revenue) * 100 : 0;
                  return (
                    <div key={entity.entity_id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-corporate-dark font-medium">{entity.entity_name}</span>
                        <span className="text-corporate-gray">{formatCurrency(entity.revenue)} ({formatPct(pct)})</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-primary-600 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
