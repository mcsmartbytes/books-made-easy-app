'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  status: string;
  matched_transaction_type: string | null;
  matched_transaction_id: string | null;
}

interface MatchCandidate {
  id: string;
  type: 'invoice' | 'bill' | 'expense' | 'payment';
  date: string;
  description: string;
  amount: number;
  reference: string;
}

export default function MatchPage() {
  const params = useParams();
  const accountId = params.id as string;

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<BankTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchingTxn, setMatchingTxn] = useState<string | null>(null);

  useEffect(() => {
    loadUnmatched();
  }, [accountId]);

  const loadUnmatched = async () => {
    const { data, error } = await supabase
      .from('bank-transactions')
      .select('*')
      .eq('bank_account_id', accountId);

    if (!error && data) {
      const unmatched = (data as BankTransaction[]).filter(t => t.status !== 'matched' && t.status !== 'excluded');
      setTransactions(unmatched);
    }
    setLoading(false);
  };

  const findMatches = async (txn: BankTransaction) => {
    setSelectedTxn(txn);
    setCandidates([]);

    // Find potential matches from invoices, bills, expenses, and payments
    const results: MatchCandidate[] = [];

    if (txn.type === 'credit') {
      // Credits could match invoices (payments received) or payment refunds
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, issue_date, total, status');

      if (invoices) {
        for (const inv of invoices as { id: string; invoice_number: string; issue_date: string; total: number; status: string }[]) {
          if (Math.abs(inv.total - txn.amount) < 0.01 && inv.status !== 'paid') {
            results.push({
              id: inv.id,
              type: 'invoice',
              date: inv.issue_date,
              description: `Invoice ${inv.invoice_number}`,
              amount: inv.total,
              reference: inv.invoice_number,
            });
          }
        }
      }
    }

    if (txn.type === 'debit') {
      // Debits could match bills or expenses
      const { data: bills } = await supabase
        .from('bills')
        .select('id, bill_number, bill_date, total, status');

      if (bills) {
        for (const bill of bills as { id: string; bill_number: string; bill_date: string; total: number; status: string }[]) {
          if (Math.abs(bill.total - txn.amount) < 0.01 && bill.status !== 'paid') {
            results.push({
              id: bill.id,
              type: 'bill',
              date: bill.bill_date,
              description: `Bill ${bill.bill_number}`,
              amount: bill.total,
              reference: bill.bill_number,
            });
          }
        }
      }

      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, vendor, date, amount, description');

      if (expenses) {
        for (const exp of expenses as { id: string; vendor: string; date: string; amount: number; description: string }[]) {
          if (Math.abs(exp.amount - txn.amount) < 0.01) {
            results.push({
              id: exp.id,
              type: 'expense',
              date: exp.date,
              description: `Expense: ${exp.vendor || exp.description}`,
              amount: exp.amount,
              reference: '',
            });
          }
        }
      }
    }

    setCandidates(results);
  };

  const handleMatch = async (txnId: string, candidate: MatchCandidate) => {
    setMatchingTxn(txnId);
    await supabase.from('bank-transactions').update({
      status: 'matched',
      matched_transaction_type: candidate.type,
      matched_transaction_id: candidate.id,
    }).eq('id', txnId);

    setSelectedTxn(null);
    setCandidates([]);
    setMatchingTxn(null);
    loadUnmatched();
  };

  const handleExclude = async (txnId: string) => {
    await supabase.from('bank-transactions').update({ status: 'excluded' }).eq('id', txnId);
    setSelectedTxn(null);
    loadUnmatched();
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
          <Link href={`/dashboard/banking/${accountId}`} className="hover:text-primary-600">Account</Link>
          <span>/</span>
          <span>Match Transactions</span>
        </div>
        <h1 className="text-2xl font-bold text-corporate-dark">Match Transactions</h1>
        <p className="text-corporate-gray mt-1">
          Match bank transactions to invoices, bills, and expenses.
          {transactions.length > 0 && ` ${transactions.length} unmatched transactions.`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Bank Transactions */}
        <div>
          <h3 className="text-sm font-semibold text-corporate-dark uppercase tracking-wider mb-3">Bank Transactions</h3>
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="card text-center py-8">
                <svg className="w-12 h-12 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-corporate-gray">All transactions are matched or excluded.</p>
                <Link href={`/dashboard/banking/${accountId}`} className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block">
                  Back to Account
                </Link>
              </div>
            ) : (
              transactions.map((txn) => (
                <div
                  key={txn.id}
                  onClick={() => findMatches(txn)}
                  className={`card cursor-pointer transition-all ${
                    selectedTxn?.id === txn.id
                      ? 'ring-2 ring-primary-500 bg-primary-50'
                      : 'hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-corporate-dark">{txn.description}</p>
                      <p className="text-xs text-corporate-gray">{new Date(txn.date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.type === 'debit' ? '-' : '+'}{formatCurrency(txn.amount)}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExclude(txn.id); }}
                        className="text-xs text-gray-400 hover:text-red-500 mt-1"
                      >
                        Exclude
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Matching Candidates */}
        <div>
          <h3 className="text-sm font-semibold text-corporate-dark uppercase tracking-wider mb-3">
            {selectedTxn ? 'Potential Matches' : 'Select a Transaction'}
          </h3>
          {!selectedTxn ? (
            <div className="card text-center py-12 bg-gray-50">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <p className="text-corporate-gray">Click a bank transaction to find matches</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="card text-center py-8 bg-yellow-50">
              <svg className="w-12 h-12 text-yellow-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-corporate-gray mb-2">No exact matches found for {formatCurrency(selectedTxn.amount)}</p>
              <p className="text-xs text-corporate-gray">You can manually review and mark as reviewed, or exclude this transaction.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <div key={`${candidate.type}-${candidate.id}`} className="card hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          candidate.type === 'invoice' ? 'bg-blue-100 text-blue-700' :
                          candidate.type === 'bill' ? 'bg-orange-100 text-orange-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {candidate.type.charAt(0).toUpperCase() + candidate.type.slice(1)}
                        </span>
                        <p className="font-medium text-corporate-dark">{candidate.description}</p>
                      </div>
                      <p className="text-xs text-corporate-gray mt-1">
                        {new Date(candidate.date).toLocaleDateString()}
                        {candidate.reference && ` - ${candidate.reference}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-corporate-dark">{formatCurrency(candidate.amount)}</p>
                      <button
                        onClick={() => handleMatch(selectedTxn.id, candidate)}
                        disabled={matchingTxn === selectedTxn.id}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {matchingTxn === selectedTxn.id ? 'Matching...' : 'Match'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
