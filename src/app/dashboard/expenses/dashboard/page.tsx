'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SpendingInsights from '@/components/SpendingInsights';
import PredictiveAlerts from '@/components/PredictiveAlerts';
import GamificationWidget from '@/components/GamificationWidget';
import ActionableInsights from '@/components/ActionableInsights';
import { expensesSupabase } from '@/utils/expensesSupabase';

type Expense = {
  id: string;
  amount: number;
  date: string;
  description: string;
  is_business: boolean;
};

type Budget = {
  id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  profile: 'business' | 'personal';
  alert_threshold: number;
};

export default function ExpensesDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasCategories, setHasCategories] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view your Expenses dashboard.');
        setLoading(false);
        return;
      }
      setUserId(user.id || null);

      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const { data: expenseData, error: expErr } = await expensesSupabase
        .from('expenses')
        .select('id, amount, date, description, is_business')
        .eq('user_id', user.id)
        .gte('date', startOfMonth)
        .order('date', { ascending: false })
        .limit(50);
      if (expErr) throw expErr;

      setExpenses((expenseData || []).map((e: any) => ({ ...e, amount: Number(e.amount) })));

      // Try to load budgets
      try {
        const { data: budgetData, error: budErr } = await expensesSupabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id)
          .order('category');
        if (!budErr && budgetData) {
          setBudgets(budgetData.map((b: any) => ({
            id: b.id,
            category: b.category || 'General',
            amount: Number(b.amount || 0),
            period: b.period || 'monthly',
            profile: b.profile || 'business',
            alert_threshold: b.alert_threshold ?? 0.8,
          })));
        }
      } catch {
        setBudgets([]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void checkCategories(); }, []);
  async function checkCategories() {
    try {
      const res = await fetch('/api/expenses/categories');
      const json = await res.json();
      if (json.success) setHasCategories((json.data || []).length > 0);
    } catch {
      setHasCategories(null);
    }
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthExpenses = expenses.filter(e => new Date(e.date) >= startOfMonth);
  const totalThisMonth = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const businessThisMonth = monthExpenses.filter(e => e.is_business).reduce((s, e) => s + e.amount, 0);
  const personalThisMonth = monthExpenses.filter(e => !e.is_business).reduce((s, e) => s + e.amount, 0);

  const recentExpenses = monthExpenses.slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-24">
          <p className="text-gray-500 text-sm">Loading your Expenses dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-red-500 text-sm">{error}</p>
          <Link href="/login" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Track spending, budgets, and receipts at a glance.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/expenses/new" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-sm text-sm">+ Add Expense</Link>
          <Link href="/dashboard/expenses/budgets" className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold shadow-sm text-sm">Manage Budgets</Link>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total This Month</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">${totalThisMonth.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Business</p>
          <p className="mt-2 text-3xl font-bold text-green-600">${businessThisMonth.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Personal</p>
          <p className="mt-2 text-3xl font-bold text-gray-600">${personalThisMonth.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Budgets Active</p>
          <p className="mt-2 text-3xl font-bold text-purple-600">{budgets.length}</p>
        </div>
      </section>

      {/* Gamification & Smart Insights */}
      {userId && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GamificationWidget userId={userId} variant="full" />
          <div className="lg:col-span-2">
            <ActionableInsights userId={userId} />
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Active Budgets</h2>
            <Link href="/dashboard/expenses/budgets" className="text-xs font-semibold text-blue-600 hover:text-blue-700">View all</Link>
          </div>
          {budgets.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">No budgets set. Create one to track spending limits.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-600 font-medium">Category</th>
                    <th className="px-4 py-2 text-left text-gray-600 font-medium">Type</th>
                    <th className="px-4 py-2 text-right text-gray-600 font-medium">Amount</th>
                    <th className="px-4 py-2 text-right text-gray-600 font-medium">Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.slice(0, 6).map((b, idx) => (
                    <tr key={b.id} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-2 text-gray-900 font-medium">{b.category}</td>
                      <td className="px-4 py-2 text-gray-600 capitalize">{b.profile}</td>
                      <td className="px-4 py-2 text-right text-gray-900">${b.amount.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{Math.round(b.alert_threshold * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white shadow-sm">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Expenses</h2>
            <Link href="/dashboard/expenses" className="text-xs font-semibold text-blue-600 hover:text-blue-700">View all</Link>
          </div>
          {recentExpenses.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No expenses this month yet.</div>
          ) : (
            <ul className="divide-y text-sm">
              {recentExpenses.map((e) => (
                <li key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      ${e.amount.toFixed(2)}{' '}
                      <span className="text-gray-500 font-normal">{e.description}</span>
                    </p>
                    <p className="text-gray-400 text-xs">
                      {new Date(e.date).toLocaleDateString()} {e.is_business ? 'Business' : 'Personal'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Spending Insights & Predictive Alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendingInsights />
        <PredictiveAlerts />
      </section>

      {/* Quick Start CTAs */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-5 flex items-center justify-between shadow-sm">
          <div>
            <h3 className="font-semibold text-gray-900">Track Mileage</h3>
            <p className="text-sm text-gray-600">Log business trips easily with IRS rates.</p>
          </div>
          <Link href="/dashboard/expenses/mileage" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Open Mileage</Link>
        </div>
        {hasCategories === false && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-amber-900">Set Up Categories</h3>
              <p className="text-sm text-amber-800">Create defaults or pick your industry to get started.</p>
            </div>
            <Link href="/dashboard/settings" className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium">Open Settings</Link>
          </div>
        )}
      </section>
    </div>
  );
}
