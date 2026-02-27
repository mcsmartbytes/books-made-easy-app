'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { expensesSupabase } from '@/utils/expensesSupabase';
import { useUserMode } from '@/contexts/UserModeContext';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  deduction_percentage?: number;
}

interface Job {
  id: string;
  name: string;
}

export default function NewExpensePage() {
  const router = useRouter();
  const { isBusiness: defaultIsBusiness } = useUserMode();
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [ocrData, setOcrData] = useState<any>(null);

  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    payment_method: 'credit',
    is_business: defaultIsBusiness,
    notes: '',
    job_id: '',
    po_number: '',
  });

  useEffect(() => {
    if (!formData.category_id) {
      setFormData(prev => ({ ...prev, is_business: defaultIsBusiness }));
    }
  }, [defaultIsBusiness, formData.category_id]);

  useEffect(() => {
    loadCategories();
    loadJobs();
  }, []);

  async function loadJobs() {
    try {
      const { data, error } = await expensesSupabase
        .from('jobs')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error('Error loading jobs:', err);
    }
  }

  async function loadCategories() {
    setLoadingCategories(true);
    try {
      const response = await fetch('/api/expenses/categories');
      const result = await response.json();

      if (result.success && result.data) {
        setCategories(result.data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  }

  async function handleScanReceipt() {
    if (!receiptFile) return;

    setScanningReceipt(true);
    try {
      const formDataForOCR = new FormData();
      formDataForOCR.append('receipt', receiptFile);

      const response = await fetch('/api/expenses/ocr-receipt', {
        method: 'POST',
        body: formDataForOCR,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to scan receipt');
      }

      if (result.success && result.data) {
        setOcrData(result.data);
        setFormData((prev) => ({
          ...prev,
          amount: result.data.amount || prev.amount,
          vendor: result.data.vendor || prev.vendor,
          date: result.data.date || prev.date,
          description: result.data.description || prev.description,
          payment_method: result.data.payment_method || prev.payment_method,
        }));
        alert('Receipt scanned successfully! Review the auto-filled information.');
      }
    } catch (error: any) {
      alert('Failed to scan receipt: ' + (error.message || 'Unknown error'));
    } finally {
      setScanningReceipt(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await expensesSupabase.auth.getUser();
      if (!user) {
        alert('Please sign in');
        return;
      }

      let receipt_url = null;
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await expensesSupabase.storage.from('receipts').upload(fileName, receiptFile);
        if (!uploadError) {
          const { data: { publicUrl } } = expensesSupabase.storage.from('receipts').getPublicUrl(fileName);
          receipt_url = publicUrl;
        }
      }

      const { error } = await expensesSupabase.from('expenses').insert({
        ...formData,
        amount: parseFloat(formData.amount),
        job_id: formData.job_id || null,
        po_number: formData.po_number || null,
        receipt_url,
        user_id: user.id,
      });

      if (error) throw error;

      router.push('/dashboard/expenses');
    } catch (error: any) {
      alert(error.message || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">Add New Expense</h1>
          <p className="text-corporate-gray mt-1">Track a new business or personal expense</p>
        </div>
        <Link href="/dashboard/expenses" className="btn-secondary">
          Cancel
        </Link>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-corporate-gray">$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input-field pl-8"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description *</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field"
              placeholder="What was this expense for?"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Category *</label>
              <select
                required
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                disabled={loadingCategories}
                className="input-field"
              >
                <option value="">{loadingCategories ? 'Loading...' : 'Select a category'}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Vendor</label>
              <input
                type="text"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="input-field"
                placeholder="Where did you make this purchase?"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Payment Method</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="input-field"
              >
                <option value="credit">Credit Card</option>
                <option value="debit">Debit Card</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Job (optional)</label>
              <select
                value={formData.job_id}
                onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
                className="input-field"
              >
                <option value="">No job / general expense</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.is_business}
                onChange={(e) => setFormData({ ...formData, is_business: e.target.checked })}
                className="w-5 h-5 text-primary-600 rounded"
              />
              <span className="text-sm font-medium">This is a business expense</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Receipt Photo (Optional)</label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*,.pdf"
                capture="environment"
                onChange={(e) => {
                  setReceiptFile(e.target.files?.[0] || null);
                  setOcrData(null);
                }}
                className="input-field file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              {receiptFile && !ocrData && (
                <button
                  type="button"
                  onClick={handleScanReceipt}
                  disabled={scanningReceipt}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  {scanningReceipt ? 'Scanning...' : 'Scan Receipt with AI'}
                </button>
              )}
              {ocrData && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  Receipt scanned successfully - data auto-filled
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="input-field"
              placeholder="Additional details..."
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
            <Link href="/dashboard/expenses" className="btn-secondary flex-1 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
