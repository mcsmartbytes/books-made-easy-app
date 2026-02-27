'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface ReportData {
  income: { category: string; amount: number }[];
  expenses: { category: string; amount: number }[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

export default function ProfitLossReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData>({
    income: [],
    expenses: [],
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
  });
  const [dateRange, setDateRange] = useState('this-month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const dates = getDateRange(dateRange);
    setStartDate(dates.start);
    setEndDate(dates.end);
  }, [dateRange]);

  useEffect(() => {
    if (startDate && endDate) {
      loadReportData();
    }
  }, [startDate, endDate]);

  const getDateRange = (range: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    switch (range) {
      case 'this-month':
        return {
          start: new Date(year, month, 1).toISOString().split('T')[0],
          end: new Date(year, month + 1, 0).toISOString().split('T')[0],
        };
      case 'last-month':
        return {
          start: new Date(year, month - 1, 1).toISOString().split('T')[0],
          end: new Date(year, month, 0).toISOString().split('T')[0],
        };
      case 'this-quarter':
        const qStart = Math.floor(month / 3) * 3;
        return {
          start: new Date(year, qStart, 1).toISOString().split('T')[0],
          end: new Date(year, qStart + 3, 0).toISOString().split('T')[0],
        };
      case 'this-year':
        return {
          start: new Date(year, 0, 1).toISOString().split('T')[0],
          end: new Date(year, 11, 31).toISOString().split('T')[0],
        };
      case 'last-year':
        return {
          start: new Date(year - 1, 0, 1).toISOString().split('T')[0],
          end: new Date(year - 1, 11, 31).toISOString().split('T')[0],
        };
      default:
        return { start: startDate, end: endDate };
    }
  };

  const loadReportData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load invoices (income) for the period
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('total, status')
      .eq('user_id', session.user.id)
      .eq('status', 'paid')
      .gte('issue_date', startDate)
      .lte('issue_date', endDate);

    // Load bills (expenses) for the period
    const { data: billsData } = await supabase
      .from('bills')
      .select('total, status, category')
      .eq('user_id', session.user.id)
      .eq('status', 'paid')
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);

    // Group income (for now, simple totals - in production would use categories)
    const totalIncome = invoicesData?.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0) || 0;

    // Group expenses by category
    const expensesByCategory: Record<string, number> = {};
    billsData?.forEach((bill: any) => {
      const cat = bill.category || 'Other Expenses';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (bill.total || 0);
    });

    const expenses = Object.entries(expensesByCategory).map(([category, amount]) => ({
      category,
      amount,
    })).sort((a, b) => b.amount - a.amount);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    setData({
      income: [
        { category: 'Sales Revenue', amount: totalIncome },
      ],
      expenses,
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
    });
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDateRange = () => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const end = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports" className="text-corporate-gray hover:text-corporate-dark">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-corporate-dark">Profit & Loss</h1>
            <p className="text-corporate-gray">{formatDateRange()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export PDF
          </button>
          <button className="btn-secondary text-sm">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input-field"
            >
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-quarter">This Quarter</option>
              <option value="this-year">This Year</option>
              <option value="last-year">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {dateRange === 'custom' && (
            <>
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-field"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Total Income</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totalIncome)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(data.totalExpenses)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Net Income</p>
              <p className={`text-2xl font-bold ${data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.netIncome)}
              </p>
            </div>
          </div>

          {/* P&L Statement */}
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-6">
              Profit & Loss Statement
            </h2>

            {/* Income Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-corporate-gray uppercase tracking-wider mb-3">Income</h3>
              <div className="space-y-2">
                {data.income.length === 0 ? (
                  <p className="text-corporate-gray text-sm py-2">No income recorded for this period</p>
                ) : (
                  data.income.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-dark">{item.category}</span>
                      <span className="font-medium text-corporate-dark">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-3 bg-green-50 px-3 rounded-lg">
                  <span className="font-semibold text-green-700">Total Income</span>
                  <span className="font-bold text-green-700">{formatCurrency(data.totalIncome)}</span>
                </div>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-corporate-gray uppercase tracking-wider mb-3">Expenses</h3>
              <div className="space-y-2">
                {data.expenses.length === 0 ? (
                  <p className="text-corporate-gray text-sm py-2">No expenses recorded for this period</p>
                ) : (
                  data.expenses.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-dark">{item.category}</span>
                      <span className="font-medium text-corporate-dark">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-3 bg-red-50 px-3 rounded-lg">
                  <span className="font-semibold text-red-700">Total Expenses</span>
                  <span className="font-bold text-red-700">{formatCurrency(data.totalExpenses)}</span>
                </div>
              </div>
            </div>

            {/* Net Income */}
            <div className={`p-4 rounded-lg ${data.netIncome >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <div className="flex justify-between items-center">
                <span className={`text-lg font-semibold ${data.netIncome >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  Net {data.netIncome >= 0 ? 'Income' : 'Loss'}
                </span>
                <span className={`text-2xl font-bold ${data.netIncome >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  {formatCurrency(Math.abs(data.netIncome))}
                </span>
              </div>
            </div>
          </div>

          {/* Margin Analysis */}
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-4">Margin Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-corporate-gray mb-2">Gross Profit Margin</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-corporate-dark">
                    {data.totalIncome > 0 ? ((data.netIncome / data.totalIncome) * 100).toFixed(1) : 0}%
                  </span>
                  <span className="text-sm text-corporate-gray mb-1">of revenue</span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${data.netIncome >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, data.totalIncome > 0 ? (data.netIncome / data.totalIncome) * 100 : 0))}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm text-corporate-gray mb-2">Expense Ratio</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-corporate-dark">
                    {data.totalIncome > 0 ? ((data.totalExpenses / data.totalIncome) * 100).toFixed(1) : 0}%
                  </span>
                  <span className="text-sm text-corporate-gray mb-1">of revenue</span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-red-400"
                    style={{ width: `${Math.min(100, data.totalIncome > 0 ? (data.totalExpenses / data.totalIncome) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
