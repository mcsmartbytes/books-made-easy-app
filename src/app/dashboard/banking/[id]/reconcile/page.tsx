'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { getSession } from 'next-auth/react';

interface BankAccount {
  id: string;
  name: string;
  institution: string;
  last_reconciled_date: string | null;
  last_reconciled_balance: number;
  current_balance: number;
}

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  is_reconciled: number;
  reconciliation_id: string | null;
  check_number: string;
  reference: string;
}

interface Reconciliation {
  id: string;
  statement_date: string;
  statement_balance: number;
  opening_balance: number;
  cleared_balance: number;
  difference: number;
  status: string;
}

export default function ReconcilePage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'setup' | 'reconcile'>('setup');
  const [statementDate, setStatementDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    loadAccount();
  }, [accountId]);

  const loadAccount = async () => {
    const { data, error } = await supabase.from('bank-accounts').select('*').eq('id', accountId).single();
    if (!error && data) setAccount(data as BankAccount);
    setLoading(false);
  };

  const handleStartReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;

    const response = await fetch('/api/reconciliations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        bank_account_id: accountId,
        statement_date: statementDate,
        statement_balance: parseFloat(statementBalance),
      }),
    });

    const result = await response.json();
    if (result.success) {
      setReconciliation(result.data);
      // Load unreconciled transactions
      const { data: txns } = await supabase
        .from('bank-transactions')
        .select('*')
        .eq('bank_account_id', accountId);

      const unreconciled = ((txns || []) as BankTransaction[]).filter(
        t => !t.is_reconciled && t.date <= statementDate
      );
      setTransactions(unreconciled);
      setStep('reconcile');
    }
  };

  const toggleTransaction = async (txnId: string) => {
    if (!reconciliation) return;

    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;

    const response = await fetch('/api/reconciliations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: reconciliation.id,
        user_id: userId,
        action: 'toggle_transaction',
        transaction_id: txnId,
      }),
    });

    const result = await response.json();
    if (result.success) {
      const newCleared = new Set(clearedIds);
      if (newCleared.has(txnId)) {
        newCleared.delete(txnId);
      } else {
        newCleared.add(txnId);
      }
      setClearedIds(newCleared);
      setReconciliation(prev => prev ? {
        ...prev,
        cleared_balance: result.data.cleared_balance,
        difference: result.data.difference,
      } : null);
    }
  };

  const handleComplete = async () => {
    if (!reconciliation) return;
    setCompleting(true);

    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;

    const response = await fetch('/api/reconciliations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: reconciliation.id,
        user_id: userId,
        action: 'complete',
      }),
    });

    const result = await response.json();
    if (result.success) {
      router.push(`/dashboard/banking/${accountId}`);
    } else {
      alert(result.error || 'Failed to complete reconciliation');
    }
    setCompleting(false);
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
          <Link href="/dashboard/banking" className="hover:text-primary-600">Banking</Link>
          <span>/</span>
          <Link href={`/dashboard/banking/${accountId}`} className="hover:text-primary-600">{account?.name || 'Account'}</Link>
          <span>/</span>
          <span>Reconcile</span>
        </div>
        <h1 className="text-2xl font-bold text-corporate-dark">Reconcile Account</h1>
        <p className="text-corporate-gray mt-1">Match your records against your bank statement</p>
      </div>

      {/* Setup Step */}
      {step === 'setup' && (
        <div className="card max-w-lg">
          <h3 className="text-lg font-medium text-corporate-dark mb-4">Statement Information</h3>
          {account?.last_reconciled_date && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
              <p className="text-blue-700">
                Last reconciled: <strong>{new Date(account.last_reconciled_date).toLocaleDateString()}</strong> with balance of <strong>{formatCurrency(account.last_reconciled_balance)}</strong>
              </p>
            </div>
          )}
          <form onSubmit={handleStartReconciliation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-corporate-dark mb-1">Statement Date *</label>
              <input
                type="date"
                required
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-corporate-dark mb-1">Statement Ending Balance *</label>
              <input
                type="number"
                step="0.01"
                required
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                placeholder="0.00"
                className="input-field"
              />
              <p className="text-xs text-corporate-gray mt-1">Enter the ending balance shown on your bank statement</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Link href={`/dashboard/banking/${accountId}`} className="px-4 py-2 border border-gray-300 rounded-lg text-corporate-slate hover:bg-gray-50">
                Cancel
              </Link>
              <button type="submit" className="btn-primary">Start Reconciliation</button>
            </div>
          </form>
        </div>
      )}

      {/* Reconcile Step */}
      {step === 'reconcile' && reconciliation && (
        <>
          {/* Reconciliation Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Statement Balance</p>
              <p className="text-xl font-bold text-corporate-dark">{formatCurrency(reconciliation.statement_balance)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Cleared Balance</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(reconciliation.cleared_balance)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Difference</p>
              <p className={`text-xl font-bold ${Math.abs(reconciliation.difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(reconciliation.difference)}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-corporate-gray">Cleared Items</p>
              <p className="text-xl font-bold text-corporate-dark">
                {clearedIds.size} / {transactions.length}
              </p>
            </div>
          </div>

          {/* Transactions to Clear */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-corporate-dark">Unreconciled Transactions</h3>
              <p className="text-sm text-corporate-gray">
                Click a transaction to mark it as cleared
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10"></th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Reference</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-corporate-gray">
                        No unreconciled transactions found for this date range.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((txn) => {
                      const isCleared = clearedIds.has(txn.id);
                      return (
                        <tr
                          key={txn.id}
                          onClick={() => toggleTransaction(txn.id)}
                          className={`cursor-pointer transition-colors ${isCleared ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}`}
                        >
                          <td>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isCleared ? 'bg-green-500 border-green-500' : 'border-gray-300'
                            }`}>
                              {isCleared && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap">{new Date(txn.date).toLocaleDateString()}</td>
                          <td className="font-medium text-corporate-dark">{txn.description}</td>
                          <td className="text-sm text-corporate-gray">
                            {txn.check_number ? `Check #${txn.check_number}` : txn.reference || '-'}
                          </td>
                          <td className="text-right font-medium text-red-600">
                            {txn.type === 'debit' ? formatCurrency(txn.amount) : ''}
                          </td>
                          <td className="text-right font-medium text-green-600">
                            {txn.type === 'credit' ? formatCurrency(txn.amount) : ''}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Complete Button */}
          <div className="flex items-center justify-between">
            <Link href={`/dashboard/banking/${accountId}`} className="px-4 py-2 border border-gray-300 rounded-lg text-corporate-slate hover:bg-gray-50">
              Save & Finish Later
            </Link>
            <button
              onClick={handleComplete}
              disabled={completing || Math.abs(reconciliation.difference) > 0.01}
              className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 ${
                Math.abs(reconciliation.difference) < 0.01
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {completing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              Finish Reconciliation
            </button>
          </div>
        </>
      )}
    </div>
  );
}
