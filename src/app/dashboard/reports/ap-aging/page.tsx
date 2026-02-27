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

interface VendorAging {
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

interface APAgingData {
  summary: AgingBucket;
  vendors: VendorAging[];
}

export default function APAgingPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<APAgingData>({
    summary: { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 },
    vendors: [],
  });
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadAgingData();
  }, [asOfDate]);

  const loadAgingData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load unpaid bills with vendor info
    const { data: billsData } = await supabase
      .from('bills')
      .select(`
        id, bill_number, total, amount_paid, bill_date, due_date, status,
        vendors (id, name, email)
      `)
      .eq('user_id', session.user.id)
      .in('status', ['pending', 'overdue', 'partial'])
      .lte('bill_date', asOfDate);

    if (!billsData) {
      setLoading(false);
      return;
    }

    const today = new Date(asOfDate);
    const vendorMap = new Map<string, VendorAging>();

    const summary: AgingBucket = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };

    billsData.forEach((bill: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vendorData = bill.vendors as any;
      const vendor = vendorData && !Array.isArray(vendorData) ? vendorData as { id: string; name: string; email: string } : null;
      if (!vendor) return;

      const dueDate = new Date(bill.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const balance = (bill.total || 0) - (bill.amount_paid || 0);

      if (balance <= 0) return;

      // Get or create vendor entry
      let vendorAging = vendorMap.get(vendor.id);
      if (!vendorAging) {
        vendorAging = {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          over90: 0,
          total: 0,
        };
        vendorMap.set(vendor.id, vendorAging);
      }

      // Categorize by aging bucket
      if (daysOverdue <= 0) {
        vendorAging.current += balance;
        summary.current += balance;
      } else if (daysOverdue <= 30) {
        vendorAging.days30 += balance;
        summary.days30 += balance;
      } else if (daysOverdue <= 60) {
        vendorAging.days60 += balance;
        summary.days60 += balance;
      } else if (daysOverdue <= 90) {
        vendorAging.days90 += balance;
        summary.days90 += balance;
      } else {
        vendorAging.over90 += balance;
        summary.over90 += balance;
      }

      vendorAging.total += balance;
      summary.total += balance;
    });

    const vendors = Array.from(vendorMap.values()).sort((a, b) => b.total - a.total);

    setData({ summary, vendors });
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
            <h1 className="text-2xl font-bold text-corporate-dark">A/P Aging Summary</h1>
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
            <div className="stat-card bg-orange-50">
              <p className="text-sm text-orange-700">Total A/P</p>
              <p className="text-xl font-bold text-orange-700">{formatCurrency(data.summary.total)}</p>
              <p className="text-xs text-orange-600">100%</p>
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
                  No outstanding payables
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

          {/* Vendor Detail Table */}
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-4">Vendor Detail</h2>
            {data.vendors.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-corporate-gray mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-corporate-gray">No outstanding payables</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th className="text-right">Current</th>
                      <th className="text-right">1-30 Days</th>
                      <th className="text-right">31-60 Days</th>
                      <th className="text-right">61-90 Days</th>
                      <th className="text-right">90+ Days</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vendors.map((vendor) => (
                      <tr key={vendor.id}>
                        <td>
                          <Link href={`/dashboard/vendors/${vendor.id}`} className="hover:text-primary-600">
                            <p className="font-medium text-corporate-dark">{vendor.name}</p>
                            <p className="text-xs text-corporate-gray">{vendor.email}</p>
                          </Link>
                        </td>
                        <td className="text-right text-green-600">
                          {vendor.current > 0 ? formatCurrency(vendor.current) : '—'}
                        </td>
                        <td className="text-right text-yellow-600">
                          {vendor.days30 > 0 ? formatCurrency(vendor.days30) : '—'}
                        </td>
                        <td className="text-right text-orange-600">
                          {vendor.days60 > 0 ? formatCurrency(vendor.days60) : '—'}
                        </td>
                        <td className="text-right text-red-500">
                          {vendor.days90 > 0 ? formatCurrency(vendor.days90) : '—'}
                        </td>
                        <td className="text-right text-red-700">
                          {vendor.over90 > 0 ? formatCurrency(vendor.over90) : '—'}
                        </td>
                        <td className="text-right font-bold text-corporate-dark">
                          {formatCurrency(vendor.total)}
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

          {/* Payment Priority */}
          {data.vendors.length > 0 && (
            <div className="card bg-orange-50 border-orange-200">
              <h2 className="text-lg font-semibold text-orange-800 mb-4">Payment Priority</h2>
              <p className="text-sm text-orange-700 mb-4">
                Bills over 60 days should be prioritized to maintain good vendor relationships.
              </p>
              <div className="space-y-2">
                {data.vendors
                  .filter(v => v.days60 > 0 || v.days90 > 0 || v.over90 > 0)
                  .slice(0, 5)
                  .map(vendor => (
                    <div key={vendor.id} className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                      <span className="font-medium text-corporate-dark">{vendor.name}</span>
                      <span className="text-red-600 font-bold">
                        {formatCurrency(vendor.days60 + vendor.days90 + vendor.over90)}
                      </span>
                    </div>
                  ))}
                {data.vendors.filter(v => v.days60 > 0 || v.days90 > 0 || v.over90 > 0).length === 0 && (
                  <p className="text-orange-700 text-sm">No bills past 60 days - good job!</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
