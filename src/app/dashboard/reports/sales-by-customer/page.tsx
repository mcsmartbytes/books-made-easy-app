'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface CustomerSales {
  id: string;
  name: string;
  email: string;
  invoiceCount: number;
  totalSales: number;
  paidAmount: number;
  outstandingAmount: number;
}

interface SalesData {
  customers: CustomerSales[];
  totalSales: number;
  totalPaid: number;
  totalOutstanding: number;
}

export default function SalesByCustomerPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesData>({
    customers: [],
    totalSales: 0,
    totalPaid: 0,
    totalOutstanding: 0,
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
      loadSalesData();
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

  const loadSalesData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load invoices with customer info
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select(`
        id, total, amount_paid, status,
        customers (id, name, email)
      `)
      .eq('user_id', session.user.id)
      .gte('issue_date', startDate)
      .lte('issue_date', endDate);

    if (!invoicesData) {
      setLoading(false);
      return;
    }

    const customerMap = new Map<string, CustomerSales>();

    invoicesData.forEach((invoice: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customerData = invoice.customers as any;
      const customer = customerData && !Array.isArray(customerData) ? customerData as { id: string; name: string; email: string } : null;
      if (!customer) return;

      let customerSales = customerMap.get(customer.id);
      if (!customerSales) {
        customerSales = {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          invoiceCount: 0,
          totalSales: 0,
          paidAmount: 0,
          outstandingAmount: 0,
        };
        customerMap.set(customer.id, customerSales);
      }

      customerSales.invoiceCount += 1;
      customerSales.totalSales += invoice.total || 0;
      customerSales.paidAmount += invoice.amount_paid || 0;
      customerSales.outstandingAmount += (invoice.total || 0) - (invoice.amount_paid || 0);
    });

    const customers = Array.from(customerMap.values()).sort((a, b) => b.totalSales - a.totalSales);
    const totalSales = customers.reduce((sum, c) => sum + c.totalSales, 0);
    const totalPaid = customers.reduce((sum, c) => sum + c.paidAmount, 0);
    const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingAmount, 0);

    setData({ customers, totalSales, totalPaid, totalOutstanding });
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
            <h1 className="text-2xl font-bold text-corporate-dark">Sales by Customer</h1>
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Total Sales</p>
              <p className="text-2xl font-bold text-corporate-dark">{formatCurrency(data.totalSales)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Amount Collected</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totalPaid)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Outstanding</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(data.totalOutstanding)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Customers</p>
              <p className="text-2xl font-bold text-primary-600">{data.customers.length}</p>
            </div>
          </div>

          {/* Top Customers Chart */}
          {data.customers.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Top Customers</h2>
              <div className="space-y-3">
                {data.customers.slice(0, 5).map((customer, index) => (
                  <div key={customer.id}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-corporate-dark">
                        {index + 1}. {customer.name}
                      </span>
                      <span className="text-sm text-corporate-gray">
                        {formatCurrency(customer.totalSales)} ({getPercentage(customer.totalSales, data.totalSales)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-primary-500 h-3 rounded-full"
                        style={{ width: `${getPercentage(customer.totalSales, data.totalSales)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Detail Table */}
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-4">Customer Detail</h2>
            {data.customers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-corporate-gray mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-corporate-gray">No sales recorded for this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th className="text-right">Invoices</th>
                      <th className="text-right">Total Sales</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Outstanding</th>
                      <th className="text-right">% of Sales</th>
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
                        <td className="text-right text-corporate-slate">{customer.invoiceCount}</td>
                        <td className="text-right font-medium text-corporate-dark">
                          {formatCurrency(customer.totalSales)}
                        </td>
                        <td className="text-right text-green-600">
                          {formatCurrency(customer.paidAmount)}
                        </td>
                        <td className="text-right text-orange-600">
                          {formatCurrency(customer.outstandingAmount)}
                        </td>
                        <td className="text-right text-corporate-slate">
                          {getPercentage(customer.totalSales, data.totalSales)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="font-semibold text-corporate-dark">Total</td>
                      <td className="text-right font-bold text-corporate-slate">
                        {data.customers.reduce((sum, c) => sum + c.invoiceCount, 0)}
                      </td>
                      <td className="text-right font-bold text-corporate-dark">
                        {formatCurrency(data.totalSales)}
                      </td>
                      <td className="text-right font-bold text-green-600">
                        {formatCurrency(data.totalPaid)}
                      </td>
                      <td className="text-right font-bold text-orange-600">
                        {formatCurrency(data.totalOutstanding)}
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
