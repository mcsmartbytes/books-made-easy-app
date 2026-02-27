'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession } from 'next-auth/react';

interface Deposit {
  id: string;
  deposit_number: string;
  deposit_date: string;
  total: number;
  status: 'pending' | 'deposited';
  memo: string;
  bank_accounts?: { id: string; name: string; institution: string } | null;
}

export default function DepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [undepositedCount, setUndepositedCount] = useState(0);
  const [undepositedTotal, setUndepositedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;

    const [depositsRes, undepositedRes] = await Promise.all([
      fetch(`/api/deposits?user_id=${userId}`).then(r => r.json()),
      fetch(`/api/deposits?user_id=${userId}&undeposited=true`).then(r => r.json()),
    ]);

    if (depositsRes.success) setDeposits(depositsRes.data);
    if (undepositedRes.success && undepositedRes.data) {
      setUndepositedCount(undepositedRes.data.length);
      setUndepositedTotal(undepositedRes.data.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0));
    }

    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this deposit? Payments will be returned to undeposited.')) return;

    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;

    const res = await fetch(`/api/deposits?id=${id}&user_id=${userId}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      loadData();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const filteredDeposits = deposits.filter(d => {
    if (statusFilter === 'all') return true;
    return d.status === statusFilter;
  });

  const totals = {
    all: deposits.reduce((sum, d) => sum + d.total, 0),
    pending: deposits.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.total, 0),
    deposited: deposits.filter(d => d.status === 'deposited').reduce((sum, d) => sum + d.total, 0),
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
          <h1 className="text-2xl font-bold text-corporate-dark">Deposits</h1>
          <p className="text-corporate-gray mt-1">Group received payments into bank deposits</p>
        </div>
        <Link href="/dashboard/deposits/new" className="btn-primary flex items-center gap-2 justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Deposit
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-primary-200" onClick={() => setStatusFilter('all')}>
          <p className="text-sm text-corporate-gray">Total Deposits</p>
          <p className="text-xl font-bold text-corporate-dark">{formatCurrency(totals.all)}</p>
          <p className="text-xs text-corporate-gray">{deposits.length} deposits</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-yellow-200" onClick={() => setStatusFilter('pending')}>
          <p className="text-sm text-corporate-gray">Pending</p>
          <p className="text-xl font-bold text-yellow-600">{formatCurrency(totals.pending)}</p>
          <p className="text-xs text-corporate-gray">{deposits.filter(d => d.status === 'pending').length} deposits</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-green-200" onClick={() => setStatusFilter('deposited')}>
          <p className="text-sm text-corporate-gray">Deposited</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totals.deposited)}</p>
          <p className="text-xs text-corporate-gray">{deposits.filter(d => d.status === 'deposited').length} deposits</p>
        </div>
        <Link href="/dashboard/deposits/new" className="stat-card hover:ring-2 hover:ring-blue-200">
          <p className="text-sm text-corporate-gray">Undeposited Payments</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(undepositedTotal)}</p>
          <p className="text-xs text-primary-600">{undepositedCount} payments ready</p>
        </Link>
      </div>

      {/* Deposits Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Deposit #</th>
                <th>Date</th>
                <th>Bank Account</th>
                <th>Memo</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-corporate-gray">
                    {deposits.length === 0 ? (
                      <div>
                        <p>No deposits yet.</p>
                        {undepositedCount > 0 && (
                          <Link href="/dashboard/deposits/new" className="text-primary-600 hover:text-primary-700 mt-1 inline-block">
                            Create a deposit from {undepositedCount} undeposited payments
                          </Link>
                        )}
                      </div>
                    ) : (
                      'No deposits match this filter.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredDeposits.map((deposit) => (
                  <tr key={deposit.id}>
                    <td>
                      <span className="font-medium text-primary-600">{deposit.deposit_number}</span>
                    </td>
                    <td className="text-corporate-slate">
                      {new Date(deposit.deposit_date).toLocaleDateString()}
                    </td>
                    <td>
                      {deposit.bank_accounts ? (
                        <span className="text-corporate-dark">{deposit.bank_accounts.name}</span>
                      ) : (
                        <span className="text-corporate-gray italic">Not assigned</span>
                      )}
                    </td>
                    <td className="text-corporate-slate">{deposit.memo || '-'}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        deposit.status === 'deposited' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)}
                      </span>
                    </td>
                    <td className="text-right font-semibold text-corporate-dark">
                      {formatCurrency(deposit.total)}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleDelete(deposit.id)}
                        className="p-2 text-corporate-gray hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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
