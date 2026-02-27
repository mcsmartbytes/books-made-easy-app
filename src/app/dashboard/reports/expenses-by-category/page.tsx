'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface CategoryExpense {
  category: string;
  billCount: number;
  totalAmount: number;
}

interface ExpensesData {
  categories: CategoryExpense[];
  totalExpenses: number;
}

export default function ExpensesByCategoryPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExpensesData>({
    categories: [],
    totalExpenses: 0,
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
      loadExpensesData();
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
      default:
        return { start: startDate, end: endDate };
    }
  };

  const loadExpensesData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load bills with category
    const { data: billsData } = await supabase
      .from('bills')
      .select('id, total, category')
      .eq('user_id', session.user.id)
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);

    if (!billsData) {
      setLoading(false);
      return;
    }

    const categoryMap = new Map<string, CategoryExpense>();

    billsData.forEach((bill: any) => {
      const category = bill.category || 'Uncategorized';

      let categoryExpense = categoryMap.get(category);
      if (!categoryExpense) {
        categoryExpense = {
          category,
          billCount: 0,
          totalAmount: 0,
        };
        categoryMap.set(category, categoryExpense);
      }

      categoryExpense.billCount += 1;
      categoryExpense.totalAmount += bill.total || 0;
    });

    const categories = Array.from(categoryMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const totalExpenses = categories.reduce((sum, c) => sum + c.totalAmount, 0);

    setData({ categories, totalExpenses });
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

  const getPercentage = (amount: number, total: number) => {
    if (total === 0) return 0;
    return ((amount / total) * 100).toFixed(1);
  };

  // Colors for the pie chart
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500',
    'bg-pink-500', 'bg-indigo-500', 'bg-orange-500', 'bg-teal-500', 'bg-cyan-500',
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports" className="text-corporate-gray hover:text-corporate-dark">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-corporate-dark">Expenses by Category</h1>
            <p className="text-corporate-gray">{formatDateRange()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
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
          {/* Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Total Expenses</p>
              <p className="text-2xl font-bold text-corporate-dark">{formatCurrency(data.totalExpenses)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Categories</p>
              <p className="text-2xl font-bold text-primary-600">{data.categories.length}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Avg per Category</p>
              <p className="text-2xl font-bold text-corporate-dark">
                {formatCurrency(data.categories.length > 0 ? data.totalExpenses / data.categories.length : 0)}
              </p>
            </div>
          </div>

          {/* Visual Breakdown */}
          {data.categories.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Category Breakdown</h2>

              {/* Horizontal Bar Chart */}
              <div className="space-y-4">
                {data.categories.map((category, index) => (
                  <div key={category.category}>
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${colors[index % colors.length]}`}></div>
                        <span className="text-sm font-medium text-corporate-dark">{category.category}</span>
                      </div>
                      <span className="text-sm text-corporate-gray">
                        {formatCurrency(category.totalAmount)} ({getPercentage(category.totalAmount, data.totalExpenses)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full ${colors[index % colors.length]}`}
                        style={{ width: `${getPercentage(category.totalAmount, data.totalExpenses)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-200">
                {data.categories.slice(0, 10).map((category, index) => (
                  <div key={category.category} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${colors[index % colors.length]}`}></div>
                    <span className="text-xs text-corporate-gray">{category.category}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Detail Table */}
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-4">Category Detail</h2>
            {data.categories.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-corporate-gray mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-corporate-gray">No expenses recorded for this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className="text-right">Bills</th>
                      <th className="text-right">Total Amount</th>
                      <th className="text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories.map((category, index) => (
                      <tr key={category.category}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded ${colors[index % colors.length]}`}></div>
                            <span className="font-medium text-corporate-dark">{category.category}</span>
                          </div>
                        </td>
                        <td className="text-right text-corporate-slate">{category.billCount}</td>
                        <td className="text-right font-medium text-corporate-dark">
                          {formatCurrency(category.totalAmount)}
                        </td>
                        <td className="text-right text-corporate-slate">
                          {getPercentage(category.totalAmount, data.totalExpenses)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="font-semibold text-corporate-dark">Total</td>
                      <td className="text-right font-bold text-corporate-slate">
                        {data.categories.reduce((sum, c) => sum + c.billCount, 0)}
                      </td>
                      <td className="text-right font-bold text-corporate-dark">
                        {formatCurrency(data.totalExpenses)}
                      </td>
                      <td className="text-right font-bold text-corporate-slate">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
