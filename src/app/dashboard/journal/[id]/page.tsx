'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status: 'draft' | 'posted';
  total_debits: number;
  total_credits: number;
  created_at: string;
}

interface JournalLine {
  id: string;
  account_id: string;
  description: string;
  debit: number;
  credit: number;
  accounts?: {
    code: string;
    name: string;
    type: string;
  };
}

export default function JournalEntryDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadEntry();
  }, [params.id]);

  const loadEntry = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: entryData, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !entryData) {
      router.push('/dashboard/journal');
      return;
    }

    setEntry(entryData);

    const { data: linesData } = await supabase
      .from('journal_entry_lines')
      .select(`
        *,
        accounts (code, name, type)
      `)
      .eq('journal_entry_id', params.id)
      .order('sort_order');

    setLines(linesData || []);
    setLoading(false);
  };

  const postEntry = async () => {
    if (!entry || entry.status === 'posted') return;

    // Check if balanced
    if (Math.abs(entry.total_debits - entry.total_credits) >= 0.01) {
      alert('Cannot post: Debits and credits must be equal');
      return;
    }

    setPosting(true);

    const { error } = await supabase
      .from('journal_entries')
      .update({ status: 'posted' })
      .eq('id', entry.id);

    if (!error) {
      setEntry({ ...entry, status: 'posted' });
    }
    setPosting(false);
  };

  const deleteEntry = async () => {
    if (!entry || entry.status === 'posted') return;

    if (!confirm('Are you sure you want to delete this journal entry?')) return;

    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', entry.id);

    if (!error) {
      router.push('/dashboard/journal');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (loading || !entry) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const isBalanced = Math.abs(entry.total_debits - entry.total_credits) < 0.01;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard/journal" className="text-corporate-gray hover:text-corporate-dark">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-lg font-semibold text-corporate-dark">{entry.entry_number}</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              entry.status === 'posted'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {entry.status === 'posted' ? 'Posted' : 'Draft'}
            </span>
          </div>
          <p className="text-corporate-gray">{formatDate(entry.entry_date)}</p>
        </div>
        <div className="flex items-center gap-3">
          {entry.status === 'draft' && (
            <>
              <button
                onClick={postEntry}
                disabled={posting || !isBalanced}
                className="btn-primary disabled:opacity-50"
              >
                {posting ? 'Posting...' : 'Post Entry'}
              </button>
              <Link href={`/dashboard/journal/${entry.id}/edit`} className="btn-secondary">
                Edit
              </Link>
              <button
                onClick={deleteEntry}
                className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Entry Details */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-sm text-corporate-gray">Entry Number</p>
            <p className="font-medium text-corporate-dark">{entry.entry_number}</p>
          </div>
          <div>
            <p className="text-sm text-corporate-gray">Date</p>
            <p className="font-medium text-corporate-dark">{formatDate(entry.entry_date)}</p>
          </div>
          <div>
            <p className="text-sm text-corporate-gray">Status</p>
            <p className={`font-medium ${entry.status === 'posted' ? 'text-green-600' : 'text-yellow-600'}`}>
              {entry.status === 'posted' ? 'Posted' : 'Draft'}
            </p>
          </div>
        </div>
        <div>
          <p className="text-sm text-corporate-gray mb-1">Description</p>
          <p className="text-corporate-dark">{entry.description}</p>
        </div>
      </div>

      {/* Journal Lines */}
      <div className="card">
        <h2 className="text-lg font-semibold text-corporate-dark mb-4">Journal Lines</h2>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Description</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <p className="font-medium text-corporate-dark">
                      {line.accounts?.code} - {line.accounts?.name}
                    </p>
                    <p className="text-xs text-corporate-gray">{line.accounts?.type}</p>
                  </td>
                  <td className="text-corporate-slate">{line.description || '—'}</td>
                  <td className="text-right font-medium text-corporate-dark">
                    {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                  </td>
                  <td className="text-right font-medium text-corporate-dark">
                    {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={2} className="font-semibold text-corporate-dark">Totals</td>
                <td className="text-right font-bold text-corporate-dark">
                  {formatCurrency(entry.total_debits)}
                </td>
                <td className="text-right font-bold text-corporate-dark">
                  {formatCurrency(entry.total_credits)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={`mt-4 p-4 rounded-lg ${isBalanced ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-center justify-between">
            <span className={`font-medium ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
              {isBalanced ? '✓ Entry is balanced' : '✗ Entry is out of balance'}
            </span>
            {!isBalanced && (
              <span className="text-red-700 font-medium">
                Difference: {formatCurrency(Math.abs(entry.total_debits - entry.total_credits))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Audit Info */}
      <div className="card bg-gray-50">
        <p className="text-sm text-corporate-gray">
          Created on {new Date(entry.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
