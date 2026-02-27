'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface ItemRule {
  id: string;
  item_pattern: string;
  match_type: 'exact' | 'contains' | 'starts_with';
  category_id: string | null;
  is_business: boolean;
  vendor_pattern: string | null;
  priority: number;
  is_active: boolean;
  auto_created: boolean;
  match_count: number;
  categories?: Category;
}

export default function ItemCategoryRulesManager() {
  const [rules, setRules] = useState<ItemRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ItemRule | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Form state
  const [formData, setFormData] = useState({
    item_pattern: '',
    match_type: 'contains' as 'exact' | 'contains' | 'starts_with',
    category_id: '',
    is_business: true,
    vendor_pattern: '',
    priority: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load rules
      const rulesRes = await fetch(`/api/item-rules?user_id=${user.id}`);
      const rulesData = await rulesRes.json();
      if (rulesData.success) {
        setRules(rulesData.data || []);
      }

      // Load categories
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, icon, color')
        .eq('user_id', user.id)
        .order('name');
      setCategories(cats || []);
    } catch {
      console.error('Error loading data');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      item_pattern: '',
      match_type: 'contains',
      category_id: '',
      is_business: true,
      vendor_pattern: '',
      priority: 0,
    });
    setEditingRule(null);
    setShowForm(false);
  }

  function handleEdit(rule: ItemRule) {
    setFormData({
      item_pattern: rule.item_pattern,
      match_type: rule.match_type,
      category_id: rule.category_id || '',
      is_business: rule.is_business,
      vendor_pattern: rule.vendor_pattern || '',
      priority: rule.priority,
    });
    setEditingRule(rule);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.item_pattern.trim()) {
      setMessage({ type: 'error', text: 'Item pattern is required' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        ...formData,
        user_id: user.id,
        category_id: formData.category_id || null,
        vendor_pattern: formData.vendor_pattern || null,
      };

      let res;
      if (editingRule) {
        res = await fetch('/api/item-rules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingRule.id, ...payload }),
        });
      } else {
        res = await fetch('/api/item-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: editingRule ? 'Rule updated!' : 'Rule created!' });
        resetForm();
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save rule' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ruleId: string) {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const res = await fetch(`/api/item-rules?id=${ruleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setRules(rules.filter(r => r.id !== ruleId));
        setMessage({ type: 'success', text: 'Rule deleted' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete rule' });
    }
  }

  async function handleToggleActive(rule: ItemRule) {
    try {
      const res = await fetch('/api/item-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
      });
      const data = await res.json();
      if (data.success) {
        setRules(rules.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
      }
    } catch {
      console.error('Error toggling rule');
    }
  }

  if (loading) {
    return <div className="text-gray-500 text-center py-4">Loading rules...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-600">
            Auto-categorize line items based on item names. Rules are applied when processing receipts.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Rule'}
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-purple-50 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Pattern *
              </label>
              <input
                type="text"
                value={formData.item_pattern}
                onChange={(e) => setFormData({ ...formData, item_pattern: e.target.value })}
                placeholder="e.g., Paper Towels, Lumber"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match Type
              </label>
              <select
                value={formData.match_type}
                onChange={(e) => setFormData({ ...formData, match_type: e.target.value as 'exact' | 'contains' | 'starts_with' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="contains">Contains</option>
                <option value="starts_with">Starts With</option>
                <option value="exact">Exact Match</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">-- No category --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor Filter (optional)
              </label>
              <input
                type="text"
                value={formData.vendor_pattern}
                onChange={(e) => setFormData({ ...formData, vendor_pattern: e.target.value })}
                placeholder="Only apply at this vendor"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty to apply at all vendors</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expense Type
              </label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.is_business}
                    onChange={() => setFormData({ ...formData, is_business: true })}
                  />
                  <span>Business</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!formData.is_business}
                    onChange={() => setFormData({ ...formData, is_business: false })}
                  />
                  <span>Personal</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority (0-100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">Higher priority rules are checked first</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No item rules yet.</p>
          <p className="text-sm mt-1">Create a rule to auto-categorize receipt line items.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center justify-between p-4 bg-white border rounded-lg ${
                !rule.is_active ? 'opacity-50' : ''
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{rule.item_pattern}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {rule.match_type}
                  </span>
                  {rule.vendor_pattern && (
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded">
                      @ {rule.vendor_pattern}
                    </span>
                  )}
                  {rule.auto_created && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded">
                      Auto-learned
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  {rule.categories && (
                    <span>
                      {rule.categories.icon} {rule.categories.name}
                    </span>
                  )}
                  <span className={rule.is_business ? 'text-green-600' : 'text-gray-500'}>
                    {rule.is_business ? 'Business' : 'Personal'}
                  </span>
                  {rule.match_count > 0 && (
                    <span className="text-gray-400">
                      Applied {rule.match_count} time{rule.match_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(rule)}
                  className={`p-2 rounded-lg text-sm ${
                    rule.is_active
                      ? 'text-green-600 hover:bg-green-50'
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                  title={rule.is_active ? 'Disable rule' : 'Enable rule'}
                >
                  {rule.is_active ? '✓' : '○'}
                </button>
                <button
                  onClick={() => handleEdit(rule)}
                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                  title="Edit rule"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete rule"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
