'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSession } from 'next-auth/react';

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string;
  notes: string;
  invoices?: { id: string; invoice_number: string; total: number } | null;
  customers?: { id: string; name: string } | null;
}

interface BankAccount {
  id: string;
  name: string;
  institution: string;
  account_type: string;
}

export default function NewDepositPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bankAccountId, setBankAccountId] = useState('');
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;

    const [paymentsRes, accountsRes] = await Promise.all([
      fetch(`/api/deposits?user_id=${userId}&undeposited=true`).then(r => r.json()),
      fetch(`/api/bank-accounts?user_id=${userId}`).then(r => r.json()),
    ]);

    if (paymentsRes.success) setPayments(paymentsRes.data);
    if (accountsRes.success) setBankAccounts(accountsRes.data);
    setLoading(false);
  };

  const togglePayment = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === payments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(payments.map(p => p.id)));
    }
  };

  const selectedTotal = payments
    .filter(p => selectedIds.has(p.id))
    .reduce((sum, p) => sum + p.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) {
      setError('Please select at least one payment.');
      return;
    }

    setSubmitting(true);
    setError('');

    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;

    const response = await fetch('/api/deposits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        bank_account_id: bankAccountId || null,
        deposit_date: depositDate,
        memo: memo || null,
        payment_ids: Array.from(selectedIds),
      }),
    });

    const result = await response.json();
    if (result.success) {
      router.push('/dashboard/deposits');
    } else {
      setError(result.error || 'Failed to create deposit');
    }
    setSubmitting(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
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
      <div>
        <div className="flex items-center gap-2 text-sm text-corporate-gray mb-1">
          <Link href="/dashboard/deposits" className="hover:text-primary-600">Deposits</Link>
          <span>/</span>
          <span>New Deposit</span>
        </div>
        <h1 className="text-2xl font-bold text-corporate-dark">New Deposit</h1>
        <p className="text-corporate-gray mt-1">Select payments to include in this deposit</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {payments.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-corporate-dark mb-2">No Undeposited Payments</h3>
          <p className="text-corporate-gray mb-4">All received payments have been deposited.</p>
          <Link href="/dashboard/payments/receive" className="text-primary-600 hover:text-primary-700">
            Record a new payment
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Deposit Details */}
          <div className="card mb-6">
            <h3 className="text-lg font-medium text-corporate-dark mb-4">Deposit Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-corporate-dark mb-1">Deposit Date</label>
                <input
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-corporate-dark mb-1">Bank Account</label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="input-field"
                >
                  <option value="">-- Select Account --</option>
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.institution || a.account_type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-corporate-dark mb-1">Memo</label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Optional note"
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Payment Selection */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-corporate-dark">
                Select Payments ({selectedIds.size} of {payments.length} selected)
              </h3>
              <button
                type="button"
                onClick={selectAll}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {selectedIds.size === payments.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10"></th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const isSelected = selectedIds.has(payment.id);
                    return (
                      <tr
                        key={payment.id}
                        onClick={() => togglePayment(payment.id)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                      >
                        <td>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap">{new Date(payment.payment_date).toLocaleDateString()}</td>
                        <td className="font-medium text-corporate-dark">
                          {payment.customers?.name || '-'}
                        </td>
                        <td>
                          {payment.invoices ? (
                            <span className="text-primary-600">{payment.invoices.invoice_number}</span>
                          ) : '-'}
                        </td>
                        <td>
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs capitalize">
                            {(payment.payment_method || 'other').replace('_', ' ')}
                          </span>
                        </td>
                        <td className="text-sm text-corporate-gray">{payment.reference_number || '-'}</td>
                        <td className="text-right font-semibold text-corporate-dark">
                          {formatCurrency(payment.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-6">
            <Link href="/dashboard/deposits" className="px-4 py-2 border border-gray-300 rounded-lg text-corporate-slate hover:bg-gray-50">
              Cancel
            </Link>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-corporate-gray">Deposit Total</p>
                <p className="text-2xl font-bold text-corporate-dark">{formatCurrency(selectedTotal)}</p>
              </div>
              <button
                type="submit"
                disabled={submitting || selectedIds.size === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Create Deposit
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
