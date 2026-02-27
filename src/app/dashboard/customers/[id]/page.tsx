'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  balance: number;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  total: number;
}

interface Estimate {
  id: string;
  estimate_number: string;
  status: string;
  issue_date: string;
  expiry_date: string;
  total: number;
}

interface Payment {
  id: string;
  payment_number: string;
  type: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  invoices?: { id: string; invoice_number: string } | null;
}

interface Job {
  id: string;
  job_number: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  estimated_revenue: number;
  actual_revenue: number;
}

interface CustomerNote {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface CustomerTodo {
  id: string;
  title: string;
  description: string;
  is_completed: number;
  due_date: string;
  created_at: string;
}

interface StatementData {
  customer: Customer;
  start_date: string;
  end_date: string;
  opening_balance: number;
  invoices: { id: string; invoice_number: string; issue_date: string; due_date: string; status: string; total: number }[];
  payments: { id: string; payment_number: string; payment_date: string; payment_method: string; amount: number; invoice_id: string }[];
  period_invoice_total: number;
  period_payment_total: number;
  ending_balance: number;
}

type TabKey = 'invoices' | 'estimates' | 'payments' | 'jobs' | 'notes' | 'todos' | 'statements';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [todos, setTodos] = useState<CustomerTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [activeTab, setActiveTab] = useState<TabKey>('invoices');
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [statementStartDate, setStatementStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [statementEndDate, setStatementEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  useEffect(() => {
    loadCustomer();
  }, [params.id]);

  const loadCustomer = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;

    // Load customer
    const { data: customerData, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();

    if (error || !customerData) {
      router.push('/dashboard/customers');
      return;
    }

    setCustomer(customerData);
    setFormData(customerData);

    // Load all related data in parallel
    const [invoicesRes, estimatesRes, jobsRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('customer_id', params.id).order('issue_date', { ascending: false }),
      supabase.from('estimates').select('*').eq('customer_id', params.id).order('issue_date', { ascending: false }),
      supabase.from('jobs').select('*').eq('customer_id', params.id).order('created_at', { ascending: false }),
    ]);

    setInvoices(invoicesRes.data || []);
    setEstimates(estimatesRes.data || []);
    setJobs(jobsRes.data || []);

    // Load payments linked to this customer's invoices
    const invoiceIds = (invoicesRes.data || []).map((i: Invoice) => i.id);
    if (invoiceIds.length > 0) {
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('type', 'received')
        .order('payment_date', { ascending: false });
      // Filter client-side for payments linked to this customer's invoices
      const allPayments = paymentsData || [];
      const customerPayments = allPayments.filter((p: Payment) => {
        if (p.invoices && invoiceIds.includes(p.invoices.id)) return true;
        // Fallback: check invoice_id directly
        const invoiceId = (p as unknown as { invoice_id?: string }).invoice_id;
        return invoiceId && invoiceIds.includes(invoiceId);
      });
      setPayments(customerPayments);
    }

    // Load notes and todos via API
    await loadNotesAndTodos(userId);

    setLoading(false);
  };

  const loadNotesAndTodos = async (userId?: string) => {
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }
    if (!userId) return;

    const [notesRes, todosRes] = await Promise.all([
      fetch(`/api/customer-notes?user_id=${userId}&customer_id=${params.id}`).then(r => r.json()),
      fetch(`/api/customer-todos?user_id=${userId}&customer_id=${params.id}`).then(r => r.json()),
    ]);

    setNotes(notesRes.data || []);
    setTodos(todosRes.data || []);
  };

