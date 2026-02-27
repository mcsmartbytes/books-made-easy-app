'use client';

import { useEffect, useState } from 'react';
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

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted'>('all');

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: entriesData, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .order('entry_date', { ascending: false });

    if (!error) {
      setEntries(entriesData || []);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch =
      entry.entry_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totals = {
    drafts: entries.filter(e => e.status === 'draft').length,
    posted: entries.filter(e => e.status === 'posted').length,
    totalDebits: entries.filter(e => e.status === 'posted').reduce((sum, e) => sum + e.total_debits, 0),
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
          <h1 className="text-2xl font-bold text-corporate-dark">Journal Entries</h1>
          <p className="text-corporate-gray mt-1">Manual accounting adjustments and entries</p>
        </div>
        <Link href="/dashboard/journal/new" className="btn-primary flex items-center gap-2 justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Entry
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-primary-200" onClick={() => setStatusFilter('all')}>
          <p className="text-sm text-corporate-gray">Total Entries</p>
          <p className="text-2xl font-bold text-corporate-dark">{entries.length}</p>
          <p className="text-xs text-corporate-gray">all time</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-yellow-200" onClick={() => setStatusFilter('draft')}>
          <p className="text-sm text-corporate-gray">Drafts</p>
          <p className="text-2xl font-bold text-yellow-600">{totals.drafts}</p>
          <p className="text-xs text-corporate-gray">unposted entries</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-green-200" onClick={() => setStatusFilter('posted')}>
          <p className="text-sm text-corporate-gray">Posted</p>
          <p className="text-2xl font-bold text-green-600">{totals.posted}</p>
          <p className="text-xs text-corporate-gray">{formatCurrency(totals.totalDebits)} total</p>
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
              placeholder="Search entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="input-field w-auto"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
          </select>
        </div>
      </div>

      {/* Entries table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Entry #</th>
                <th>Date</th>
                <th>Description</th>
                <th>Status</th>
                <th className="text-right">Debits</th>
                <th className="text-right">Credits</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-corporate-gray">
                    {entries.length === 0 ? (
                      <div className="space-y-2">
                        <p>No journal entries yet</p>
                        <Link href="/dashboard/journal/new" className="text-primary-600 hover:underline">
                          Create your first entry
                        </Link>
                      </div>
                    ) : (
                      'No entries found matching your search'
                    )}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <Link href={`/dashboard/journal/${entry.id}`} className="font-medium text-primary-600 hover:text-primary-700">
                        {entry.entry_number}
                      </Link>
                    </td>
                    <td className="text-corporate-slate">{formatDate(entry.entry_date)}</td>
                    <td className="text-corporate-dark max-w-xs truncate">{entry.description}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        entry.status === 'posted'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {entry.status === 'posted' ? 'Posted' : 'Draft'}
                      </span>
                    </td>
                    <td className="text-right font-medium text-corporate-dark">
                      {formatCurrency(entry.total_debits)}
                    </td>
                    <td className="text-right font-medium text-corporate-dark">
                      {formatCurrency(entry.total_credits)}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/journal/${entry.id}`}
                          className="p-2 text-corporate-gray hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        {entry.status === 'draft' && (
                          <Link
                            href={`/dashboard/journal/${entry.id}/edit`}
                            className="p-2 text-corporate-gray hover:text-corporate-slate hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                        )}
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
