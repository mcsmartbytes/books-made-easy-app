'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { irsCategories } from '@/data/industries';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'product' | 'service';
  tax_deductible: boolean;
  irs_category: string | null;
  is_active: boolean;
}

const typeColors: Record<string, { bg: string; text: string }> = {
  income: { bg: 'bg-green-100', text: 'text-green-700' },
  expense: { bg: 'bg-orange-100', text: 'text-orange-700' },
  product: { bg: 'bg-blue-100', text: 'text-blue-700' },
  service: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as Category['type'],
    tax_deductible: true,
    irs_category: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', session.user.id)
      .order('type')
      .order('name');

    if (!error && data) {
      setCategories(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const categoryData = {
      user_id: session.user.id,
      name: formData.name,
      type: formData.type,
      tax_deductible: formData.tax_deductible,
      irs_category: formData.irs_category || null,
      is_active: true,
    };

    if (editingCategory) {
      const { error } = await supabase
        .from('categories')
        .update(categoryData)
        .eq('id', editingCategory.id);

      if (!error) {
        setCategories(categories.map(c => c.id === editingCategory.id ? { ...c, ...categoryData } : c));
      }
    } else {
      const { data, error } = await supabase
        .from('categories')
        .insert(categoryData)
        .select()
        .single();

      if (!error && data) {
        setCategories([...categories, data].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)));
      }
    }
    closeModal();
  };

  const openModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        type: category.type,
        tax_deductible: category.tax_deductible,
        irs_category: category.irs_category || '',
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        type: 'expense',
        tax_deductible: true,
        irs_category: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (!error) {
      setCategories(categories.filter(c => c.id !== id));
    }
  };

  const filteredCategories = categories.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || cat.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Group by type
  const groupedCategories = filteredCategories.reduce((groups, cat) => {
    if (!groups[cat.type]) groups[cat.type] = [];
    groups[cat.type].push(cat);
    return groups;
  }, {} as Record<string, Category[]>);

  const typeOrder = ['income', 'service', 'product', 'expense'];

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
          <h1 className="text-2xl font-bold text-corporate-dark">Categories</h1>
          <p className="text-corporate-gray mt-1">Manage income and expense categories for your business</p>
        </div>
        <button
          onClick={() => openModal()}
          className="btn-primary flex items-center gap-2 justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Category
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Income Categories</p>
          <p className="text-2xl font-bold text-green-600">{categories.filter(c => c.type === 'income').length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Expense Categories</p>
          <p className="text-2xl font-bold text-orange-600">{categories.filter(c => c.type === 'expense').length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Service Categories</p>
          <p className="text-2xl font-bold text-purple-600">{categories.filter(c => c.type === 'service').length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Product Categories</p>
          <p className="text-2xl font-bold text-blue-600">{categories.filter(c => c.type === 'product').length}</p>
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
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="service">Service</option>
            <option value="product">Product</option>
          </select>
        </div>
      </div>

      {/* Categories by type */}
      {categories.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-corporate-gray mb-4">No categories yet. Categories are created during onboarding based on your industry.</p>
          <button onClick={() => openModal()} className="btn-primary">
            Add Your First Category
          </button>
        </div>
      ) : (
        typeOrder.map(type => {
          const typeCategories = groupedCategories[type];
          if (!typeCategories || typeCategories.length === 0) return null;

          return (
            <div key={type} className="card">
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${typeColors[type].bg} ${typeColors[type].text}`}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </span>
                <span className="text-sm text-corporate-gray">
                  {typeCategories.length} categor{typeCategories.length === 1 ? 'y' : 'ies'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {typeCategories.map(category => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${typeColors[category.type].bg.replace('100', '500')}`}></div>
                      <div>
                        <p className="font-medium text-corporate-dark">{category.name}</p>
                        <div className="flex items-center gap-2 text-xs text-corporate-gray">
                          {category.tax_deductible && <span className="text-green-600">Tax Deductible</span>}
                          {category.irs_category && <span>IRS: {category.irs_category}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openModal(category)}
                        className="p-1.5 text-corporate-gray hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteCategory(category.id)}
                        className="p-1.5 text-corporate-gray hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-corporate-dark">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <button onClick={closeModal} className="p-2 text-corporate-gray hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Category Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Office Supplies"
                />
              </div>
              <div>
                <label className="label">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Category['type'] })}
                  className="input-field"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="service">Service</option>
                  <option value="product">Product</option>
                </select>
              </div>
              <div>
                <label className="label">IRS Category (for tax reporting)</label>
                <select
                  value={formData.irs_category}
                  onChange={(e) => setFormData({ ...formData, irs_category: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select IRS category...</option>
                  {irsCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              {formData.type === 'expense' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.tax_deductible}
                    onChange={(e) => setFormData({ ...formData, tax_deductible: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-corporate-slate">Tax Deductible</span>
                </label>
              )}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingCategory ? 'Update Category' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
