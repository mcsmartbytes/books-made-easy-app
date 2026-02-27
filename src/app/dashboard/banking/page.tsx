'use client';

import { useEffect, useState } from 'react';
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
  is_active: number;
  accounts?: { id: string; name: string; code: string; type: string } | null;
}

export default function BankingPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    institution: '',
    account_type: 'checking',
    account_number_last4: '',
    routing_number_last4: '',
    current_balance: '',
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const { data, error } = await supabase.from('bank-accounts').select('*, accounts(id, name, code, type)');
    if (!error && data) {
      setAccounts(data as BankAccount[]);
    }
    setLoading(false);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('bank-accounts').insert({
      name: formData.name,
      institution: formData.institution,
      account_type: formData.account_type,
      account_number_last4: formData.account_number_last4,
      routing_number_last4: formData.routing_number_last4,
      current_balance: parseFloat(formData.current_balance) || 0,
    });

    if (!error) {
      setShowAddModal(false);
      setFormData({ name: '', institution: '', account_type: 'checking', account_number_last4: '', routing_number_last4: '', current_balance: '' });
      loadAccounts();
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Are you sure? This will delete all transactions for this account.')) return;
    await supabase.from('bank-accounts').delete().eq('id', id);
    loadAccounts();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'checking': return 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z';
      case 'savings': return 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z';
      case 'credit_card': return 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z';
      default: return 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  };

  const totalBalance = accounts.reduce((sum, a) => {
    if (a.account_type === 'credit_card' || a.account_type === 'loan') {
      return sum - Math.abs(a.current_balance);
    }
    return sum + a.current_balance;
  }, 0);

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
          <h1 className="text-2xl font-bold text-corporate-dark">Banking</h1>
          <p className="text-corporate-gray mt-1">Manage bank accounts, import transactions, and reconcile</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Balance</p>
          <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-xs text-corporate-gray">{accounts.length} accounts</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Cash & Checking</p>
          <p className="text-2xl font-bold text-corporate-dark">
            {formatCurrency(accounts.filter(a => a.account_type === 'checking' || a.account_type === 'savings').reduce((s, a) => s + a.current_balance, 0))}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Credit Cards</p>
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(accounts.filter(a => a.account_type === 'credit_card').reduce((s, a) => s + Math.abs(a.current_balance), 0))}
          </p>
        </div>
      </div>

      {/* Account Cards */}
      {accounts.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <h3 className="text-lg font-medium text-corporate-dark mb-2">No bank accounts yet</h3>
          <p className="text-corporate-gray mb-4">Add a bank account to start tracking transactions and reconciling.</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">Add Your First Account</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <div key={account.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getAccountTypeIcon(account.account_type)} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-corporate-dark">{account.name}</h3>
                    <p className="text-xs text-corporate-gray">
                      {account.institution || 'Bank'} {account.account_number_last4 ? `****${account.account_number_last4}` : ''}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-corporate-slate capitalize">
                  {account.account_type.replace('_', ' ')}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm text-corporate-gray">Current Balance</p>
                <p className={`text-xl font-bold ${account.current_balance >= 0 ? 'text-corporate-dark' : 'text-red-600'}`}>
                  {formatCurrency(account.current_balance)}
                </p>
              </div>

              {account.last_reconciled_date && (
                <p className="text-xs text-corporate-gray mb-4">
                  Last reconciled: {new Date(account.last_reconciled_date).toLocaleDateString()}
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                <Link href={`/dashboard/banking/${account.id}`} className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Transactions
                </Link>
                <Link href={`/dashboard/banking/${account.id}/import`} className="text-xs font-medium text-green-600 hover:text-green-700 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import
                </Link>
                <Link href={`/dashboard/banking/${account.id}/reconcile`} className="text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Reconcile
                </Link>
                <button onClick={() => handleDeleteAccount(account.id)} className="text-xs font-medium text-red-500 hover:text-red-700 flex items-center gap-1 ml-auto">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-corporate-dark">Add Bank Account</h2>
              <button onClick={() => setShowAddModal(false)} className="text-corporate-gray hover:text-corporate-dark">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-corporate-dark mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Business Checking"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-corporate-dark mb-1">Institution</label>
                <input
                  type="text"
                  value={formData.institution}
                  onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                  placeholder="e.g., Chase Bank"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-corporate-dark mb-1">Account Type</label>
                <select
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                  className="input-field"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="loan">Loan</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-corporate-dark mb-1">Last 4 (Account #)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formData.account_number_last4}
                    onChange={(e) => setFormData({ ...formData, account_number_last4: e.target.value.replace(/\D/g, '') })}
                    placeholder="1234"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-corporate-dark mb-1">Last 4 (Routing #)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formData.routing_number_last4}
                    onChange={(e) => setFormData({ ...formData, routing_number_last4: e.target.value.replace(/\D/g, '') })}
                    placeholder="5678"
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-corporate-dark mb-1">Opening Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.current_balance}
                  onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                  placeholder="0.00"
                  className="input-field"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-corporate-slate hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Add Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
