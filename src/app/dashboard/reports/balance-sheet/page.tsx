'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
}

interface BalanceSheetData {
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export default function BalanceSheetPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BalanceSheetData>({
    assets: [],
    liabilities: [],
    equity: [],
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
  });
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadBalanceSheet();
  }, [asOfDate]);

  const loadBalanceSheet = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load chart of accounts
    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('code');

    if (!accountsData) {
      setLoading(false);
      return;
    }

    // Load paid invoices (income increases retained earnings)
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('total')
      .eq('user_id', session.user.id)
      .eq('status', 'paid')
      .lte('issue_date', asOfDate);

    // Load paid bills (expenses decrease retained earnings)
    const { data: billsData } = await supabase
      .from('bills')
      .select('total')
      .eq('user_id', session.user.id)
      .eq('status', 'paid')
      .lte('bill_date', asOfDate);

    // Load unpaid invoices (Accounts Receivable)
    const { data: unpaidInvoices } = await supabase
      .from('invoices')
      .select('total, amount_paid')
      .eq('user_id', session.user.id)
      .in('status', ['sent', 'overdue', 'partial'])
      .lte('issue_date', asOfDate);

    // Load unpaid bills (Accounts Payable)
    const { data: unpaidBills } = await supabase
      .from('bills')
      .select('total, amount_paid')
      .eq('user_id', session.user.id)
      .in('status', ['pending', 'overdue', 'partial'])
      .lte('bill_date', asOfDate);

    // Calculate totals
    const totalIncome = invoicesData?.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0) || 0;
    const totalExpenses = billsData?.reduce((sum: number, bill: any) => sum + (bill.total || 0), 0) || 0;
    const retainedEarnings = totalIncome - totalExpenses;

    const accountsReceivable = unpaidInvoices?.reduce((sum: number, inv: any) =>
      sum + ((inv.total || 0) - (inv.amount_paid || 0)), 0) || 0;

    const accountsPayable = unpaidBills?.reduce((sum: number, bill: any) =>
      sum + ((bill.total || 0) - (bill.amount_paid || 0)), 0) || 0;

    // Categorize accounts
    const assets: AccountBalance[] = [];
    const liabilities: AccountBalance[] = [];
    const equity: AccountBalance[] = [];

    accountsData.forEach((account: any) => {
      const balance: AccountBalance = {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        balance: 0, // In a real app, would calculate from journal entries
      };

      // Add calculated balances for specific accounts
      if (account.name.toLowerCase().includes('accounts receivable')) {
        balance.balance = accountsReceivable;
      } else if (account.name.toLowerCase().includes('accounts payable')) {
        balance.balance = accountsPayable;
      } else if (account.name.toLowerCase().includes('retained earnings')) {
        balance.balance = retainedEarnings;
      }

      switch (account.type) {
        case 'Asset':
          assets.push(balance);
          break;
        case 'Liability':
          liabilities.push(balance);
          break;
        case 'Equity':
          equity.push(balance);
          break;
      }
    });

    // Add Accounts Receivable if not in chart
    if (!assets.some(a => a.name.toLowerCase().includes('accounts receivable')) && accountsReceivable > 0) {
      assets.unshift({
        id: 'ar',
        code: '1100',
        name: 'Accounts Receivable',
        type: 'Asset',
        balance: accountsReceivable,
      });
    }

    // Add Accounts Payable if not in chart
    if (!liabilities.some(l => l.name.toLowerCase().includes('accounts payable')) && accountsPayable > 0) {
      liabilities.unshift({
        id: 'ap',
        code: '2100',
        name: 'Accounts Payable',
        type: 'Liability',
        balance: accountsPayable,
      });
    }

    // Add Retained Earnings if not in chart
    if (!equity.some(e => e.name.toLowerCase().includes('retained earnings'))) {
      equity.push({
        id: 're',
        code: '3200',
        name: 'Retained Earnings',
        type: 'Equity',
        balance: retainedEarnings,
      });
    }

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);

    setData({
      assets: assets.filter(a => a.balance !== 0),
      liabilities: liabilities.filter(l => l.balance !== 0),
      equity: equity.filter(e => e.balance !== 0),
      totalAssets,
      totalLiabilities,
      totalEquity,
    });
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const isBalanced = Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)) < 0.01;

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
            <h1 className="text-2xl font-bold text-corporate-dark">Balance Sheet</h1>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
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
          {/* Balance Check */}
          <div className={`card ${isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <>
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-700 font-medium">Balance Sheet is in balance</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-red-700 font-medium">
                    Balance Sheet is out of balance by {formatCurrency(Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)))}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Balance Sheet */}
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-6 text-center">
              Balance Sheet
              <span className="block text-sm font-normal text-corporate-gray">As of {formatDate(asOfDate)}</span>
            </h2>

            {/* Assets Section */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-corporate-gray uppercase tracking-wider mb-3 border-b-2 border-gray-200 pb-2">
                Assets
              </h3>
              <div className="space-y-2">
                {data.assets.length === 0 ? (
                  <p className="text-corporate-gray text-sm py-2">No assets recorded</p>
                ) : (
                  data.assets.map((account) => (
                    <div key={account.id} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-dark">
                        {account.code} - {account.name}
                      </span>
                      <span className="font-medium text-corporate-dark">{formatCurrency(account.balance)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-3 bg-blue-50 px-3 rounded-lg mt-4">
                  <span className="font-semibold text-blue-700">Total Assets</span>
                  <span className="font-bold text-blue-700">{formatCurrency(data.totalAssets)}</span>
                </div>
              </div>
            </div>

            {/* Liabilities Section */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-corporate-gray uppercase tracking-wider mb-3 border-b-2 border-gray-200 pb-2">
                Liabilities
              </h3>
              <div className="space-y-2">
                {data.liabilities.length === 0 ? (
                  <p className="text-corporate-gray text-sm py-2">No liabilities recorded</p>
                ) : (
                  data.liabilities.map((account) => (
                    <div key={account.id} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-dark">
                        {account.code} - {account.name}
                      </span>
                      <span className="font-medium text-corporate-dark">{formatCurrency(account.balance)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-3 bg-orange-50 px-3 rounded-lg mt-4">
                  <span className="font-semibold text-orange-700">Total Liabilities</span>
                  <span className="font-bold text-orange-700">{formatCurrency(data.totalLiabilities)}</span>
                </div>
              </div>
            </div>

            {/* Equity Section */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-corporate-gray uppercase tracking-wider mb-3 border-b-2 border-gray-200 pb-2">
                Equity
              </h3>
              <div className="space-y-2">
                {data.equity.length === 0 ? (
                  <p className="text-corporate-gray text-sm py-2">No equity recorded</p>
                ) : (
                  data.equity.map((account) => (
                    <div key={account.id} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-dark">
                        {account.code} - {account.name}
                      </span>
                      <span className="font-medium text-corporate-dark">{formatCurrency(account.balance)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-3 bg-purple-50 px-3 rounded-lg mt-4">
                  <span className="font-semibold text-purple-700">Total Equity</span>
                  <span className="font-bold text-purple-700">{formatCurrency(data.totalEquity)}</span>
                </div>
              </div>
            </div>

            {/* Total Liabilities & Equity */}
            <div className="p-4 rounded-lg bg-gray-100 border-2 border-gray-300">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-corporate-dark">
                  Total Liabilities & Equity
                </span>
                <span className="text-2xl font-bold text-corporate-dark">
                  {formatCurrency(data.totalLiabilities + data.totalEquity)}
                </span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Total Assets</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(data.totalAssets)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Total Liabilities</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(data.totalLiabilities)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Total Equity</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(data.totalEquity)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
