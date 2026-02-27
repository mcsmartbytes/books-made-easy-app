'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface CashFlowData {
  operatingActivities: { description: string; amount: number }[];
  investingActivities: { description: string; amount: number }[];
  financingActivities: { description: string; amount: number }[];
  netOperating: number;
  netInvesting: number;
  netFinancing: number;
  netChange: number;
  beginningCash: number;
  endingCash: number;
}

export default function CashFlowPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CashFlowData>({
    operatingActivities: [],
    investingActivities: [],
    financingActivities: [],
    netOperating: 0,
    netInvesting: 0,
    netFinancing: 0,
    netChange: 0,
    beginningCash: 0,
    endingCash: 0,
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
      loadCashFlow();
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

  const loadCashFlow = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load payments received (cash inflows from customers)
    const { data: paymentsReceived } = await supabase
      .from('payments')
      .select('amount')
      .eq('user_id', session.user.id)
      .eq('type', 'received')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    // Load payments made (cash outflows to vendors)
    const { data: paymentsMade } = await supabase
      .from('payments')
      .select('amount')
      .eq('user_id', session.user.id)
      .eq('type', 'paid')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    const totalReceived = paymentsReceived?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
    const totalPaid = paymentsMade?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

    const operatingActivities = [
      { description: 'Cash received from customers', amount: totalReceived },
      { description: 'Cash paid to suppliers/vendors', amount: -totalPaid },
    ];

    const netOperating = totalReceived - totalPaid;

    // For a simple implementation, investing and financing activities would need
    // additional tracking of asset purchases, loans, etc.
    const investingActivities: { description: string; amount: number }[] = [];
    const financingActivities: { description: string; amount: number }[] = [];

    const netInvesting = 0;
    const netFinancing = 0;
    const netChange = netOperating + netInvesting + netFinancing;

    setData({
      operatingActivities,
      investingActivities,
      financingActivities,
      netOperating,
      netInvesting,
      netFinancing,
      netChange,
      beginningCash: 0, // Would need cash account tracking
      endingCash: netChange,
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
            <h1 className="text-2xl font-bold text-corporate-dark">Cash Flow Statement</h1>
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
              <p className="text-sm text-corporate-gray">Operating Cash Flow</p>
              <p className={`text-2xl font-bold ${data.netOperating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.netOperating)}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Investing Cash Flow</p>
              <p className={`text-2xl font-bold ${data.netInvesting >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.netInvesting)}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Net Cash Change</p>
              <p className={`text-2xl font-bold ${data.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.netChange)}
              </p>
            </div>
          </div>

          {/* Cash Flow Statement */}
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-6 text-center">
              Statement of Cash Flows
              <span className="block text-sm font-normal text-corporate-gray">{formatDateRange()}</span>
            </h2>

            {/* Operating Activities */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-corporate-gray uppercase tracking-wider mb-3 border-b-2 border-gray-200 pb-2">
                Cash Flows from Operating Activities
              </h3>
              <div className="space-y-2">
                {data.operatingActivities.length === 0 ? (
                  <p className="text-corporate-gray text-sm py-2">No operating activities</p>
                ) : (
                  data.operatingActivities.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-dark">{item.description}</span>
                      <span className={`font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-3 bg-green-50 px-3 rounded-lg mt-4">
                  <span className="font-semibold text-green-700">Net Cash from Operating Activities</span>
                  <span className="font-bold text-green-700">{formatCurrency(data.netOperating)}</span>
                </div>
              </div>
            </div>

            {/* Investing Activities */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-corporate-gray uppercase tracking-wider mb-3 border-b-2 border-gray-200 pb-2">
                Cash Flows from Investing Activities
              </h3>
              <div className="space-y-2">
                {data.investingActivities.length === 0 ? (
                  <p className="text-corporate-gray text-sm py-2">No investing activities recorded</p>
                ) : (
                  data.investingActivities.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-dark">{item.description}</span>
                      <span className={`font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-3 bg-blue-50 px-3 rounded-lg mt-4">
                  <span className="font-semibold text-blue-700">Net Cash from Investing Activities</span>
                  <span className="font-bold text-blue-700">{formatCurrency(data.netInvesting)}</span>
                </div>
              </div>
            </div>

            {/* Financing Activities */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-corporate-gray uppercase tracking-wider mb-3 border-b-2 border-gray-200 pb-2">
                Cash Flows from Financing Activities
              </h3>
              <div className="space-y-2">
                {data.financingActivities.length === 0 ? (
                  <p className="text-corporate-gray text-sm py-2">No financing activities recorded</p>
                ) : (
                  data.financingActivities.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-dark">{item.description}</span>
                      <span className={`font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-3 bg-purple-50 px-3 rounded-lg mt-4">
                  <span className="font-semibold text-purple-700">Net Cash from Financing Activities</span>
                  <span className="font-bold text-purple-700">{formatCurrency(data.netFinancing)}</span>
                </div>
              </div>
            </div>

            {/* Net Change */}
            <div className={`p-4 rounded-lg ${data.netChange >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <div className="flex justify-between items-center">
                <span className={`text-lg font-semibold ${data.netChange >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  Net {data.netChange >= 0 ? 'Increase' : 'Decrease'} in Cash
                </span>
                <span className={`text-2xl font-bold ${data.netChange >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  {formatCurrency(Math.abs(data.netChange))}
                </span>
              </div>
            </div>
          </div>

          {/* Cash Flow Visualization */}
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-4">Cash Flow Breakdown</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-corporate-gray">Operating</span>
                  <span className={`text-sm font-medium ${data.netOperating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(data.netOperating)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full ${data.netOperating >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.abs(data.netOperating) / (Math.abs(data.netChange) || 1) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-corporate-gray">Investing</span>
                  <span className={`text-sm font-medium ${data.netInvesting >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(data.netInvesting)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full ${data.netInvesting >= 0 ? 'bg-blue-500' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(100, Math.abs(data.netInvesting) / (Math.abs(data.netChange) || 1) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-corporate-gray">Financing</span>
                  <span className={`text-sm font-medium ${data.netFinancing >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(data.netFinancing)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full ${data.netFinancing >= 0 ? 'bg-purple-500' : 'bg-pink-500'}`}
                    style={{ width: `${Math.min(100, Math.abs(data.netFinancing) / (Math.abs(data.netChange) || 1) * 100)}%` }}
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
