'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface CustomReport {
  id: string;
  name: string;
  description: string;
  data_source: string;
  is_favorite: boolean;
  last_run_at: string | null;
  created_at: string;
}

export default function CustomReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('custom_reports')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });

    setReports(data || []);
    setLoading(false);
  };

  const toggleFavorite = async (id: string, currentValue: boolean) => {
    await supabase
      .from('custom_reports')
      .update({ is_favorite: !currentValue })
      .eq('id', id);

    setReports(reports.map(r =>
      r.id === id ? { ...r, is_favorite: !currentValue } : r
    ));
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    await supabase
      .from('custom_reports')
      .delete()
      .eq('id', id);

    setReports(reports.filter(r => r.id !== id));
  };

  const getDataSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      invoices: 'Invoices',
      bills: 'Bills',
      payments: 'Payments',
      customers: 'Customers',
      vendors: 'Vendors',
      products: 'Products & Services',
      jobs: 'Jobs',
      journal_entries: 'Journal Entries',
    };
    return labels[source] || source;
  };

  const getDataSourceIcon = (source: string) => {
    const icons: Record<string, string> = {
      invoices: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      bills: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      payments: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      customers: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      vendors: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      products: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      jobs: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      journal_entries: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    };
    return icons[source] || 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
  };

  const filteredReports = filter === 'favorites'
    ? reports.filter(r => r.is_favorite)
    : reports;

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
            <h1 className="text-2xl font-bold text-corporate-dark">Custom Reports</h1>
            <p className="text-corporate-gray">Build and manage your own reports</p>
          </div>
        </div>
        <Link href="/dashboard/reports/custom/new" className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Report
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-corporate-gray hover:bg-gray-50'
          }`}
        >
          All Reports ({reports.length})
        </button>
        <button
          onClick={() => setFilter('favorites')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'favorites'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-corporate-gray hover:bg-gray-50'
          }`}
        >
          Favorites ({reports.filter(r => r.is_favorite).length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-corporate-gray mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-corporate-dark mb-2">
            {filter === 'favorites' ? 'No favorite reports' : 'No custom reports yet'}
          </h3>
          <p className="text-corporate-gray mb-6">
            {filter === 'favorites'
              ? 'Star a report to add it to your favorites'
              : 'Create your first custom report to get started'
            }
          </p>
          {filter === 'all' && (
            <Link href="/dashboard/reports/custom/new" className="btn-primary">
              Create Your First Report
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.map(report => (
            <div key={report.id} className="card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getDataSourceIcon(report.data_source)} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-corporate-dark">{report.name}</h3>
                    <p className="text-xs text-corporate-gray">{getDataSourceLabel(report.data_source)}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleFavorite(report.id, report.is_favorite)}
                  className="text-corporate-gray hover:text-yellow-500"
                >
                  <svg
                    className={`w-5 h-5 ${report.is_favorite ? 'text-yellow-500 fill-yellow-500' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
              </div>

              {report.description && (
                <p className="text-sm text-corporate-gray mb-4 line-clamp-2">{report.description}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-corporate-gray">
                  {report.last_run_at
                    ? `Last run: ${new Date(report.last_run_at).toLocaleDateString()}`
                    : 'Never run'
                  }
                </span>
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/reports/custom/${report.id}`}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Run
                  </Link>
                  <Link
                    href={`/dashboard/reports/custom/${report.id}/edit`}
                    className="text-corporate-gray hover:text-corporate-dark text-sm font-medium"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => deleteReport(report.id)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Templates */}
      <div className="card bg-gray-50">
        <h2 className="text-lg font-semibold text-corporate-dark mb-4">Quick Templates</h2>
        <p className="text-sm text-corporate-gray mb-4">
          Start with a template and customize it to your needs
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href="/dashboard/reports/custom/new?template=overdue-invoices"
            className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-corporate-dark">Overdue Invoices</span>
          </Link>
          <Link
            href="/dashboard/reports/custom/new?template=top-customers"
            className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-sm font-medium text-corporate-dark">Top Customers</span>
          </Link>
          <Link
            href="/dashboard/reports/custom/new?template=monthly-expenses"
            className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-corporate-dark">Monthly Expenses</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
