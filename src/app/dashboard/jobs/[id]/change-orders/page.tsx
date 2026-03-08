'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface ChangeOrder {
  id: string;
  co_number: string;
  title: string;
  description: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'voided';
  type: 'addition' | 'deduction' | 'no_cost';
  revenue_impact: number;
  cost_impact: number;
  margin_impact: number;
  days_impact: number;
  submitted_date: string | null;
  approved_date: string | null;
  notes: string;
  created_at: string;
}

interface COSummary {
  total_count: number;
  approved_count: number;
  pending_count: number;
  rejected_count: number;
  draft_count: number;
  approved_revenue_impact: number;
  approved_cost_impact: number;
  approved_margin_impact: number;
  pending_revenue_exposure: number;
  pending_cost_exposure: number;
  total_days_impact: number;
}

interface Job {
  id: string;
  job_number: string;
  name: string;
  estimated_revenue: number;
  estimated_cost: number;
}

export default function ChangeOrdersPage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [summary, setSummary] = useState<COSummary | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCO, setEditingCO] = useState<ChangeOrder | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    co_number: '',
    title: '',
    description: '',
    type: 'addition' as 'addition' | 'deduction' | 'no_cost',
    revenue_impact: '',
    cost_impact: '',
    days_impact: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const [coRes, jobRes] = await Promise.all([
        fetch(`/api/change-orders?user_id=${session.user.id}&job_id=${params.id}`),
        fetch(`/api/jobs?user_id=${session.user.id}&id=${params.id}`),
      ]);

      const coResult = await coRes.json();
      const jobResult = await jobRes.json();

      if (coResult.success) {
        setChangeOrders(coResult.data || []);
        setSummary(coResult.summary);
      }
      if (jobResult.success && jobResult.data) {
        const j = Array.isArray(jobResult.data) ? jobResult.data[0] : jobResult.data;
        setJob(j);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const resetForm = () => {
    setFormData({
      co_number: '',
      title: '',
      description: '',
      type: 'addition',
      revenue_impact: '',
      cost_impact: '',
      days_impact: '',
      notes: '',
    });
    setEditingCO(null);
    setShowForm(false);
  };

  const handleEdit = (co: ChangeOrder) => {
    setFormData({
      co_number: co.co_number,
      title: co.title,
      description: co.description || '',
      type: co.type,
      revenue_impact: String(co.revenue_impact || ''),
      cost_impact: String(co.cost_impact || ''),
      days_impact: String(co.days_impact || ''),
      notes: co.notes || '',
    });
    setEditingCO(co);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const payload = {
        user_id: session.user.id,
        job_id: params.id,
        co_number: formData.co_number,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        revenue_impact: Number(formData.revenue_impact) || 0,
        cost_impact: Number(formData.cost_impact) || 0,
        days_impact: Number(formData.days_impact) || 0,
        notes: formData.notes,
      };

      let res;
      if (editingCO) {
        res = await fetch('/api/change-orders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCO.id, ...payload }),
        });
      } else {
        res = await fetch('/api/change-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const result = await res.json();
      if (result.success) {
        resetForm();
        loadData();
      } else {
        alert(result.error || 'Failed to save change order');
      }
    } catch (err) {
      console.error('Error saving change order:', err);
    }
    setSaving(false);
  };

  const updateStatus = async (co: ChangeOrder, newStatus: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch('/api/change-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: co.id,
          user_id: session.user.id,
          status: newStatus,
        }),
      });
      const result = await res.json();
      if (result.success) loadData();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const deleteCO = async (co: ChangeOrder) => {
    if (!confirm(`Delete change order ${co.co_number}?`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await fetch(`/api/change-orders?id=${co.id}&user_id=${session.user.id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      console.error('Error deleting CO:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
      approved: { bg: 'bg-green-100', text: 'text-green-700' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700' },
      voided: { bg: 'bg-gray-200', text: 'text-gray-500' },
    };
    const c = config[status] || config.draft;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{status}</span>;
  };

  const getTypeBadge = (type: string) => {
    if (type === 'addition') return <span className="text-green-600 text-xs font-medium">+ Addition</span>;
    if (type === 'deduction') return <span className="text-red-600 text-xs font-medium">- Deduction</span>;
    return <span className="text-gray-500 text-xs font-medium">No Cost</span>;
  };

  // Revised contract values
  const originalRevenue = Number(job?.estimated_revenue) || 0;
  const originalCost = Number(job?.estimated_cost) || 0;
  const revisedRevenue = originalRevenue + (summary?.approved_revenue_impact || 0);
  const revisedCost = originalCost + (summary?.approved_cost_impact || 0);
  const revisedProfit = revisedRevenue - revisedCost;
  const revisedMargin = revisedRevenue > 0 ? (revisedProfit / revisedRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href={`/dashboard/jobs/${params.id}`} className="text-corporate-gray hover:text-corporate-dark">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-corporate-dark">Change Orders</h1>
          </div>
          {job && (
            <p className="text-corporate-gray mt-1 ml-8">
              {job.job_number} — {job.name}
            </p>
          )}
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
          <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Change Order
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Financial Impact Summary */}
          {summary && job && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Revised Contract</p>
                <p className="text-xl font-bold text-corporate-dark">{formatCurrency(revisedRevenue)}</p>
                <p className="text-xs text-corporate-gray">
                  Original: {formatCurrency(originalRevenue)}
                  {summary.approved_revenue_impact !== 0 && (
                    <span className={summary.approved_revenue_impact > 0 ? ' text-green-600' : ' text-red-600'}>
                      {' '}{summary.approved_revenue_impact > 0 ? '+' : ''}{formatCurrency(summary.approved_revenue_impact)}
                    </span>
                  )}
                </p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Revised Margin</p>
                <p className={`text-xl font-bold ${revisedMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {revisedMargin.toFixed(1)}%
                </p>
                <p className="text-xs text-corporate-gray">
                  Profit: {formatCurrency(revisedProfit)}
                </p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Pending Exposure</p>
                <p className="text-xl font-bold text-yellow-600">
                  {formatCurrency(summary.pending_revenue_exposure)}
                </p>
                <p className="text-xs text-corporate-gray">
                  {summary.pending_count} pending CO{summary.pending_count !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="stat-card">
                <p className="text-sm text-corporate-gray">Schedule Impact</p>
                <p className="text-xl font-bold text-corporate-dark">
                  {summary.total_days_impact > 0 ? '+' : ''}{summary.total_days_impact} days
                </p>
                <p className="text-xs text-corporate-gray">
                  {summary.total_count} total CO{summary.total_count !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {/* Add/Edit Form */}
          {showForm && (
            <div className="card border-2 border-primary-200">
              <h3 className="font-semibold text-corporate-dark mb-4">
                {editingCO ? 'Edit Change Order' : 'New Change Order'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">CO Number</label>
                    <input
                      type="text"
                      value={formData.co_number}
                      onChange={(e) => setFormData({ ...formData, co_number: e.target.value })}
                      className="input-field"
                      placeholder="CO-001"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="input-field"
                      placeholder="Additional excavation work"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="label">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="input-field"
                    >
                      <option value="addition">Addition</option>
                      <option value="deduction">Deduction</option>
                      <option value="no_cost">No Cost</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Revenue Impact ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.revenue_impact}
                      onChange={(e) => setFormData({ ...formData, revenue_impact: e.target.value })}
                      className="input-field"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="label">Cost Impact ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cost_impact}
                      onChange={(e) => setFormData({ ...formData, cost_impact: e.target.value })}
                      className="input-field"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="label">Days Impact</label>
                    <input
                      type="number"
                      value={formData.days_impact}
                      onChange={(e) => setFormData({ ...formData, days_impact: e.target.value })}
                      className="input-field"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input-field"
                    rows={2}
                  />
                </div>
                {formData.revenue_impact || formData.cost_impact ? (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <span className="text-corporate-gray">Margin Impact: </span>
                    <span className={`font-medium ${(Number(formData.revenue_impact) || 0) - (Number(formData.cost_impact) || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency((Number(formData.revenue_impact) || 0) - (Number(formData.cost_impact) || 0))}
                    </span>
                  </div>
                ) : null}
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : editingCO ? 'Update' : 'Create'}
                  </button>
                  <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Change Orders List */}
          {changeOrders.length === 0 && !showForm ? (
            <div className="card text-center py-12">
              <svg className="w-16 h-16 text-corporate-gray mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-corporate-dark mb-2">No Change Orders</h3>
              <p className="text-corporate-gray mb-4">Track scope changes and their financial impact on this job.</p>
              <button onClick={() => setShowForm(true)} className="btn-primary">Create First Change Order</button>
            </div>
          ) : (
            <div className="space-y-3">
              {changeOrders.map(co => (
                <div key={co.id} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-sm font-bold text-primary-600">{co.co_number}</span>
                        {getStatusBadge(co.status)}
                        {getTypeBadge(co.type)}
                      </div>
                      <h3 className="font-semibold text-corporate-dark">{co.title}</h3>
                      {co.description && <p className="text-sm text-corporate-gray mt-1">{co.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {co.status === 'draft' && (
                        <button onClick={() => updateStatus(co, 'pending')} className="text-xs text-yellow-600 hover:text-yellow-700 font-medium">Submit</button>
                      )}
                      {co.status === 'pending' && (
                        <>
                          <button onClick={() => updateStatus(co, 'approved')} className="text-xs text-green-600 hover:text-green-700 font-medium">Approve</button>
                          <button onClick={() => updateStatus(co, 'rejected')} className="text-xs text-red-600 hover:text-red-700 font-medium">Reject</button>
                        </>
                      )}
                      <button onClick={() => handleEdit(co)} className="text-xs text-corporate-gray hover:text-corporate-dark">Edit</button>
                      <button onClick={() => deleteCO(co)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-corporate-gray">Revenue Impact</p>
                      <p className={`font-medium ${co.revenue_impact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {co.revenue_impact >= 0 ? '+' : ''}{formatCurrency(co.revenue_impact)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-corporate-gray">Cost Impact</p>
                      <p className={`font-medium ${co.cost_impact > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {co.cost_impact > 0 ? '+' : ''}{formatCurrency(co.cost_impact)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-corporate-gray">Margin Impact</p>
                      <p className={`font-medium ${co.margin_impact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {co.margin_impact >= 0 ? '+' : ''}{formatCurrency(co.margin_impact)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-corporate-gray">Days Impact</p>
                      <p className="font-medium text-corporate-dark">
                        {co.days_impact > 0 ? '+' : ''}{co.days_impact} days
                      </p>
                    </div>
                  </div>
                  {co.notes && (
                    <p className="text-xs text-corporate-gray mt-2 italic">{co.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
