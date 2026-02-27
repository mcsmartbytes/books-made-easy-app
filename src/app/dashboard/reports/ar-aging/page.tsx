'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface AgingBucket {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

interface CustomerAging {
  id: string;
  name: string;
  email: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

interface ARAgingData {
  summary: AgingBucket;
  customers: CustomerAging[];
}

export default function ARAgingPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ARAgingData>({
    summary: { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 },
    customers: [],
  });
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadAgingData();
  }, [asOfDate]);

  const loadAgingData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load unpaid invoices with customer info
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, total, amount_paid, issue_date, due_date, status,
        customers (id, name, email)
      `)
      .eq('user_id', session.user.id)
      .in('status', ['sent', 'overdue', 'partial'])
      .lte('issue_date', asOfDate);

    if (!invoicesData) {
      setLoading(false);
      return;
    }

    const today = new Date(asOfDate);
    const customerMap = new Map<string, CustomerAging>();

    const summary: AgingBucket = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };

    invoicesData.forEach((invoice: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customerData = invoice.customers as any;
      const customer = customerData && !Array.isArray(customerData) ? customerData as { id: string; name: string; email: string } : null;
      if (!customer) return;

      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const balance = (invoice.total || 0) - (invoice.amount_paid || 0);

      if (balance <= 0) return;

      // Get or create customer entry
      let customerAging = customerMap.get(customer.id);
      if (!customerAging) {
        customerAging = {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          over90: 0,
          total: 0,
        };
        customerMap.set(customer.id, customerAging);
      }

      // Categorize by aging bucket
      if (daysOverdue <= 0) {
        customerAging.current += balance;
        summary.current += balance;
      } else if (daysOverdue <= 30) {
        customerAging.days30 += balance;
        summary.days30 += balance;
      } else if (daysOverdue <= 60) {
        customerAging.days60 += balance;
        summary.days60 += balance;
      } else if (daysOverdue <= 90) {
        customerAging.days90 += balance;
        summary.days90 += balance;
      } else {
        customerAging.over90 += balance;
        summary.over90 += balance;
      }

      customerAging.total += balance;
      summary.total += balance;
    });

    const customers = Array.from(customerMap.values()).sort((a, b) => b.total - a.total);

    setData({ summary, customers });
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getPercentage = (amount: number, total: number) => {
    if (total === 0) return 0;
    return ((amount / total) * 100).toFixed(1);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports" className="text-corporate-gray hover:text-corporate-dark">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-corporate-dark">A/R Aging Summary</h1>
            <p className="text-corporate-gray">As of {formatDate(asOfDate)}</p>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Date Selector */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label">As of Date</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="input-field"
            />
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
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Current</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(data.summary.current)}</p>
              <p className="text-xs text-corporate-gray">{getPercentage(data.summary.current, data.summary.total)}%</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">1-30 Days</p>
              <p className="text-xl font-bold text-yellow-600">{formatCurrency(data.summary.days30)}</p>
              <p className="text-xs text-corporate-gray">{getPercentage(data.summary.days30, data.summary.total)}%</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">31-60 Days</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(data.summary.days60)}</p>
              <p className="text-xs text-corporate-gray">{getPercentage(data.summary.days60, data.summary.total)}%</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">61-90 Days</p>
              <p className="text-xl font-bold text-red-500">{formatCurrency(data.summary.days90)}</p>
              <p className="text-xs text-corporate-gray">{getPercentage(data.summary.days90, data.summary.total)}%</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">90+ Days</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(data.summary.over90)}</p>
              <p className="text-xs text-corporate-gray">{getPercentage(data.summary.over90, data.summary.total)}%</p>
            </div>
            <div className="stat-card bg-primary-50">
              <p className="text-sm text-primary-700">Total A/R</p>
              <p className="text-xl font-bold text-primary-700">{formatCurrency(data.summary.total)}</p>
              <p className="text-xs text-primary-600">100%</p>
            </div>
          </div>

          {/* Aging Bar Chart */}
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-4">Aging Distribution</h2>
            <div className="flex h-8 rounded-lg overflow-hidden">
              {data.summary.total > 0 ? (
                <>
                  <div
                    className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${getPercentage(data.summary.current, data.summary.total)}%` }}
                  >
                    {Number(getPercentage(data.summary.current, data.summary.total)) > 5 && 'Current'}
                  </div>
                  <div
                    className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${getPercentage(data.summary.days30, data.summary.total)}%` }}
                  >
                    {Number(getPercentage(data.summary.days30, data.summary.total)) > 5 && '1-30'}
                  </div>
                  <div
                    className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${getPercentage(data.summary.days60, data.summary.total)}%` }}
                  >
                    {Number(getPercentage(data.summary.days60, data.summary.total)) > 5 && '31-60'}
                  </div>
                  <div
                    className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${getPercentage(data.summary.days90, data.summary.total)}%` }}
                  >
                    {Number(getPercentage(data.summary.days90, data.summary.total)) > 5 && '61-90'}
                  </div>
                  <div
                    className="bg-red-700 flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${getPercentage(data.summary.over90, data.summary.total)}%` }}
                  >
                    {Number(getPercentage(data.summary.over90, data.summary.total)) > 5 && '90+'}
                  </div>
                </>
              ) : (
                <div className="bg-gray-200 w-full flex items-center justify-center text-gray-500 text-sm">
                  No outstanding receivables
                </div>
              )}
            </div>
            <div className="flex gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span>1-30 Days</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span>31-60 Days</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>61-90 Days</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-700 rounded"></div>
                <span>90+ Days</span>
              </div>
            </div>
          </div>

          {/* Customer Detail Table */}
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-4">Customer Detail</h2>
            {data.customers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-corporate-gray mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-corporate-gray">No outstanding receivables</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th className="text-right">Current</th>
                      <th className="text-right">1-30 Days</th>
                      <th className="text-right">31-60 Days</th>
                      <th className="text-right">61-90 Days</th>
                      <th className="text-right">90+ Days</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.map((customer) => (
                      <tr key={customer.id}>
                        <td>
                          <Link href={`/dashboard/customers/${customer.id}`} className="hover:text-primary-600">
                            <p className="font-medium text-corporate-dark">{customer.name}</p>
                            <p className="text-xs text-corporate-gray">{customer.email}</p>
                          </Link>
                        </td>
                        <td className="text-right text-green-600">
                          {customer.current > 0 ? formatCurrency(customer.current) : '—'}
                        </td>
                        <td className="text-right text-yellow-600">
                          {customer.days30 > 0 ? formatCurrency(customer.days30) : '—'}
                        </td>
                        <td className="text-right text-orange-600">
                          {customer.days60 > 0 ? formatCurrency(customer.days60) : '—'}
                        </td>
                        <td className="text-right text-red-500">
                          {customer.days90 > 0 ? formatCurrency(customer.days90) : '—'}
                        </td>
                        <td className="text-right text-red-700">
                          {customer.over90 > 0 ? formatCurrency(customer.over90) : '—'}
                        </td>
                        <td className="text-right font-bold text-corporate-dark">
                          {formatCurrency(customer.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="font-semibold text-corporate-dark">Total</td>
                      <td className="text-right font-bold text-green-600">{formatCurrency(data.summary.current)}</td>
                      <td className="text-right font-bold text-yellow-600">{formatCurrency(data.summary.days30)}</td>
                      <td className="text-right font-bold text-orange-600">{formatCurrency(data.summary.days60)}</td>
                      <td className="text-right font-bold text-red-500">{formatCurrency(data.summary.days90)}</td>
                      <td className="text-right font-bold text-red-700">{formatCurrency(data.summary.over90)}</td>
                      <td className="text-right font-bold text-corporate-dark">{formatCurrency(data.summary.total)}</td>
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
