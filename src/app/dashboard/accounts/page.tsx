'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { normalBalanceByType, getAccountHelpText } from '@/data/accountHelp';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  subtype: string;
  balance: number;
  normal_balance: 'debit' | 'credit';
  help_text: string;
  description: string;
  is_active: boolean;
}

const accountTypes = [
  { value: 'asset', label: 'Assets', color: 'bg-blue-100 text-blue-700' },
  { value: 'liability', label: 'Liabilities', color: 'bg-red-100 text-red-700' },
  { value: 'equity', label: 'Equity', color: 'bg-purple-100 text-purple-700' },
  { value: 'income', label: 'Income', color: 'bg-green-100 text-green-700' },
  { value: 'expense', label: 'Expenses', color: 'bg-orange-100 text-orange-700' },
];

const subtypes: Record<string, string[]> = {
  asset: ['Cash', 'Bank', 'Accounts Receivable', 'Inventory', 'Fixed Assets', 'Other Current Assets'],
  liability: ['Accounts Payable', 'Credit Card', 'Loans', 'Other Current Liabilities', 'Long-term Liabilities'],
  equity: ['Owner Equity', 'Retained Earnings', 'Common Stock'],
  income: ['Sales', 'Service Revenue', 'Interest Income', 'Other Income'],
  expense: ['Cost of Goods Sold', 'Operating Expenses', 'Payroll', 'Marketing', 'Utilities', 'Rent', 'Other Expenses'],
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tooltipId, setTooltipId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: '' as Account['type'] | '',
    subtype: '',
    description: '',
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('code');

    if (error) {
      console.error('Error loading accounts:', error);
      setError('Failed to load accounts');
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const openModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        code: account.code,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        description: account.description || '',
      });
    } else {
      setEditingAccount(null);
      setFormData({
        code: '',
        name: '',
        type: '',
        subtype: '',
        description: '',
      });
    }
    setShowModal(true);
    setError('');
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAccount(null);
    setFormData({ code: '', name: '', type: '', subtype: '', description: '' });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const type = formData.type as Account['type'];
    const autoNormalBalance = normalBalanceByType[type] || 'debit';
    const autoHelpText = getAccountHelpText(formData.subtype, type);

    try {
      if (editingAccount) {
        const { error: updateError } = await supabase
          .from('accounts')
          .update({
            code: formData.code,
            name: formData.name,
            type,
            subtype: formData.subtype,
            description: formData.description,
            normal_balance: autoNormalBalance,
            help_text: autoHelpText,
          })
          .eq('id', editingAccount.id)
          .eq('user_id', session.user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('accounts')
          .insert({
            user_id: session.user.id,
            code: formData.code,
            name: formData.name,
            type,
            subtype: formData.subtype,
            description: formData.description,
            normal_balance: autoNormalBalance,
            help_text: autoHelpText,
          });

        if (insertError) throw insertError;
      }

      closeModal();
      await loadAccounts();
    } catch (err: any) {
      console.error('Error saving account:', err);
      if (err?.message?.includes('UNIQUE') || err?.message?.includes('duplicate')) {
        setError('An account with this code already exists.');
      } else {
        setError('Failed to save account. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account: Account) => {
    if (!confirm(`Are you sure you want to delete "${account.name}"?`)) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', account.id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error deleting account:', error);
    } else {
      await loadAccounts();
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.code.includes(searchTerm);
    const matchesType = typeFilter === 'all' || account.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const groupedAccounts = filteredAccounts.reduce((groups, account) => {
    const type = account.type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(account);
    return groups;
  }, {} as Record<string, Account[]>);

  const totals = {
    assets: accounts.filter(a => a.type === 'asset').reduce((sum, a) => sum + a.balance, 0),
    liabilities: accounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + a.balance, 0),
    equity: accounts.filter(a => a.type === 'equity').reduce((sum, a) => sum + a.balance, 0),
    income: accounts.filter(a => a.type === 'income').reduce((sum, a) => sum + a.balance, 0),
    expenses: accounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + a.balance, 0),
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
          <h1 className="text-2xl font-bold text-corporate-dark">Chart of Accounts</h1>
          <p className="text-corporate-gray mt-1">Manage your account structure</p>
        </div>
        <button
          onClick={() => openModal()}
          className="btn-primary flex items-center gap-2 justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Assets</p>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(totals.assets)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Liabilities</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(totals.liabilities)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Equity</p>
          <p className="text-lg font-bold text-purple-600">{formatCurrency(totals.equity)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Income</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(totals.income)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Expenses</p>
          <p className="text-lg font-bold text-orange-600">{formatCurrency(totals.expenses)}</p>
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
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="all">All Types</option>
            {accountTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty state */}
      {filteredAccounts.length === 0 && !loading && (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 mx-auto text-corporate-gray mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-corporate-dark mb-1">No accounts found</h3>
          <p className="text-corporate-gray">
            {searchTerm || typeFilter !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'Get started by adding your first account.'}
          </p>
        </div>
      )}

      {/* Accounts by type */}
      {accountTypes.map(type => {
        const typeAccounts = groupedAccounts[type.value];
        if (!typeAccounts || typeAccounts.length === 0) return null;

        return (
          <div key={type.value} className="card overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${type.color}`}>
                {type.label}
              </span>
              <span className="text-sm text-corporate-gray">
                {typeAccounts.length} account{typeAccounts.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-corporate-gray ml-auto">
                Normal Balance: {normalBalanceByType[type.value] === 'debit' ? 'DR' : 'CR'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account Name</th>
                    <th>Subtype</th>
                    <th className="text-center">DR/CR</th>
                    <th className="text-right">Balance</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {typeAccounts.sort((a, b) => a.code.localeCompare(b.code)).map(account => {
                    const nb = account.normal_balance || normalBalanceByType[account.type] || 'debit';
                    const helpText = account.help_text || getAccountHelpText(account.subtype, account.type);

                    return (
                      <tr key={account.id}>
                        <td className="font-mono text-sm">{account.code}</td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-corporate-dark">{account.name}</p>
                            {/* Help tooltip */}
                            {helpText && (
                              <div className="relative">
                                <button
                                  onClick={() => setTooltipId(tooltipId === account.id ? null : account.id)}
                                  onMouseEnter={() => setTooltipId(account.id)}
                                  onMouseLeave={() => setTooltipId(null)}
                                  className="text-corporate-gray hover:text-primary-600 transition-colors"
                                  aria-label="Account info"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                                {tooltipId === account.id && (
                                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-corporate-dark text-white text-xs rounded-lg shadow-lg z-10">
                                    {helpText}
                                    <div className="absolute left-3 top-full w-2 h-2 bg-corporate-dark transform rotate-45 -mt-1"></div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {account.description && (
                            <p className="text-xs text-corporate-gray">{account.description}</p>
                          )}
                        </td>
                        <td className="text-corporate-slate">{account.subtype}</td>
                        <td className="text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            nb === 'debit'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {nb === 'debit' ? 'DR' : 'CR'}
                          </span>
                        </td>
                        <td className="text-right font-semibold text-corporate-dark">
                          {formatCurrency(account.balance)}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openModal(account)}
                              className="p-2 text-corporate-gray hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(account)}
                              className="p-2 text-corporate-gray hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-corporate-dark">
                {editingAccount ? 'Edit Account' : 'Add New Account'}
              </h2>
              <button onClick={closeModal} className="p-2 text-corporate-gray hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Account Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="input-field font-mono"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="label">Account Type *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Account['type'], subtype: '' })}
                    className="input-field"
                  >
                    <option value="">Select type</option>
                    {accountTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                {/* DR/CR indicator */}
                {formData.type && (
                  <div className="col-span-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        normalBalanceByType[formData.type] === 'debit'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {normalBalanceByType[formData.type] === 'debit' ? 'DR' : 'CR'}
                      </span>
                      <span className="text-corporate-gray">
                        Normal balance: <strong>{normalBalanceByType[formData.type] === 'debit' ? 'Debit' : 'Credit'}</strong>
                        {' '}&mdash; {normalBalanceByType[formData.type] === 'debit'
                          ? 'Increases with debits, decreases with credits'
                          : 'Increases with credits, decreases with debits'}
                      </span>
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="label">Account Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="Cash"
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Subtype</label>
                  <select
                    value={formData.subtype}
                    onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                    className="input-field"
                    disabled={!formData.type}
                  >
                    <option value="">Select subtype</option>
                    {formData.type && subtypes[formData.type]?.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                  {/* Subtype help text preview */}
                  {formData.subtype && formData.type && (
                    <p className="text-xs text-corporate-gray mt-1">
                      {getAccountHelpText(formData.subtype, formData.type)}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="label">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows={2}
                    placeholder="Brief description of this account"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 btn-primary">
                  {saving ? 'Saving...' : editingAccount ? 'Update Account' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
