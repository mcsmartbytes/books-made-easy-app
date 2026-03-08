'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Job {
  id: string;
  job_number: string;
  name: string;
  description: string;
  customer_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  start_date: string | null;
  end_date: string | null;
  estimated_revenue: number;
  estimated_cost: number;
  actual_revenue: number;
  actual_cost: number;
  customers?: { id: string; name: string; email: string; company: string } | null;
}

interface Phase {
  id: string;
  job_id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  estimated_hours: number;
  estimated_cost: number;
  actual_hours: number;
  actual_cost: number;
  sort_order: number;
}

interface Transaction {
  id: string;
  type: 'invoice' | 'bill' | 'expense';
  reference: string;
  description: string;
  amount: number;
  date: string;
  phase_id: string | null;
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'phases' | 'transactions'>('overview');
  const [financialData, setFinancialData] = useState<any>(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhase, setNewPhase] = useState({ name: '', description: '', estimated_hours: 0, estimated_cost: 0 });

  useEffect(() => {
    loadJob();
  }, [params.id]);

  const loadJob = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Load job with customer info
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        customers (id, name, email, company)
      `)
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .single();

    if (jobError || !jobData) {
      router.push('/dashboard/jobs');
      return;
    }

    setJob(jobData);

    // Load phases
    const { data: phasesData } = await supabase
      .from('job_phases')
      .select('*')
      .eq('job_id', params.id)
      .order('sort_order');

    setPhases(phasesData || []);

    // Load related transactions (invoices and bills linked to this job)
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('id, invoice_number, total, issue_date, job_id')
      .eq('job_id', params.id);

    const { data: billsData } = await supabase
      .from('bills')
      .select('id, bill_number, total, bill_date, job_id')
      .eq('job_id', params.id);

    const allTransactions: Transaction[] = [
      ...(invoicesData || []).map((inv: any) => ({
        id: inv.id,
        type: 'invoice' as const,
        reference: inv.invoice_number,
        description: 'Invoice',
        amount: inv.total,
        date: inv.issue_date,
        phase_id: null,
      })),
      ...(billsData || []).map((bill: any) => ({
        id: bill.id,
        type: 'bill' as const,
        reference: bill.bill_number,
        description: 'Bill',
        amount: bill.total,
        date: bill.bill_date,
        phase_id: null,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setTransactions(allTransactions);
    setLoading(false);
  };

  const updateJobStatus = async (status: Job['status']) => {
    if (!job) return;

    const { error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', job.id);

    if (!error) {
      setJob({ ...job, status });
    }
  };

  const updatePhaseStatus = async (phaseId: string, status: Phase['status']) => {
    const { error } = await supabase
      .from('job_phases')
      .update({ status })
      .eq('id', phaseId);

    if (!error) {
      setPhases(phases.map(p => p.id === phaseId ? { ...p, status } : p));
    }
  };

  const updatePhaseActuals = async (phaseId: string, actual_hours: number, actual_cost: number) => {
    const { error } = await supabase
      .from('job_phases')
      .update({ actual_hours, actual_cost })
      .eq('id', phaseId);

    if (!error) {
      setPhases(phases.map(p => p.id === phaseId ? { ...p, actual_hours, actual_cost } : p));
      setEditingPhase(null);
      // Update job totals
      const totalActualCost = phases.reduce((sum, p) =>
        sum + (p.id === phaseId ? actual_cost : p.actual_cost), 0
      );
      await supabase.from('jobs').update({ actual_cost: totalActualCost }).eq('id', params.id);
      if (job) {
        setJob({ ...job, actual_cost: totalActualCost });
      }
    }
  };

  const addPhase = async () => {
    if (!newPhase.name) return;

    const { data, error } = await supabase
      .from('job_phases')
      .insert({
        job_id: params.id,
        name: newPhase.name,
        description: newPhase.description,
        estimated_hours: newPhase.estimated_hours,
        estimated_cost: newPhase.estimated_cost,
        actual_hours: 0,
        actual_cost: 0,
        status: 'pending',
        sort_order: phases.length,
      })
      .select()
      .single();

    if (!error && data) {
      setPhases([...phases, data]);
      setNewPhase({ name: '', description: '', estimated_hours: 0, estimated_cost: 0 });
      setShowAddPhase(false);
    }
  };

  const loadFinancialSummary = async () => {
    setFinancialLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(`/api/jobs/${params.id}/financial-summary?user_id=${session.user.id}`);
      const result = await res.json();
      if (result.success) {
        setFinancialData(result.data);
      }
    } catch (err) {
      console.error('Failed to load financial summary:', err);
    }
    setFinancialLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'financial' && !financialData) {
      loadFinancialSummary();
    }
  }, [activeTab]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      on_hold: 'bg-yellow-100 text-yellow-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      on_hold: 'On Hold',
      cancelled: 'Cancelled',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading || !job) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const estimatedProfit = job.estimated_revenue - job.estimated_cost;
  const profitMargin = job.estimated_revenue > 0 ? (estimatedProfit / job.estimated_revenue) * 100 : 0;
  const completedPhases = phases.filter(p => p.status === 'completed').length;
  const progress = phases.length > 0 ? (completedPhases / phases.length) * 100 : 0;

  // Calculate totals from linked transactions
  const totalInvoiced = transactions.filter(t => t.type === 'invoice').reduce((sum, t) => sum + t.amount, 0);
  const totalBilled = transactions.filter(t => t.type === 'bill').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard/jobs" className="text-corporate-gray hover:text-corporate-dark">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-sm text-corporate-gray">{job.job_number}</span>
            {getStatusBadge(job.status)}
          </div>
          <h1 className="text-2xl font-bold text-corporate-dark">{job.name}</h1>
          {job.customers && (
            <Link href={`/dashboard/customers/${job.customers.id}`} className="text-primary-600 hover:underline mt-1 block">
              {job.customers.name}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={job.status}
            onChange={(e) => updateJobStatus(e.target.value as Job['status'])}
            className="input-field w-auto"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Link href={`/dashboard/jobs/${job.id}/edit`} className="btn-secondary">Edit Job</Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Est. Revenue</p>
          <p className="text-xl font-bold text-corporate-dark">{formatCurrency(job.estimated_revenue)}</p>
          {job.actual_revenue > 0 && (
            <p className="text-xs text-green-600">Actual: {formatCurrency(job.actual_revenue)}</p>
          )}
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Est. Cost</p>
          <p className="text-xl font-bold text-corporate-dark">{formatCurrency(job.estimated_cost)}</p>
          {job.actual_cost > 0 && (
            <p className="text-xs text-corporate-gray">Actual: {formatCurrency(job.actual_cost)}</p>
          )}
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Est. Profit</p>
          <p className={`text-xl font-bold ${estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(estimatedProfit)}
          </p>
          <p className="text-xs text-corporate-gray">{profitMargin.toFixed(1)}% margin</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Progress</p>
          <p className="text-xl font-bold text-corporate-dark">{progress.toFixed(0)}%</p>
          <p className="text-xs text-corporate-gray">{completedPhases}/{phases.length} phases</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Timeline</p>
          <p className="text-lg font-bold text-corporate-dark">{formatDate(job.start_date)}</p>
          <p className="text-xs text-corporate-gray">to {formatDate(job.end_date)}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {phases.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-corporate-dark">Overall Progress</span>
            <span className="text-sm text-corporate-gray">{completedPhases} of {phases.length} phases completed</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-primary-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {(['overview', 'financial', 'phases', 'transactions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-corporate-gray hover:text-corporate-dark'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'phases' && phases.length > 0 && (
                <span className="ml-2 bg-gray-100 text-corporate-gray px-2 py-0.5 rounded-full text-xs">
                  {phases.length}
                </span>
              )}
              {tab === 'transactions' && transactions.length > 0 && (
                <span className="ml-2 bg-gray-100 text-corporate-gray px-2 py-0.5 rounded-full text-xs">
                  {transactions.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-corporate-dark mb-4">Description</h3>
            <p className="text-corporate-slate whitespace-pre-wrap">
              {job.description || 'No description provided.'}
            </p>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold text-corporate-dark mb-4">Financial Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-corporate-gray">Estimated Revenue</span>
                <span className="font-medium text-corporate-dark">{formatCurrency(job.estimated_revenue)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-corporate-gray">Invoiced Revenue</span>
                <span className="font-medium text-green-600">{formatCurrency(totalInvoiced)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-corporate-gray">Estimated Cost</span>
                <span className="font-medium text-corporate-dark">{formatCurrency(job.estimated_cost)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-corporate-gray">Billed Cost</span>
                <span className="font-medium text-red-600">{formatCurrency(totalBilled)}</span>
              </div>
              <div className="flex justify-between py-2 pt-3">
                <span className="font-semibold text-corporate-dark">Estimated Profit</span>
                <span className={`font-bold ${estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(estimatedProfit)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-semibold text-corporate-dark">Actual Profit (Invoiced - Billed)</span>
                <span className={`font-bold ${(totalInvoiced - totalBilled) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalInvoiced - totalBilled)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="space-y-6">
          {financialLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : financialData ? (
            <>
              {/* Risk Alerts */}
              {financialData.risks.length > 0 && (
                <div className="card border-l-4 border-red-500 bg-red-50">
                  <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Risk Alerts ({financialData.risks.length})
                  </h3>
                  <ul className="space-y-1">
                    {financialData.risks.map((risk: string, i: number) => (
                      <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contract & WIP Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card">
                  <p className="text-sm text-corporate-gray">Contract Value</p>
                  <p className="text-xl font-bold text-corporate-dark">{formatCurrency(financialData.contract.revised_value)}</p>
                  <p className="text-xs text-corporate-gray">Est. Cost: {formatCurrency(financialData.contract.estimated_cost)}</p>
                </div>
                <div className="stat-card">
                  <p className="text-sm text-corporate-gray">Revenue Recognized</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(financialData.wip.revenue_recognized)}</p>
                  <p className="text-xs text-corporate-gray">{financialData.completion.percent_complete_cost.toFixed(1)}% complete (cost)</p>
                </div>
                <div className="stat-card">
                  <p className="text-sm text-corporate-gray">Gross Profit</p>
                  <p className={`text-xl font-bold ${financialData.profitability.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(financialData.profitability.gross_profit)}
                  </p>
                  <p className="text-xs text-corporate-gray">{financialData.profitability.gross_margin.toFixed(1)}% margin</p>
                </div>
                <div className="stat-card">
                  <p className="text-sm text-corporate-gray">Remaining Backlog</p>
                  <p className="text-xl font-bold text-corporate-dark">{formatCurrency(financialData.wip.remaining_backlog)}</p>
                  <p className="text-xs text-corporate-gray">Cost to Complete: {formatCurrency(financialData.costs.cost_to_complete)}</p>
                </div>
              </div>

              {/* Billing Position */}
              <div className="card">
                <h3 className="font-semibold text-corporate-dark mb-4">Billing Position</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={`p-4 rounded-lg border ${
                    financialData.wip.billing_status === 'overbilled' ? 'bg-amber-50 border-amber-200' :
                    financialData.wip.billing_status === 'underbilled' ? 'bg-red-50 border-red-200' :
                    'bg-green-50 border-green-200'
                  }`}>
                    <p className="text-xs text-corporate-gray mb-1">Status</p>
                    <p className={`text-lg font-bold ${
                      financialData.wip.billing_status === 'overbilled' ? 'text-amber-700' :
                      financialData.wip.billing_status === 'underbilled' ? 'text-red-600' :
                      'text-green-600'
                    }`}>
                      {financialData.wip.billing_status === 'overbilled' ? 'Overbilled' :
                       financialData.wip.billing_status === 'underbilled' ? 'Underbilled' : 'Even'}
                    </p>
                    <p className="text-sm text-corporate-gray">
                      {financialData.wip.overbilling > 0 && `${formatCurrency(financialData.wip.overbilling)} (liability)`}
                      {financialData.wip.underbilling > 0 && `${formatCurrency(financialData.wip.underbilling)} (asset)`}
                      {financialData.wip.overbilling === 0 && financialData.wip.underbilling === 0 && 'Billings match earned revenue'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border bg-gray-50 border-gray-200">
                    <p className="text-xs text-corporate-gray mb-1">Billings to Date</p>
                    <p className="text-lg font-bold text-corporate-dark">{formatCurrency(financialData.billings.billings_to_date)}</p>
                    <p className="text-sm text-corporate-gray">
                      {financialData.billings.invoices_count} invoices ({financialData.billings.paid_count} paid, {financialData.billings.overdue_count} overdue)
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border bg-gray-50 border-gray-200">
                    <p className="text-xs text-corporate-gray mb-1">Outstanding A/R</p>
                    <p className="text-lg font-bold text-corporate-dark">{formatCurrency(financialData.billings.outstanding_ar)}</p>
                    <p className="text-sm text-corporate-gray">
                      Collected: {formatCurrency(financialData.billings.payments_received)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown & Profitability */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                  <h3 className="font-semibold text-corporate-dark mb-4">Cost Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-gray">Estimated Cost</span>
                      <span className="font-medium text-corporate-dark">{formatCurrency(financialData.contract.estimated_cost)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-gray">Committed Costs (Bills)</span>
                      <span className="font-medium text-corporate-dark">{formatCurrency(financialData.costs.committed_costs)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-gray">Direct Expenses</span>
                      <span className="font-medium text-corporate-dark">{formatCurrency(financialData.costs.expense_costs)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100 font-semibold">
                      <span className="text-corporate-dark">Total Actual Cost</span>
                      <span className={financialData.costs.total_actual_cost > financialData.contract.estimated_cost ? 'text-red-600' : 'text-corporate-dark'}>
                        {formatCurrency(financialData.costs.total_actual_cost)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-gray">Cost to Complete</span>
                      <span className="font-medium text-corporate-dark">{formatCurrency(financialData.costs.cost_to_complete)}</span>
                    </div>
                    <div className="flex justify-between py-2 font-semibold">
                      <span className="text-corporate-dark">Projected Total Cost</span>
                      <span className="text-corporate-dark">{formatCurrency(financialData.costs.projected_total_cost)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-gray">Outstanding A/P</span>
                      <span className="font-medium text-red-600">{formatCurrency(financialData.costs.outstanding_ap)}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="font-semibold text-corporate-dark mb-4">Profitability Analysis</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-gray">Estimated Margin</span>
                      <span className="font-medium text-corporate-dark">{financialData.contract.estimated_margin.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-gray">Current Gross Margin</span>
                      <span className={`font-medium ${financialData.profitability.gross_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {financialData.profitability.gross_margin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-gray">Margin Variance</span>
                      <span className={`font-medium ${financialData.profitability.margin_variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {financialData.profitability.margin_variance >= 0 ? '+' : ''}{financialData.profitability.margin_variance.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-corporate-gray">Projected Margin at Completion</span>
                      <span className={`font-medium ${financialData.profitability.projected_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {financialData.profitability.projected_margin.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between py-2 pt-3 font-semibold">
                      <span className="text-corporate-dark">Projected Profit</span>
                      <span className={financialData.profitability.projected_profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(financialData.profitability.projected_profit)}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-corporate-gray">Margin Health:</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          financialData.profitability.margin_health === 'healthy' ? 'bg-green-100 text-green-700' :
                          financialData.profitability.margin_health === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {financialData.profitability.margin_health === 'healthy' ? 'Healthy' :
                           financialData.profitability.margin_health === 'warning' ? 'Warning' : 'Critical'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Burn Rate */}
              {financialData.burn_rate && (
                <div className="card">
                  <h3 className="font-semibold text-corporate-dark mb-4">Burn Rate Analysis</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-corporate-gray">Daily Burn</p>
                      <p className="font-medium text-corporate-dark">{formatCurrency(financialData.burn_rate.daily)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-corporate-gray">Weekly Burn</p>
                      <p className="font-medium text-corporate-dark">{formatCurrency(financialData.burn_rate.weekly)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-corporate-gray">Monthly Burn</p>
                      <p className="font-medium text-corporate-dark">{formatCurrency(financialData.burn_rate.monthly)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-corporate-gray">Est. Days Remaining</p>
                      <p className="font-medium text-corporate-dark">
                        {financialData.burn_rate.estimated_days_remaining ?? 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-corporate-gray">Projected Completion</p>
                      <p className="font-medium text-corporate-dark">
                        {financialData.burn_rate.projected_completion_date
                          ? formatDate(financialData.burn_rate.projected_completion_date)
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-corporate-gray mt-3">
                    Based on {financialData.burn_rate.days_of_cost_data} days of cost data
                  </p>
                </div>
              )}

              {/* Completion Progress */}
              <div className="card">
                <h3 className="font-semibold text-corporate-dark mb-4">Completion Progress</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-corporate-gray">Cost-to-Cost Method</span>
                      <span className="text-sm font-medium">{financialData.completion.percent_complete_cost.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          financialData.completion.percent_complete_cost >= 100 ? 'bg-green-500' :
                          financialData.completion.percent_complete_cost >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(financialData.completion.percent_complete_cost, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-corporate-gray">Phase Completion</span>
                      <span className="text-sm font-medium">
                        {financialData.completion.percent_complete_phases.toFixed(1)}%
                        ({financialData.completion.completed_phases}/{financialData.completion.total_phases} phases)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          financialData.completion.percent_complete_phases >= 100 ? 'bg-green-500' :
                          financialData.completion.percent_complete_phases >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(financialData.completion.percent_complete_phases, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center py-8">
              <p className="text-corporate-gray">Failed to load financial summary. Click the Financial tab to retry.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'phases' && (
        <div className="space-y-4">
          {phases.length === 0 && !showAddPhase ? (
            <div className="card text-center py-8">
              <p className="text-corporate-gray mb-4">No phases defined for this job</p>
              <button onClick={() => setShowAddPhase(true)} className="btn-primary">
                Add First Phase
              </button>
            </div>
          ) : (
            <>
              {phases.map((phase) => (
                <div key={phase.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-corporate-dark">{phase.name}</h3>
                        {getStatusBadge(phase.status)}
                      </div>
                      {phase.description && (
                        <p className="text-sm text-corporate-gray mt-1">{phase.description}</p>
                      )}
                    </div>
                    <select
                      value={phase.status}
                      onChange={(e) => updatePhaseStatus(phase.id, e.target.value as Phase['status'])}
                      className="input-field w-auto text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-corporate-gray">Est. Hours</p>
                      <p className="font-medium text-corporate-dark">{phase.estimated_hours}</p>
                    </div>
                    <div>
                      <p className="text-xs text-corporate-gray">Actual Hours</p>
                      {editingPhase === phase.id ? (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          defaultValue={phase.actual_hours}
                          className="input-field py-1 text-sm w-20"
                          id={`hours-${phase.id}`}
                        />
                      ) : (
                        <p className="font-medium text-corporate-dark">{phase.actual_hours}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-corporate-gray">Est. Cost</p>
                      <p className="font-medium text-corporate-dark">{formatCurrency(phase.estimated_cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-corporate-gray">Actual Cost</p>
                      {editingPhase === phase.id ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={phase.actual_cost}
                          className="input-field py-1 text-sm w-24"
                          id={`cost-${phase.id}`}
                        />
                      ) : (
                        <p className="font-medium text-corporate-dark">{formatCurrency(phase.actual_cost)}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-2">
                    {editingPhase === phase.id ? (
                      <>
                        <button
                          onClick={() => setEditingPhase(null)}
                          className="btn-secondary text-sm py-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            const hours = parseFloat((document.getElementById(`hours-${phase.id}`) as HTMLInputElement).value) || 0;
                            const cost = parseFloat((document.getElementById(`cost-${phase.id}`) as HTMLInputElement).value) || 0;
                            updatePhaseActuals(phase.id, hours, cost);
                          }}
                          className="btn-primary text-sm py-1"
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditingPhase(phase.id)}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Update Actuals
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {showAddPhase ? (
                <div className="card border-2 border-dashed border-primary-200">
                  <h3 className="font-semibold text-corporate-dark mb-4">Add New Phase</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="label">Phase Name *</label>
                      <input
                        type="text"
                        value={newPhase.name}
                        onChange={(e) => setNewPhase({ ...newPhase, name: e.target.value })}
                        className="input-field"
                        placeholder="e.g., Design Phase"
                      />
                    </div>
                    <div>
                      <label className="label">Description</label>
                      <input
                        type="text"
                        value={newPhase.description}
                        onChange={(e) => setNewPhase({ ...newPhase, description: e.target.value })}
                        className="input-field"
                        placeholder="Brief description"
                      />
                    </div>
                    <div>
                      <label className="label">Estimated Hours</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={newPhase.estimated_hours || ''}
                        onChange={(e) => setNewPhase({ ...newPhase, estimated_hours: parseFloat(e.target.value) || 0 })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Estimated Cost</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newPhase.estimated_cost || ''}
                        onChange={(e) => setNewPhase({ ...newPhase, estimated_cost: parseFloat(e.target.value) || 0 })}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAddPhase(false)} className="btn-secondary">Cancel</button>
                    <button onClick={addPhase} disabled={!newPhase.name} className="btn-primary disabled:opacity-50">
                      Add Phase
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddPhase(true)}
                  className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-corporate-gray hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Phase
                </button>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-corporate-gray">
              Invoices and bills linked to this job
            </p>
            <div className="flex gap-2">
              <Link href={`/dashboard/invoices/new?customer=${job.customer_id}`} className="btn-secondary text-sm">
                Create Invoice
              </Link>
              <Link href={`/dashboard/bills/new?job=${job.id}`} className="btn-secondary text-sm">
                Record Bill
              </Link>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-corporate-gray">No transactions linked to this job yet</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Date</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tx.type === 'invoice' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.type === 'invoice' ? 'Revenue' : 'Cost'}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/${tx.type}s/${tx.id}`}
                          className="font-medium text-primary-600 hover:text-primary-700"
                        >
                          {tx.reference}
                        </Link>
                      </td>
                      <td className="text-corporate-slate">{formatDate(tx.date)}</td>
                      <td className={`text-right font-medium ${
                        tx.type === 'invoice' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.type === 'invoice' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