  const handleSave = async () => {
    const { error } = await supabase
      .from('customers')
      .update(formData)
      .eq('id', params.id);

    if (!error) {
      setCustomer({ ...customer, ...formData } as Customer);
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this customer? This cannot be undone.')) return;

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', params.id);

    if (!error) {
      router.push('/dashboard/customers');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/customer-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: session.user.id, customer_id: params.id, content: newNote }),
    });
    const result = await res.json();
    if (result.success) {
      setNotes([result.data, ...notes]);
      setNewNote('');
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editingNoteContent.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/customer-notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: noteId, user_id: session.user.id, content: editingNoteContent }),
    });
    const result = await res.json();
    if (result.success) {
      setNotes(notes.map(n => n.id === noteId ? result.data : n));
      setEditingNoteId(null);
      setEditingNoteContent('');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/customer-notes?id=${noteId}&user_id=${session.user.id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      setNotes(notes.filter(n => n.id !== noteId));
    }
  };

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/customer-todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: session.user.id,
        customer_id: params.id,
        title: newTodoTitle,
        due_date: newTodoDueDate || null,
      }),
    });
    const result = await res.json();
    if (result.success) {
      setTodos([result.data, ...todos]);
      setNewTodoTitle('');
      setNewTodoDueDate('');
    }
  };

  const handleToggleTodo = async (todo: CustomerTodo) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/customer-todos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: todo.id,
        user_id: session.user.id,
        is_completed: todo.is_completed ? 0 : 1,
      }),
    });
    const result = await res.json();
    if (result.success) {
      setTodos(todos.map(t => t.id === todo.id ? result.data : t));
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/customer-todos?id=${todoId}&user_id=${session.user.id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      setTodos(todos.filter(t => t.id !== todoId));
    }
  };

  const handleGenerateStatement = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setStatementLoading(true);
    try {
      const res = await fetch(
        `/api/customer-statements?user_id=${session.user.id}&customer_id=${params.id}&start_date=${statementStartDate}&end_date=${statementEndDate}`
      );
      const result = await res.json();
      if (result.success) {
        setStatement(result.data);
      }
    } catch (error) {
      console.error('Error generating statement:', error);
    }
    setStatementLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
      accepted: 'bg-green-100 text-green-700',
      declined: 'bg-red-100 text-red-700',
      expired: 'bg-orange-100 text-orange-700',
      converted: 'bg-purple-100 text-purple-700',
      pending: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      on_hold: 'bg-orange-100 text-orange-700',
      cancelled: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!customer) return null;

  const totalInvoiced = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'draft').reduce((sum, i) => sum + (i.total || 0), 0);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'invoices', label: 'Invoices', count: invoices.length },
    { key: 'estimates', label: 'Estimates', count: estimates.length },
    { key: 'payments', label: 'Payments', count: payments.length },
    { key: 'jobs', label: 'Jobs', count: jobs.length },
    { key: 'notes', label: 'Notes', count: notes.length },
    { key: 'todos', label: 'To-Do', count: todos.filter(t => !t.is_completed).length },
    { key: 'statements', label: 'Statements', count: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/customers" className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-bold text-xl">{customer.name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-corporate-dark">{customer.name}</h1>
              <p className="text-corporate-gray">{customer.company || customer.email}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="btn-secondary"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Invoiced</p>
          <p className="text-xl font-bold text-corporate-dark">{formatCurrency(totalInvoiced)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Paid</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Outstanding</p>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(outstanding)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Active Jobs</p>
          <p className="text-xl font-bold text-corporate-dark">{jobs.filter(j => j.status === 'in_progress' || j.status === 'pending').length}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-sm font-semibold text-corporate-gray uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/estimates/new?customer=${customer.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            New Estimate
          </Link>
          <Link
            href={`/dashboard/invoices/new?customer=${customer.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            New Invoice
          </Link>
          <Link
            href={`/dashboard/payments/receive?customer=${customer.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Receive Payment
          </Link>
          <Link
            href={`/dashboard/jobs/new?customer=${customer.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            New Job
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Details - Left Column */}
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-4">Contact Information</h2>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Company</label>
                <input
                  type="text"
                  value={formData.company || ''}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Address</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="City"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="input-field"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={formData.state || ''}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="input-field"
                />
                <input
                  type="text"
                  placeholder="ZIP"
                  value={formData.zip || ''}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} className="btn-primary flex-1">Save</button>
                <button onClick={handleDelete} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">Delete</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${customer.email}`} className="text-primary-600 hover:underline">{customer.email}</a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${customer.phone}`} className="text-corporate-slate">{customer.phone}</a>
                </div>
              )}
              {(customer.address || customer.city) && (
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-corporate-gray mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="text-corporate-slate">
                    {customer.address && <p>{customer.address}</p>}
                    <p>{[customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
              )}
              <div className="pt-2 text-xs text-corporate-gray">
                Customer since {new Date(customer.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            </div>
          )}
        </div>

        {/* Tabbed Content - Right 2 Columns */}
        <div className="lg:col-span-2 card">
          {/* Tab Headers */}
          <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4 -mt-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-corporate-gray hover:text-corporate-dark hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px]">
            {/* INVOICES TAB */}
            {activeTab === 'invoices' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-corporate-gray uppercase">Invoice History</h3>
                  <Link href={`/dashboard/invoices/new?customer=${customer.id}`} className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                    + New Invoice
                  </Link>
                </div>
                {invoices.length === 0 ? (
                  <p className="text-corporate-gray text-center py-8">No invoices yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Date</th>
                          <th>Due</th>
                          <th>Status</th>
                          <th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice) => (
                          <tr key={invoice.id}>
                            <td>
                              <Link href={`/dashboard/invoices/${invoice.id}`} className="text-primary-600 hover:underline font-medium">
                                {invoice.invoice_number}
                              </Link>
                            </td>
                            <td className="text-corporate-slate">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                            <td className="text-corporate-slate">{new Date(invoice.due_date).toLocaleDateString()}</td>
                            <td>{getStatusBadge(invoice.status)}</td>
                            <td className="text-right font-semibold">{formatCurrency(invoice.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ESTIMATES TAB */}
            {activeTab === 'estimates' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-corporate-gray uppercase">Estimates</h3>
                  <Link href={`/dashboard/estimates/new?customer=${customer.id}`} className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                    + New Estimate
                  </Link>
                </div>
                {estimates.length === 0 ? (
                  <p className="text-corporate-gray text-center py-8">No estimates yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Estimate</th>
                          <th>Date</th>
                          <th>Expires</th>
                          <th>Status</th>
                          <th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estimates.map((estimate) => (
                          <tr key={estimate.id}>
                            <td>
                              <Link href={`/dashboard/estimates/${estimate.id}`} className="text-primary-600 hover:underline font-medium">
                                {estimate.estimate_number}
                              </Link>
                            </td>
                            <td className="text-corporate-slate">{new Date(estimate.issue_date).toLocaleDateString()}</td>
                            <td className="text-corporate-slate">{new Date(estimate.expiry_date).toLocaleDateString()}</td>
                            <td>{getStatusBadge(estimate.status)}</td>
                            <td className="text-right font-semibold">{formatCurrency(estimate.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === 'payments' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-corporate-gray uppercase">Payments Received</h3>
                  <Link href={`/dashboard/payments/receive?customer=${customer.id}`} className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                    + Receive Payment
                  </Link>
                </div>
                {payments.length === 0 ? (
                  <p className="text-corporate-gray text-center py-8">No payments recorded yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Payment</th>
                          <th>Date</th>
                          <th>Method</th>
                          <th>Invoice</th>
                          <th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="font-medium text-corporate-dark">{payment.payment_number}</td>
                            <td className="text-corporate-slate">{new Date(payment.payment_date).toLocaleDateString()}</td>
                            <td className="text-corporate-slate capitalize">{(payment.payment_method || '').replace('_', ' ')}</td>
                            <td>
                              {payment.invoices ? (
                                <Link href={`/dashboard/invoices/${payment.invoices.id}`} className="text-primary-600 hover:underline">
                                  {payment.invoices.invoice_number}
                                </Link>
                              ) : (
                                <span className="text-corporate-gray">-</span>
                              )}
                            </td>
                            <td className="text-right font-semibold text-green-600">{formatCurrency(payment.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* JOBS TAB */}
            {activeTab === 'jobs' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-corporate-gray uppercase">Jobs</h3>
                  <Link href={`/dashboard/jobs/new?customer=${customer.id}`} className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                    + New Job
                  </Link>
                </div>
                {jobs.length === 0 ? (
                  <p className="text-corporate-gray text-center py-8">No jobs yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Job</th>
                          <th>Name</th>
                          <th>Status</th>
                          <th className="text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map((job) => (
                          <tr key={job.id}>
                            <td>
                              <Link href={`/dashboard/jobs/${job.id}`} className="text-primary-600 hover:underline font-medium">
                                {job.job_number}
                              </Link>
                            </td>
                            <td className="text-corporate-dark">{job.name}</td>
                            <td>{getStatusBadge(job.status)}</td>
                            <td className="text-right font-semibold">
                              {formatCurrency(job.actual_revenue || job.estimated_revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* NOTES TAB */}
            {activeTab === 'notes' && (
              <div>
                <h3 className="text-sm font-semibold text-corporate-gray uppercase mb-3">Notes</h3>
                {/* Add Note */}
                <div className="flex gap-2 mb-4">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    className="input-field flex-1 min-h-[60px]"
                    rows={2}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="btn-primary self-end disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                {notes.length === 0 ? (
                  <p className="text-corporate-gray text-center py-8">No notes yet</p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                        {editingNoteId === note.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNoteContent}
                              onChange={(e) => setEditingNoteContent(e.target.value)}
                              className="input-field w-full min-h-[60px]"
                              rows={2}
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => { setEditingNoteId(null); setEditingNoteContent(''); }}
                                className="text-sm text-corporate-gray hover:text-corporate-dark"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleUpdateNote(note.id)}
                                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-corporate-dark whitespace-pre-wrap">{note.content}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-corporate-gray">
                                {new Date(note.created_at).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                                })}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content); }}
                                  className="text-xs text-corporate-gray hover:text-primary-600"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="text-xs text-corporate-gray hover:text-red-600"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TODOS TAB */}
            {activeTab === 'todos' && (
              <div>
                <h3 className="text-sm font-semibold text-corporate-gray uppercase mb-3">To-Do List</h3>
                {/* Add Todo */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newTodoTitle}
                    onChange={(e) => setNewTodoTitle(e.target.value)}
                    placeholder="Add a task..."
                    className="input-field flex-1"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(); }}
                  />
                  <input
                    type="date"
                    value={newTodoDueDate}
                    onChange={(e) => setNewTodoDueDate(e.target.value)}
                    className="input-field w-36"
                  />
                  <button
                    onClick={handleAddTodo}
                    disabled={!newTodoTitle.trim()}
                    className="btn-primary disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                {todos.length === 0 ? (
                  <p className="text-corporate-gray text-center py-8">No tasks yet</p>
                ) : (
                  <div className="space-y-2">
                    {todos.map((todo) => (
                      <div
                        key={todo.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          todo.is_completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <button
                          onClick={() => handleToggleTodo(todo)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            todo.is_completed
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 hover:border-primary-400'
                          }`}
                        >
                          {todo.is_completed ? (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${todo.is_completed ? 'line-through text-corporate-gray' : 'text-corporate-dark'}`}>
                            {todo.title}
                          </p>
                          {todo.due_date && (
                            <p className={`text-xs mt-0.5 ${
                              !todo.is_completed && new Date(todo.due_date) < new Date()
                                ? 'text-red-500'
                                : 'text-corporate-gray'
                            }`}>
                              Due {new Date(todo.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteTodo(todo.id)}
                          className="text-corporate-gray hover:text-red-600 flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STATEMENTS TAB */}
            {activeTab === 'statements' && (
              <div>
                <h3 className="text-sm font-semibold text-corporate-gray uppercase mb-3">Account Statement</h3>
                {/* Date Range + Generate */}
                <div className="flex flex-wrap gap-2 mb-4 items-end print:hidden">
                  <div>
                    <label className="label">Start Date</label>
                    <input
                      type="date"
                      value={statementStartDate}
                      onChange={(e) => setStatementStartDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input
                      type="date"
                      value={statementEndDate}
                      onChange={(e) => setStatementEndDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <button
                    onClick={handleGenerateStatement}
                    disabled={statementLoading}
                    className="btn-primary disabled:opacity-50"
                  >
                    {statementLoading ? 'Generating...' : 'Generate'}
                  </button>
                  {statement && (
                    <button
                      onClick={() => window.print()}
                      className="btn-outline"
                    >
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print
                    </button>
                  )}
                </div>

                {/* Statement Content */}
                {!statement && !statementLoading && (
                  <p className="text-corporate-gray text-center py-8">Select a date range and click Generate to view the statement.</p>
                )}

                {statement && (
                  <div id="statement-print-area" className="space-y-4">
                    {/* Statement Header (visible in print) */}
                    <div className="hidden print:block text-center mb-4">
                      <h2 className="text-xl font-bold">{customer.name} - Account Statement</h2>
                      <p className="text-sm text-corporate-gray">
                        {new Date(statement.start_date).toLocaleDateString()} - {new Date(statement.end_date).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Opening Balance */}
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-corporate-dark">Opening Balance</span>
                      <span className="font-semibold text-corporate-dark">{formatCurrency(statement.opening_balance)}</span>
                    </div>

                    {/* Invoices */}
                    {statement.invoices.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-corporate-gray uppercase mb-2">Invoices</h4>
                        <div className="overflow-x-auto">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Invoice</th>
                                <th>Date</th>
                                <th>Due</th>
                                <th>Status</th>
                                <th className="text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {statement.invoices.map((inv) => (
                                <tr key={inv.id}>
                                  <td className="font-medium">{inv.invoice_number}</td>
                                  <td>{new Date(inv.issue_date).toLocaleDateString()}</td>
                                  <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                                  <td>{getStatusBadge(inv.status)}</td>
                                  <td className="text-right font-semibold">{formatCurrency(inv.total)}</td>
                                </tr>
                              ))}
                              <tr className="font-semibold">
                                <td colSpan={4} className="text-right">Total Invoiced</td>
                                <td className="text-right">{formatCurrency(statement.period_invoice_total)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Payments */}
                    {statement.payments.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-corporate-gray uppercase mb-2">Payments</h4>
                        <div className="overflow-x-auto">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Payment</th>
                                <th>Date</th>
                                <th>Method</th>
                                <th className="text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {statement.payments.map((pmt) => (
                                <tr key={pmt.id}>
                                  <td className="font-medium">{pmt.payment_number}</td>
                                  <td>{new Date(pmt.payment_date).toLocaleDateString()}</td>
                                  <td className="capitalize">{(pmt.payment_method || '').replace('_', ' ')}</td>
                                  <td className="text-right font-semibold text-green-600">{formatCurrency(pmt.amount)}</td>
                                </tr>
                              ))}
                              <tr className="font-semibold">
                                <td colSpan={3} className="text-right">Total Payments</td>
                                <td className="text-right text-green-600">{formatCurrency(statement.period_payment_total)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Ending Balance */}
                    <div className="flex justify-between items-center p-3 bg-primary-50 rounded-lg border border-primary-200">
                      <span className="font-semibold text-primary-700">Ending Balance</span>
                      <span className="text-xl font-bold text-primary-700">{formatCurrency(statement.ending_balance)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
