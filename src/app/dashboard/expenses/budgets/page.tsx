'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { expensesSupabase } from '@/utils/expensesSupabase';

interface Budget {
  id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  profile: 'business' | 'personal';
  alert_threshold: number;
  start_date: string;
  is_active: boolean;
  spent?: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

const COMMON_CATEGORIES = [
  'Meals & Entertainment',
  'Travel',
  'Office Supplies',
  'Vehicle',
  'Utilities',
  'Marketing',
  'Professional Services',
  'Insurance',
  'Rent',
  'Software & Subscriptions',
  'Equipment',
  'Other',
];

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    period: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    profile: 'business' as 'business' | 'personal',
    alert_threshold: '80',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBudgets();
    loadCategories();
  }, []);

  async function loadCategories() {
    const { data: { user } } = await expensesSupabase.auth.getUser();
    if (!user) return;

    const { data } = await expensesSupabase
      .from('categories')
      .select('id, name, icon')
      .order('name');

    if (data) setCategories(data);
  }

  async function loadBudgets() {
    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: budgetsData, error } = await expensesSupabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('category');

      if (error) throw error;

      const userId = user.id as string;
      const budgetsWithSpending = await Promise.all(
        (budgetsData || []).map(async (budget: any) => {
          const spent = await calculateSpending(userId, budget);
          return { ...budget, spent };
        })
      );

      setBudgets(budgetsWithSpending);
    } catch (error) {
      console.error('Error loading budgets:', error);
    } finally {
      setLoading(false);
    }
  }

  async function calculateSpending(userId: string, budget: Budget): Promise<number> {
    const now = new Date();
    let startDate: Date;

    if (budget.period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (budget.period === 'quarterly') {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStart, 1);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    let query = expensesSupabase
      .from('expenses')
      .select('amount')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0]);

    if (budget.profile === 'business') {
      query = query.eq('is_business', true);
    }

    if (budget.category !== 'All Categories') {
      const { data: categoryData } = await expensesSupabase
        .from('categories')
        .select('id')
        .eq('name', budget.category)
        .single();

      if (categoryData) {
        query = query.eq('category_id', categoryData.id);
      }
    }

    const { data } = await query;
    return data?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0;
  }

  async function createBudget(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const now = new Date();
      let startDate: Date;

      if (formData.period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (formData.period === 'quarterly') {
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      const { error } = await expensesSupabase.from('budgets').insert({
        user_id: user.id,
        category: formData.category,
        amount: parseFloat(formData.amount),
        period: formData.period,
        profile: formData.profile,
        alert_threshold: parseFloat(formData.alert_threshold) / 100,
        start_date: startDate.toISOString().split('T')[0],
        is_active: true,
      });

      if (error) throw error;

      setShowCreateModal(false);
      setFormData({ category: '', amount: '', period: 'monthly', profile: 'business', alert_threshold: '80' });
      loadBudgets();
    } catch (error: any) {
      alert(error.message || 'Failed to create budget');
    } finally {
      setSaving(false);
    }
  }

  async function deleteBudget(id: string) {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    const { error } = await expensesSupabase.from('budgets').update({ is_active: false }).eq('id', id);
    if (!error) loadBudgets();
  }

  function getProgressColor(spent: number, budget: number, threshold: number): string {
    const percentage = (spent / budget) * 100;
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= threshold * 100) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  function getStatusBadge(spent: number, budget: number, threshold: number) {
    const percentage = (spent / budget) * 100;
    if (percentage >= 100) return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">Over Budget</span>;
    if (percentage >= threshold * 100) return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">Near Limit</span>;
    return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">On Track</span>;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading budgets...</p>
          </div>
        </div>
      </div>
    );
  }

  const categoryOptions = categories.length > 0
    ? ['All Categories', ...categories.map(c => c.name)]
    : ['All Categories', ...COMMON_CATEGORIES];

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget Tracking</h1>
          <p className="text-sm text-gray-600 mt-1">Set spending limits and track your progress</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          + Create Budget
        </button>
      </header>

      {budgets.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Budgets Yet</h2>
          <p className="text-gray-600 mb-6">Create your first budget to start tracking your spending against your goals.</p>
          <button onClick={() => setShowCreateModal(true)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">Create Your First Budget</button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const spent = budget.spent || 0;
            const percentage = Math.min((spent / budget.amount) * 100, 100);
            const remaining = Math.max(budget.amount - spent, 0);

            return (
              <div key={budget.id} className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{budget.category}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${budget.profile === 'business' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{budget.profile === 'business' ? 'Business' : 'Personal'}</span>
                      <span className="text-xs text-gray-500 capitalize">{budget.period}</span>
                    </div>
                  </div>
                  {getStatusBadge(spent, budget.amount, budget.alert_threshold)}
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Spent</span>
                    <span className="font-medium">${spent.toFixed(2)} / ${budget.amount.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className={`h-3 rounded-full transition-all ${getProgressColor(spent, budget.amount, budget.alert_threshold)}`} style={{ width: `${percentage}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-500">{percentage.toFixed(0)}% used</span>
                    <span className="text-gray-500">${remaining.toFixed(2)} remaining</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={() => deleteBudget(budget.id)} className="text-sm text-red-600 hover:text-red-700">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-start">
        <Link href="/dashboard/expenses/dashboard" className="text-blue-600 hover:text-blue-700 font-semibold text-sm">← Back to Dashboard</Link>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Budget</h2>

            <form onSubmit={createBudget} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select a category</option>
                  {categoryOptions.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" step="0.01" min="0" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required placeholder="0.00" className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                  <select value={formData.period} onChange={(e) => setFormData({ ...formData, period: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={formData.profile} onChange={(e) => setFormData({ ...formData, profile: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="business">Business</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alert Threshold ({formData.alert_threshold}%)</label>
                <input type="range" min="50" max="100" value={formData.alert_threshold} onChange={(e) => setFormData({ ...formData, alert_threshold: e.target.value })} className="w-full" />
                <p className="text-xs text-gray-500 mt-1">You&apos;ll see a warning when spending reaches {formData.alert_threshold}% of your budget</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">{saving ? 'Creating...' : 'Create Budget'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
