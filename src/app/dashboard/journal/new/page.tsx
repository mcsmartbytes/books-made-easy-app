'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface JournalLine {
  id: string;
  account_id: string | null;
  account_name: string;
  description: string;
  debit: number;
  credit: number;
}

export default function NewJournalEntryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [accountSearches, setAccountSearches] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    entry_number: `JE-${String(Date.now()).slice(-6)}`,
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [lines, setLines] = useState<JournalLine[]>([
    { id: '1', account_id: null, account_name: '', description: '', debit: 0, credit: 0 },
    { id: '2', account_id: null, account_name: '', description: '', debit: 0, credit: 0 },
  ]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: accountsData } = await supabase
      .from('accounts')
      .select('id, code, name, type')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('code');

    setAccounts(accountsData || []);
  };

  const selectAccount = (lineId: string, account: Account) => {
    setLines(lines.map(line =>
      line.id === lineId
        ? { ...line, account_id: account.id, account_name: `${account.code} - ${account.name}` }
        : line
    ));
    setActiveDropdown(null);
    setAccountSearches({ ...accountSearches, [lineId]: '' });
  };

  const getFilteredAccounts = (lineId: string) => {
    const search = accountSearches[lineId] || '';
    return accounts.filter(a =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase())
    );
  };

  const addLine = () => {
    setLines([
      ...lines,
      { id: String(Date.now()), account_id: null, account_name: '', description: '', debit: 0, credit: 0 },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 2) {
      setLines(lines.filter(line => line.id !== id));
    }
  };

  const updateLine = (id: string, field: keyof JournalLine, value: string | number | null) => {
    setLines(lines.map(line => {
      if (line.id !== id) return line;

      // If entering debit, clear credit and vice versa
      if (field === 'debit' && value) {
        return { ...line, debit: value as number, credit: 0 };
      }
      if (field === 'credit' && value) {
        return { ...line, credit: value as number, debit: 0 };
      }

      return { ...line, [field]: value };
    }));
  };

  const totalDebits = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredits = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent, status: 'draft' | 'posted') => {
    e.preventDefault();

    if (!formData.description) {
      alert('Please enter a description');
      return;
    }

    const validLines = lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) {
      alert('Please enter at least two lines with accounts and amounts');
      return;
    }

    if (status === 'posted' && !isBalanced) {
      alert('Debits and credits must be equal to post this entry');
      return;
    }

    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Create journal entry
    const { data: entry, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: session.user.id,
        entry_number: formData.entry_number,
        entry_date: formData.entry_date,
        description: formData.description,
        status,
        total_debits: totalDebits,
        total_credits: totalCredits,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating journal entry:', error);
      alert('Error creating journal entry: ' + error.message);
      setLoading(false);
      return;
    }

    // Create journal lines
    const linesToInsert = validLines.map((line, index) => ({
      journal_entry_id: entry.id,
      account_id: line.account_id,
      description: line.description,
      debit: line.debit || 0,
      credit: line.credit || 0,
      sort_order: index,
    }));

    const { error: linesError } = await supabase.from('journal_entry_lines').insert(linesToInsert);

    if (linesError) {
      console.error('Error creating journal lines:', linesError);
    }

    router.push('/dashboard/journal');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">New Journal Entry</h1>
          <p className="text-corporate-gray mt-1">Create a manual accounting entry</p>
        </div>
        <Link href="/dashboard/journal" className="btn-secondary">Cancel</Link>
      </div>

      <form onSubmit={(e) => handleSubmit(e, 'draft')}>
        {/* Entry Details */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-corporate-dark mb-4">Entry Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Entry Number</label>
              <input
                type="text"
                value={formData.entry_number}
                onChange={(e) => setFormData({ ...formData, entry_number: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div className="sm:col-span-1">
              <label className="label">Description *</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field"
                placeholder="e.g., Monthly depreciation"
                required
              />
            </div>
          </div>
        </div>

        {/* Journal Lines */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-corporate-dark mb-4">Journal Lines</h2>
          <div className="space-y-4">
            <div className="hidden sm:grid sm:grid-cols-12 gap-4 text-xs font-semibold text-corporate-gray uppercase">
              <div className="col-span-4">Account</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-2 text-right">Debit</div>
              <div className="col-span-2 text-right">Credit</div>
              <div className="col-span-1"></div>
            </div>

            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-12 gap-4 items-start p-4 bg-gray-50 rounded-lg">
                <div className="col-span-12 sm:col-span-4 relative">
                  <label className="label sm:hidden">Account</label>
                  <input
                    type="text"
                    value={activeDropdown === line.id ? (accountSearches[line.id] || '') : line.account_name}
                    onChange={(e) => {
                      setAccountSearches({ ...accountSearches, [line.id]: e.target.value });
                      setActiveDropdown(line.id);
                    }}
                    onFocus={() => setActiveDropdown(line.id)}
                    className="input-field"
                    placeholder="Search accounts..."
                  />
                  {activeDropdown === line.id && accounts.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                      {getFilteredAccounts(line.id).map(account => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => selectAccount(line.id, account)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50"
                        >
                          <span className="font-medium text-corporate-dark">{account.code}</span>
                          <span className="text-corporate-gray ml-2">{account.name}</span>
                          <span className="text-xs text-corporate-gray ml-2">({account.type})</span>
                        </button>
                      ))}
                      {getFilteredAccounts(line.id).length === 0 && (
                        <div className="px-4 py-2 text-corporate-gray text-sm">No accounts found</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="col-span-12 sm:col-span-3">
                  <label className="label sm:hidden">Description</label>
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                    className="input-field"
                    placeholder="Line description"
                  />
                </div>
                <div className="col-span-5 sm:col-span-2">
                  <label className="label sm:hidden">Debit</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.debit || ''}
                    onChange={(e) => updateLine(line.id, 'debit', parseFloat(e.target.value) || 0)}
                    className="input-field text-right"
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-5 sm:col-span-2">
                  <label className="label sm:hidden">Credit</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.credit || ''}
                    onChange={(e) => updateLine(line.id, 'credit', parseFloat(e.target.value) || 0)}
                    className="input-field text-right"
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                  {lines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="p-2 text-corporate-gray hover:text-red-600 rounded-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Line
            </button>
          </div>
        </div>

        {/* Totals & Submit */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex gap-8">
              <div>
                <p className="text-sm text-corporate-gray">Total Debits</p>
                <p className="text-xl font-bold text-corporate-dark">{formatCurrency(totalDebits)}</p>
              </div>
              <div>
                <p className="text-sm text-corporate-gray">Total Credits</p>
                <p className="text-xl font-bold text-corporate-dark">{formatCurrency(totalCredits)}</p>
              </div>
              <div>
                <p className="text-sm text-corporate-gray">Difference</p>
                <p className={`text-xl font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(totalDebits - totalCredits))}
                </p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
              isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {isBalanced ? '✓ Balanced' : '✗ Out of Balance'}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="submit"
              disabled={loading}
              className="btn-secondary disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent, 'posted')}
              disabled={loading || !isBalanced}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Post Entry'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
