'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Entity {
  id: string;
  name: string;
}

interface IntercompanyTransaction {
  id: string;
  date: string;
  description: string;
  from_entity_id: string;
  from_entity_name: string;
  to_entity_id: string;
  to_entity_name: string;
  amount: number;
  type: string;
  status: 'pending' | 'approved' | 'posted' | 'voided';
  created_at: string;
}

const TRANSACTION_TYPES = [
  'Management Fee',
  'Loan',
  'Loan Repayment',
  'Cost Allocation',
  'Asset Transfer',
  'Dividend',
  'Capital Contribution',
  'Service Fee',
  'Other',
];

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'posted', 'voided'] as const;

export default function IntercompanyTransactionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [transactions, setTransactions] = useState<IntercompanyTransaction[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New transaction form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    from_entity_id: '',
    to_entity_id: '',
    type: 'Management Fee',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const [entitiesRes, txRes] = await Promise.all([
        fetch(`/api/entities?user_id=${user.id}`),
        fetch(`/api/intercompany-transactions?user_id=${user.id}`),
      ]);

      const entitiesResult = await entitiesRes.json();
      const txResult = await txRes.json();

      if (entitiesResult.success) {
        setEntities(entitiesResult.entities || []);
        if (entitiesResult.entities?.length >= 2) {
          setForm((prev) => ({
            ...prev,
            from_entity_id: prev.from_entity_id || entitiesResult.entities[0].id,
            to_entity_id: prev.to_entity_id || entitiesResult.entities[1].id,
          }));
        }
      }
      if (txResult.success) {
        setTransactions(txResult.transactions || []);
      }
    } catch (err) {
      console.error('Failed to load intercompany data:', err);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = statusFilter === 'all'
    ? transactions
    : transactions.filter((t) => t.status === statusFilter);

  const handleCreateTransaction = async () => {
    if (!form.from_entity_id || !form.to_entity_id) {
      setError('Please select both entities.');
      return;
    }
    if (form.from_entity_id === form.to_entity_id) {
      setError('From and To entities must be different.');
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const res = await fetch('/api/intercompany-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          user_id: user.id,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setShowForm(false);
        setForm({
          from_entity_id: entities[0]?.id || '',
          to_entity_id: entities[1]?.id || '',
          type: 'Management Fee',
          description: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
        });
        setSuccess('Transaction created.');
        setTimeout(() => setSuccess(''), 3000);
        await loadData();
      } else {
        setError(result.error || 'Failed to create transaction.');
      }
    } catch {
      setError('Failed to create transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (transactionId: string, action: 'approve' | 'post' | 'void') => {
    const confirmMsg = action === 'void'
      ? 'Are you sure you want to void this transaction?'
      : `Are you sure you want to ${action} this transaction?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/intercompany-transactions/${transactionId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (result.success) {
        setSuccess(`Transaction ${action === 'approve' ? 'approved' : action === 'post' ? 'posted' : 'voided'}.`);
        setTimeout(() => setSuccess(''), 3000);
        await loadData();
      } else {
        setError(result.error || `Failed to ${action} transaction.`);
      }
    } catch {
      setError(`Failed to ${action} transaction.`);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      posted: 'bg-green-100 text-green-800',
      voided: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div>
        <nav className="text-sm text-corporate-gray mb-2">
          <Link href="/dashboard/settings" className="hover:text-primary-600">Settings</Link>
          <span className="mx-2">/</span>
          <Link href="/dashboard/settings/entities" className="hover:text-primary-600">Entity Management</Link>
          <span className="mx-2">/</span>
          <span className="text-corporate-dark">Inter-company Transactions</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-corporate-dark">Inter-company Transactions</h1>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
            {showForm ? 'Cancel' : 'New Transaction'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
          <button onClick={() => setError('')} className="float-right font-bold">&times;</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      {/* New Transaction Form */}
      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-4">New Inter-company Transaction</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">From Entity</label>
              <select
                className="input-field"
                value={form.from_entity_id}
                onChange={(e) => setForm({ ...form, from_entity_id: e.target.value })}
              >
                <option value="">Select entity...</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">To Entity</label>
              <select
                className="input-field"
                value={form.to_entity_id}
                onChange={(e) => setForm({ ...form, to_entity_id: e.target.value })}
              >
                <option value="">Select entity...</option>
                {entities.filter((e) => e.id !== form.from_entity_id).map((entity) => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input-field"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {TRANSACTION_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <label className="label">Description</label>
              <input
                type="text"
                className="input-field"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Transaction description"
              />
            </div>
            <div>
              <label className="label">Amount</label>
              <input
                type="number"
                className="input-field"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input-field"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreateTransaction} disabled={saving} className="btn-primary">
              {saving ? 'Creating...' : 'Create Transaction'}
            </button>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-corporate-dark">Filter by status:</span>
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-corporate-gray hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Transactions Table */}
        {filteredTransactions.length === 0 ? (
          <p className="text-corporate-gray text-center py-8">
            {transactions.length === 0
              ? 'No inter-company transactions yet.'
              : 'No transactions match the selected filter.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="text-corporate-slate whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                    <td className="text-corporate-dark">{tx.description || '-'}</td>
                    <td className="text-corporate-slate">{tx.from_entity_name}</td>
                    <td className="text-corporate-slate">{tx.to_entity_name}</td>
                    <td className="text-corporate-dark font-medium whitespace-nowrap">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="text-corporate-slate text-sm">{tx.type}</td>
                    <td>{getStatusBadge(tx.status)}</td>
                    <td>
                      <div className="flex gap-2">
                        {tx.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleAction(tx.id, 'approve')}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleAction(tx.id, 'void')}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Void
                            </button>
                          </>
                        )}
                        {tx.status === 'approved' && (
                          <>
                            <button
                              onClick={() => handleAction(tx.id, 'post')}
                              className="text-green-600 hover:text-green-700 text-sm font-medium"
                            >
                              Post
                            </button>
                            <button
                              onClick={() => handleAction(tx.id, 'void')}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Void
                            </button>
                          </>
                        )}
                        {tx.status === 'posted' && (
                          <button
                            onClick={() => handleAction(tx.id, 'void')}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Void
                          </button>
                        )}
                        {tx.status === 'voided' && (
                          <span className="text-xs text-corporate-gray italic">No actions</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
