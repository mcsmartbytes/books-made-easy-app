'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Estimate {
  id: string;
  estimate_number: string;
  customer_id: string;
  customer_name: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted';
  issue_date: string;
  expiry_date: string;
  subtotal: number;
  tax_amount: number;
  total: number;
}

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadEstimates();
  }, []);

  const loadEstimates = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: estimatesData, error } = await supabase
      .from('estimates')
      .select(`
        *,
        customers (name)
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!error && estimatesData) {
      const mapped = estimatesData.map((est: any) => ({
        ...est,
        customer_name: est.customers?.name || 'No Customer'
      }));
      setEstimates(mapped);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      accepted: 'bg-green-100 text-green-700',
      declined: 'bg-red-100 text-red-700',
      expired: 'bg-yellow-100 text-yellow-700',
      converted: 'bg-purple-100 text-purple-700',
    };
    const labels: Record<string, string> = {
      draft: 'Draft',
      sent: 'Sent',
      accepted: 'Accepted',
      declined: 'Declined',
      expired: 'Expired',
      converted: 'Converted',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const filteredEstimates = estimates.filter(estimate => {
    const matchesSearch = estimate.estimate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estimate.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || estimate.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totals = {
    all: estimates.reduce((sum, e) => sum + e.total, 0),
    pending: estimates.filter(e => e.status === 'sent').reduce((sum, e) => sum + e.total, 0),
    accepted: estimates.filter(e => e.status === 'accepted').reduce((sum, e) => sum + e.total, 0),
    converted: estimates.filter(e => e.status === 'converted').reduce((sum, e) => sum + e.total, 0),
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">Estimates</h1>
          <p className="text-corporate-gray mt-1">Create quotes and convert them to invoices</p>
        </div>
        <Link href="/dashboard/estimates/new" className="btn-primary flex items-center gap-2 justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Estimate
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-primary-200" onClick={() => setStatusFilter('all')}>
          <p className="text-sm text-corporate-gray">Total</p>
          <p className="text-xl font-bold text-corporate-dark">{formatCurrency(totals.all)}</p>
          <p className="text-xs text-corporate-gray">{estimates.length} estimates</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-blue-200" onClick={() => setStatusFilter('sent')}>
          <p className="text-sm text-corporate-gray">Pending</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(totals.pending)}</p>
          <p className="text-xs text-corporate-gray">{estimates.filter(e => e.status === 'sent').length} awaiting response</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-green-200" onClick={() => setStatusFilter('accepted')}>
          <p className="text-sm text-corporate-gray">Accepted</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totals.accepted)}</p>
          <p className="text-xs text-corporate-gray">{estimates.filter(e => e.status === 'accepted').length} accepted</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-purple-200" onClick={() => setStatusFilter('converted')}>
          <p className="text-sm text-corporate-gray">Converted</p>
          <p className="text-xl font-bold text-purple-600">{formatCurrency(totals.converted)}</p>
          <p className="text-xs text-corporate-gray">{estimates.filter(e => e.status === 'converted').length} invoiced</p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search estimates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
            <option value="converted">Converted</option>
          </select>
        </div>
      </div>

      {/* Estimates table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Estimate</th>
                <th>Customer</th>
                <th>Issue Date</th>
                <th>Expiry Date</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEstimates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-corporate-gray">
                    {estimates.length === 0 ? (
                      <div className="space-y-2">
                        <p>No estimates yet</p>
                        <Link href="/dashboard/estimates/new" className="text-primary-600 hover:underline">
                          Create your first estimate
                        </Link>
                      </div>
                    ) : (
                      'No estimates found matching your search'
                    )}
                  </td>
                </tr>
              ) : (
                filteredEstimates.map((estimate) => (
                  <tr key={estimate.id}>
                    <td>
                      <Link href={`/dashboard/estimates/${estimate.id}`} className="font-medium text-primary-600 hover:text-primary-700">
                        {estimate.estimate_number}
                      </Link>
                    </td>
                    <td className="text-corporate-slate">{estimate.customer_name}</td>
                    <td className="text-corporate-slate">
                      {new Date(estimate.issue_date).toLocaleDateString()}
                    </td>
                    <td className="text-corporate-slate">
                      {new Date(estimate.expiry_date).toLocaleDateString()}
                    </td>
                    <td>{getStatusBadge(estimate.status)}</td>
                    <td className="text-right font-semibold text-corporate-dark">
                      {formatCurrency(estimate.total)}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/estimates/${estimate.id}`}
                          className="p-2 text-corporate-gray hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        {estimate.status === 'draft' && (
                          <button
                            className="p-2 text-corporate-gray hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Send"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </button>
                        )}
                        {(estimate.status === 'accepted') && (
                          <Link
                            href={`/dashboard/estimates/${estimate.id}/convert`}
                            className="p-2 text-corporate-gray hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Convert to Invoice"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </Link>
                        )}
                        <button
                          className="p-2 text-corporate-gray hover:text-corporate-slate hover:bg-gray-100 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
