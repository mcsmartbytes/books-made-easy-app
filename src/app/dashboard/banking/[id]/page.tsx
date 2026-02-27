'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface BankAccount {
  id: string;
  name: string;
  institution: string;
  account_type: string;
  account_number_last4: string;
  current_balance: number;
  last_reconciled_date: string | null;
  last_reconciled_balance: number;
}

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  status: string;
  payee: string;
  reference: string;
  check_number: string;
  category_id: string;
  is_reconciled: number;
  matched_transaction_type: string | null;
  categories?: { id: string; name: string } | null;
}

export default function BankAccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    loadData();
  }, [accountId]);

  const loadData = async () => {
    const [accountRes, txnRes] = await Promise.all([
      supabase.from('bank-accounts').select('*').eq('id', accountId).single(),
      supabase.from('bank-transactions').select('*, categories(id, name)').eq('bank_account_id', accountId),
    ]);

    if (!accountRes.error && accountRes.data) setAccount(accountRes.data as BankAccount);
    if (!txnRes.error && txnRes.data) setTransactions(txnRes.data as BankTransaction[]);
    setLoading(false);
  };

  const handleUpdateStatus = async (txnId: string, newStatus: string) => {
    await supabase.from('bank-transactions').update({ status: newStatus }).eq('id', txnId);
    loadData();
  };

  const handleDeleteTransaction = async (txnId: string) => {
    if (!confirm('Delete this transaction?')) return;
    await supabase.from('bank-transactions').delete().eq('id', txnId);
    loadData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const filteredTransactions = transactions.filter(txn => {
    const matchesSearch = txn.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (txn.payee || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (txn.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || txn.status === statusFilter;
    const matchesDateStart = !dateRange.start || txn.date >= dateRange.start;
    const matchesDateEnd = !dateRange.end || txn.date <= dateRange.end;
    return matchesSearch && matchesStatus && matchesDateStart && matchesDateEnd;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      unreviewed: 'bg-yellow-100 text-yellow-700',
      reviewed: 'bg-blue-100 text-blue-700',
      matched: 'bg-green-100 text-green-700',
      excluded: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-corporate-gray">Account not found</p>
        <Link href="/dashboard/banking" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">Back to Banking</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-corporate-gray mb-1">
            <Link href="/dashboard/banking" className="hover:text-primary-600">Banking</Link>
            <span>/</span>
            <span>{account.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-corporate-dark">{account.name}</h1>
          <p className="text-corporate-gray">
            {account.institution || 'Bank'} - {account.account_type.replace('_', ' ')}
            {account.account_number_last4 ? ` ****${account.account_number_last4}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/banking/${accountId}/import`} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </Link>
          <Link href={`/dashboard/banking/${accountId}/reconcile`} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Reconcile
          </Link>
          <Link href={`/dashboard/banking/${accountId}/match`} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Match
          </Link>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Current Balance</p>
          <p className={`text-xl font-bold ${account.current_balance >= 0 ? 'text-corporate-dark' : 'text-red-600'}`}>
            {formatCurrency(account.current_balance)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Deposits</p>
          <p className="text-xl font-bold text-green-600">
            {formatCurrency(transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0))}
          </p>
          <p className="text-xs text-corporate-gray">{transactions.filter(t => t.type === 'credit').length} transactions</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Withdrawals</p>
          <p className="text-xl font-bold text-red-600">
            {formatCurrency(transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0))}
          </p>
          <p className="text-xs text-corporate-gray">{transactions.filter(t => t.type === 'debit').length} transactions</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Unreviewed</p>
          <p className="text-xl font-bold text-yellow-600">
            {transactions.filter(t => t.status === 'unreviewed').length}
          </p>
          <p className="text-xs text-corporate-gray">transactions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-auto">
            <option value="all">All Status</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="reviewed">Reviewed</option>
            <option value="matched">Matched</option>
            <option value="excluded">Excluded</option>
          </select>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="input-field w-auto"
            placeholder="From"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="input-field w-auto"
            placeholder="To"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Status</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-corporate-gray">
                    {transactions.length === 0 ? 'No transactions yet. Import a CSV to get started.' : 'No transactions match your filters.'}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((txn) => (
                  <tr key={txn.id} className={txn.is_reconciled ? 'bg-green-50' : ''}>
                    <td className="text-corporate-slate whitespace-nowrap">
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td>
                      <p className="font-medium text-corporate-dark">{txn.description}</p>
                      {txn.reference && <p className="text-xs text-corporate-gray">Ref: {txn.reference}</p>}
                      {txn.check_number && <p className="text-xs text-corporate-gray">Check #{txn.check_number}</p>}
                    </td>
                    <td>
                      {txn.categories ? (
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">{txn.categories.name}</span>
                      ) : (
                        <span className="text-xs text-corporate-gray italic">Uncategorized</span>
                      )}
                    </td>
                    <td>{getStatusBadge(txn.status)}</td>
                    <td className="text-right font-medium text-red-600">
                      {txn.type === 'debit' ? formatCurrency(txn.amount) : ''}
                    </td>
                    <td className="text-right font-medium text-green-600">
                      {txn.type === 'credit' ? formatCurrency(txn.amount) : ''}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {txn.status === 'unreviewed' && (
                          <button
                            onClick={() => handleUpdateStatus(txn.id, 'reviewed')}
                            className="p-1.5 text-corporate-gray hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Mark Reviewed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        {txn.status !== 'excluded' && (
                          <button
                            onClick={() => handleUpdateStatus(txn.id, 'excluded')}
                            className="p-1.5 text-corporate-gray hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="Exclude"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTransaction(txn.id)}
                          className="p-1.5 text-corporate-gray hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
