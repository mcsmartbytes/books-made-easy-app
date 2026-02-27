'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface DashboardStats {
  totalRevenue: number;
  outstandingReceivables: number;
  outstandingPayables: number;
  customersCount: number;
  vendorsCount: number;
  invoicesDue: number;
  billsDue: number;
}

interface RecentActivity {
  id: string;
  type: 'invoice' | 'bill' | 'payment' | 'customer';
  description: string;
  amount?: number;
  date: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    outstandingReceivables: 0,
    outstandingPayables: 0,
    customersCount: 0,
    vendorsCount: 0,
    invoicesDue: 0,
    billsDue: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }
      if (session?.user) {
        // Check if onboarding is complete
        const { data: settings } = await supabase
          .from('company_settings')
          .select('industry_id, company_name')
          .eq('user_id', session.user.id)
          .single();

        if (!settings?.industry_id) {
          router.push('/onboarding');
          return;
        }

        setUserName(settings.company_name || session.user.user_metadata?.full_name || 'there');

        // Load real stats from database
        const [customersResult, vendorsResult, invoicesResult, billsResult] = await Promise.all([
          supabase.from('customers').select('id', { count: 'exact' }).eq('user_id', session.user.id),
          supabase.from('vendors').select('id', { count: 'exact' }).eq('user_id', session.user.id),
          supabase.from('invoices').select('*').eq('user_id', session.user.id),
          supabase.from('bills').select('*').eq('user_id', session.user.id),
        ]);

        const invoices = invoicesResult.data || [];
        const bills = billsResult.data || [];

        const totalRevenue = invoices.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + (i.total || 0), 0);
        const outstandingReceivables = invoices.filter((i: any) => i.status === 'sent' || i.status === 'overdue').reduce((sum: number, i: any) => sum + ((i.total || 0) - (i.amount_paid || 0)), 0);
        const outstandingPayables = bills.filter((b: any) => b.status === 'unpaid' || b.status === 'overdue').reduce((sum: number, b: any) => sum + ((b.total || 0) - (b.amount_paid || 0)), 0);
        const invoicesDue = invoices.filter((i: any) => i.status === 'sent' || i.status === 'overdue').length;
        const billsDue = bills.filter((b: any) => b.status === 'unpaid' || b.status === 'overdue').length;

        setStats({
          totalRevenue,
          outstandingReceivables,
          outstandingPayables,
          customersCount: customersResult.count || 0,
          vendorsCount: vendorsResult.count || 0,
          invoicesDue,
          billsDue,
        });

        setRecentActivity([
          { id: '1', type: 'invoice', description: 'Invoice #1001 sent to Acme Corp', amount: 5250.00, date: '2024-12-02' },
          { id: '2', type: 'payment', description: 'Payment received from Tech Solutions', amount: 3200.00, date: '2024-12-01' },
          { id: '3', type: 'bill', description: 'Bill #B-245 received from Office Supplies Co', amount: 450.00, date: '2024-12-01' },
          { id: '4', type: 'customer', description: 'New customer added: Smith Consulting', date: '2024-11-30' },
          { id: '5', type: 'invoice', description: 'Invoice #1000 marked as paid', amount: 8500.00, date: '2024-11-30' },
        ]);
      }
      setLoading(false);
    };
    loadDashboard();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return (
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        );
      case 'payment':
        return (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'bill':
        return (
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        );
      case 'customer':
        return (
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-corporate-dark">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {userName}
        </h1>
        <p className="text-corporate-gray mt-1">Here&apos;s what&apos;s happening with your business today.</p>
      </div>

      {/* Stats grid - clickable to drill down */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <Link href="/dashboard/reports/profit-loss" className="stat-card hover:ring-2 hover:ring-green-200 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-corporate-gray">Total Revenue</p>
              <p className="text-2xl font-bold text-corporate-dark mt-1">{formatCurrency(stats.totalRevenue)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            Click to view P&L report
          </p>
        </Link>

        {/* Outstanding Receivables */}
        <Link href="/dashboard/invoices?status=sent" className="stat-card hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-corporate-gray">Outstanding AR</p>
              <p className="text-2xl font-bold text-corporate-dark mt-1">{formatCurrency(stats.outstandingReceivables)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-2">{stats.invoicesDue} invoices due → Click to view</p>
        </Link>

        {/* Outstanding Payables */}
        <Link href="/dashboard/bills?status=unpaid" className="stat-card hover:ring-2 hover:ring-orange-200 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-corporate-gray">Outstanding AP</p>
              <p className="text-2xl font-bold text-corporate-dark mt-1">{formatCurrency(stats.outstandingPayables)}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-orange-600 mt-2">{stats.billsDue} bills due → Click to view</p>
        </Link>

        {/* Customers & Vendors */}
        <Link href="/dashboard/customers" className="stat-card hover:ring-2 hover:ring-purple-200 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-corporate-gray">Contacts</p>
              <p className="text-2xl font-bold text-corporate-dark mt-1">{stats.customersCount + stats.vendorsCount}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-purple-600 mt-2">{stats.customersCount} customers, {stats.vendorsCount} vendors</p>
        </Link>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-corporate-dark">Recent Activity</h2>
            <Link href="/dashboard/reports" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                {getActivityIcon(activity.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-corporate-dark truncate">{activity.description}</p>
                  <p className="text-xs text-corporate-gray">{new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                {activity.amount && (
                  <p className={`text-sm font-semibold ${activity.type === 'payment' ? 'text-green-600' : 'text-corporate-dark'}`}>
                    {activity.type === 'payment' ? '+' : ''}{formatCurrency(activity.amount)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-6">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              href="/dashboard/invoices/new"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all"
            >
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-corporate-dark">Create Invoice</p>
                <p className="text-xs text-corporate-gray">Bill a customer</p>
              </div>
            </Link>

            <Link
              href="/dashboard/bills/new"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all"
            >
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-corporate-dark">Record Bill</p>
                <p className="text-xs text-corporate-gray">Track expenses</p>
              </div>
            </Link>

            <Link
              href="/dashboard/customers/new"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-corporate-dark">Add Customer</p>
                <p className="text-xs text-corporate-gray">New contact</p>
              </div>
            </Link>

            <Link
              href="/dashboard/reports"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-corporate-dark">View Reports</p>
                <p className="text-xs text-corporate-gray">Financial insights</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Overdue items alert */}
      {(stats.invoicesDue > 0 || stats.billsDue > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-800">Attention Required</h3>
              <p className="text-sm text-amber-700 mt-1">
                You have {stats.invoicesDue > 0 && <><strong>{stats.invoicesDue} invoice{stats.invoicesDue > 1 ? 's' : ''}</strong> waiting for payment</>}
                {stats.invoicesDue > 0 && stats.billsDue > 0 && ' and '}
                {stats.billsDue > 0 && <><strong>{stats.billsDue} bill{stats.billsDue > 1 ? 's' : ''}</strong> due soon</>}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
