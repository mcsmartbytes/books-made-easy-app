'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { expensesSupabase } from '@/utils/expensesSupabase';

interface Subscription {
  id: string;
  vendor: string;
  avg_amount: number;
  min_amount: number;
  max_amount: number;
  frequency: string;
  confidence: number;
  first_seen: string;
  last_seen: string;
  next_expected: string;
  occurrence_count: number;
  category_name: string | null;
  is_confirmed: boolean;
  is_active: boolean;
  price_history?: PriceHistory[];
}

interface PriceHistory {
  amount: number;
  detected_date: string;
  price_change: number;
  price_change_pct: number;
}

interface DuplicateGroup {
  category: string;
  subscriptions: { vendor: string; avg_amount: number }[];
  total_monthly: number;
}

export default function SubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view subscriptions.');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/expenses/subscriptions?user_id=${user.id}&include_price_history=true`);
      const data = await res.json();

      if (data.success) {
        setSubscriptions(data.data || []);
        calculateTotals(data.data || []);
      }
    } catch (err) {
      console.error('Error loading subscriptions:', err);
      setError('Failed to load subscriptions.');
    } finally {
      setLoading(false);
    }
  }

  async function runDetection() {
    setDetecting(true);
    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) return;

      const res = await fetch('/api/expenses/subscriptions/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, lookback_months: 12 }),
      });

      const data = await res.json();

      if (data.success) {
        setSubscriptions(data.data.subscriptions || []);
        setDuplicates(data.data.duplicates || []);
        setTotalMonthly(data.data.total_monthly || 0);
        await loadSubscriptions();
      }
    } catch (err) {
      console.error('Error detecting subscriptions:', err);
    } finally {
      setDetecting(false);
    }
  }

  async function confirmSubscription(id: string) {
    try {
      await fetch('/api/expenses/subscriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_confirmed: true }),
      });
      setSubscriptions(prev =>
        prev.map(s => (s.id === id ? { ...s, is_confirmed: true } : s))
      );
    } catch (err) {
      console.error('Error confirming subscription:', err);
    }
  }

  async function dismissSubscription(id: string) {
    try {
      await fetch('/api/expenses/subscriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_dismissed: true }),
      });
      setSubscriptions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error dismissing subscription:', err);
    }
  }

  function calculateTotals(subs: Subscription[]) {
    let monthly = 0;
    for (const sub of subs) {
      switch (sub.frequency) {
        case 'weekly':
          monthly += sub.avg_amount * 4.33;
          break;
        case 'biweekly':
          monthly += sub.avg_amount * 2.17;
          break;
        case 'monthly':
          monthly += sub.avg_amount;
          break;
        case 'quarterly':
          monthly += sub.avg_amount / 3;
          break;
        case 'annually':
          monthly += sub.avg_amount / 12;
          break;
        default:
          monthly += sub.avg_amount;
      }
    }
    setTotalMonthly(monthly);
  }

  function getConfidenceBadge(confidence: number) {
    if (confidence >= 0.8) return { label: 'High', color: 'bg-green-100 text-green-800' };
    if (confidence >= 0.5) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Low', color: 'bg-gray-100 text-gray-800' };
  }

  function getFrequencyLabel(frequency: string) {
    const labels: Record<string, string> = {
      weekly: 'Weekly',
      biweekly: 'Every 2 weeks',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      annually: 'Yearly',
      irregular: 'Irregular',
    };
    return labels[frequency] || frequency;
  }

  function getPriceChange(sub: Subscription) {
    if (!sub.price_history || sub.price_history.length < 2) return null;
    const latest = sub.price_history[sub.price_history.length - 1];
    if (Math.abs(latest.price_change_pct) < 1) return null;
    return latest;
  }

  const confirmedSubs = subscriptions.filter(s => s.is_confirmed);
  const detectedSubs = subscriptions.filter(s => !s.is_confirmed);
  const priceIncreases = subscriptions.filter(s => {
    const change = getPriceChange(s);
    return change && change.price_change_pct > 0;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-red-500">{error}</p>
          <Link href="/login" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Intelligence</h1>
          <p className="text-sm text-gray-600 mt-1">
            Auto-detected recurring charges from your expenses
          </p>
        </div>
        <button
          onClick={runDetection}
          disabled={detecting}
          className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold disabled:opacity-50 flex items-center gap-2"
        >
          {detecting ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Scanning...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scan Expenses
            </>
          )}
        </button>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Monthly Cost</p>
          <p className="mt-2 text-3xl font-bold text-purple-600">
            ${totalMonthly.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">${(totalMonthly * 12).toFixed(0)}/year</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Detected</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{subscriptions.length}</p>
          <p className="text-xs text-gray-500 mt-1">{confirmedSubs.length} confirmed</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Price Increases</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{priceIncreases.length}</p>
          <p className="text-xs text-gray-500 mt-1">Since last charge</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Review Needed</p>
          <p className="mt-2 text-3xl font-bold text-sky-600">{detectedSubs.length}</p>
          <p className="text-xs text-gray-500 mt-1">Unconfirmed</p>
        </div>
      </div>

      {/* Duplicate Warnings */}
      {duplicates.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-lg font-semibold text-amber-900 mb-3">
            Potential Duplicates Detected
          </h3>
          <div className="space-y-3">
            {duplicates.map((group, idx) => (
              <div key={idx} className="bg-white rounded-lg p-3 border border-amber-200">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {group.category}: {group.subscriptions.length} services
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.subscriptions.map((sub, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
                    >
                      {sub.vendor} (${sub.avg_amount.toFixed(2)})
                    </span>
                  ))}
                </div>
                <p className="text-xs text-amber-700 mt-2">
                  Combined: ${group.total_monthly.toFixed(2)}/month
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscriptions List */}
      {subscriptions.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Subscriptions Detected</h3>
          <p className="text-gray-500 mb-4">
            Click &quot;Scan Expenses&quot; to analyze your expense history for recurring charges.
          </p>
          <button
            onClick={runDetection}
            disabled={detecting}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            {detecting ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900">All Subscriptions</h2>
          </div>
          <div className="divide-y">
            {subscriptions.map(sub => {
              const priceChange = getPriceChange(sub);
              const badge = getConfidenceBadge(sub.confidence);

              return (
                <div key={sub.id} className="p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{sub.vendor}</h3>
                        {sub.is_confirmed && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            Confirmed
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${badge.color}`}>
                          {badge.label} confidence
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span>{getFrequencyLabel(sub.frequency)}</span>
                        <span>{sub.occurrence_count} charges</span>
                        {sub.category_name && <span>{sub.category_name}</span>}
                        <span>Next: {new Date(sub.next_expected).toLocaleDateString()}</span>
                      </div>
                      {priceChange && (
                        <div className={`mt-2 text-sm ${priceChange.price_change_pct > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {priceChange.price_change_pct > 0 ? '↑' : '↓'} Price {priceChange.price_change_pct > 0 ? 'increased' : 'decreased'}{' '}
                          {Math.abs(priceChange.price_change_pct).toFixed(1)}% (${Math.abs(priceChange.price_change).toFixed(2)})
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">
                        ${sub.avg_amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {sub.min_amount !== sub.max_amount && (
                          <span>${sub.min_amount.toFixed(0)} - ${sub.max_amount.toFixed(0)}</span>
                        )}
                      </p>
                      {!sub.is_confirmed && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => confirmSubscription(sub.id)}
                            className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => dismissSubscription(sub.id)}
                            className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200"
                          >
                            Not a sub
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-start">
        <Link href="/dashboard/expenses/dashboard" className="text-blue-600 hover:text-blue-700 font-semibold text-sm">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
