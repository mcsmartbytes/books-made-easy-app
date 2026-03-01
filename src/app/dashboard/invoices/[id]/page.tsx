'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  sort_order: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  job_id: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  terms: string | null;
  customers?: { name: string; email: string; company?: string } | null;
  invoice_items?: InvoiceItem[];
}

interface Payment {
  id: string;
  payment_number: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string | null;
}

interface Reminder {
  id: string;
  reminder_type: string;
  message: string | null;
  sent_at: string;
}

interface LateFee {
  id: string;
  fee_type: string;
  fee_amount: number;
  calculated_fee: number;
  invoice_total_before: number;
  invoice_total_after: number;
  applied_type: string;
  reversed: number;
  applied_at: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [lateFees, setLateFees] = useState<LateFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;

    const [invoiceRes, paymentsRes, remindersRes, lateFeesRes] = await Promise.all([
      fetch(`/api/invoices?id=${invoiceId}&user_id=${userId}`).then(r => r.json()),
      fetch(`/api/payments?invoice_id=${invoiceId}&user_id=${userId}`).then(r => r.json()),
      fetch(`/api/invoice-reminders?invoice_id=${invoiceId}&user_id=${userId}`).then(r => r.json()),
      fetch(`/api/invoice-late-fees?invoice_id=${invoiceId}&user_id=${userId}`).then(r => r.json()),
    ]);

    if (invoiceRes.success) {
      const inv = invoiceRes.data;
      // Mark overdue if past due date and still sent
      const today = new Date().toISOString().split('T')[0];
      if (inv.status === 'sent' && inv.due_date < today) {
        inv.status = 'overdue';
      }
      setInvoice(inv);
    }
    if (paymentsRes.success) setPayments(paymentsRes.data || []);
    if (remindersRes.success) setReminders(remindersRes.data || []);
    if (lateFeesRes.success) setLateFees(lateFeesRes.data || []);
    setLoading(false);
  };

  const handleSendInvoice = async () => {
    if (!invoice) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setActionLoading('send');
    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invoice.id, user_id: session.user.id, status: 'sent' }),
      });
      const result = await res.json();
      if (result.success) {
        setInvoice(prev => prev ? { ...prev, status: 'sent' } : null);
      } else {
        alert(result.error || 'Failed to send invoice');
      }
    } catch {
      alert('Failed to send invoice');
    }
    setActionLoading(null);
  };

  const handleSendReminder = async () => {
    if (!invoice) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setActionLoading('reminder');
    try {
      const res = await fetch('/api/invoice-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.user.id, invoice_id: invoice.id }),
      });
      const result = await res.json();
      if (result.success) {
        await loadInvoice();
      } else {
        alert(result.error || 'Failed to send reminder');
      }
    } catch {
      alert('Failed to send reminder');
    }
    setActionLoading(null);
  };

  const handleApplyLateFee = async () => {
    if (!invoice) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (!confirm('Apply a late fee to this invoice? The invoice total will be updated.')) return;

    setActionLoading('fee');
    try {
      const res = await fetch('/api/invoice-late-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.user.id, invoice_id: invoice.id }),
      });
      const result = await res.json();
      if (result.success) {
        setInvoice(prev => prev ? { ...prev, total: result.new_total } : null);
        await loadInvoice();
      } else {
        alert(result.error || 'Failed to apply late fee');
      }
    } catch {
      alert('Failed to apply late fee');
    }
    setActionLoading(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
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

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-corporate-gray">Invoice not found</p>
        <Link href="/dashboard/invoices" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">
          Back to Invoices
        </Link>
      </div>
    );
  }

  const balanceDue = invoice.total - (invoice.amount_paid || 0);
  const isOverdue = invoice.status === 'overdue';
  const isActionable = invoice.status === 'sent' || isOverdue;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-corporate-gray mb-1">
          <Link href="/dashboard/invoices" className="hover:text-primary-600">Invoices</Link>
          <span>/</span>
          <span>{invoice.invoice_number}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-corporate-dark">{invoice.invoice_number}</h1>
            {getStatusBadge(invoice.status)}
          </div>
          <div className="flex items-center gap-2">
            {invoice.status === 'draft' && (
              <button
                onClick={handleSendInvoice}
                disabled={actionLoading === 'send'}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {actionLoading === 'send' ? 'Sending...' : 'Send Invoice'}
              </button>
            )}
            {isActionable && (
              <Link
                href={`/dashboard/payments/receive?invoice=${invoice.id}`}
                className="btn-primary flex items-center gap-2 justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Record Payment
              </Link>
            )}
            {isOverdue && (
              <>
                <button
                  onClick={handleSendReminder}
                  disabled={actionLoading === 'reminder'}
                  className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {actionLoading === 'reminder' ? 'Sending...' : 'Send Reminder'}
                </button>
                <button
                  onClick={handleApplyLateFee}
                  disabled={actionLoading === 'fee'}
                  className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1m4.5-6.5h.01M7.5 12.5h.01" />
                  </svg>
                  {actionLoading === 'fee' ? 'Applying...' : 'Apply Late Fee'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details, Line Items, Payment/Reminder/Fee History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Details */}
          <div className="card">
            <h3 className="text-lg font-medium text-corporate-dark mb-4">Invoice Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-corporate-gray">Customer</p>
                <p className="font-medium text-corporate-dark">{invoice.customers?.name || '-'}</p>
                {invoice.customers?.email && (
                  <p className="text-xs text-corporate-gray">{invoice.customers.email}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-corporate-gray">Issue Date</p>
                <p className="font-medium text-corporate-dark">
                  {new Date(invoice.issue_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-corporate-gray">Due Date</p>
                <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-corporate-dark'}`}>
                  {new Date(invoice.due_date).toLocaleDateString()}
                </p>
              </div>
              {invoice.job_id && invoice.customers && (
                <div>
                  <p className="text-sm text-corporate-gray">Job</p>
                  <Link
                    href={`/dashboard/jobs/${invoice.job_id}`}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    View Linked Job
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          {invoice.invoice_items && invoice.invoice_items.length > 0 && (
            <div className="card overflow-hidden">
              <h3 className="text-lg font-medium text-corporate-dark mb-4">Line Items</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.invoice_items
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((item) => (
                      <tr key={item.id}>
                        <td className="text-corporate-dark">{item.description || '-'}</td>
                        <td className="text-right text-corporate-slate">{item.quantity}</td>
                        <td className="text-right text-corporate-slate">{formatCurrency(item.rate)}</td>
                        <td className="text-right font-medium text-corporate-dark">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={3} className="text-right font-medium text-corporate-dark">Subtotal</td>
                    <td className="text-right font-medium text-corporate-dark">{formatCurrency(invoice.subtotal)}</td>
                  </tr>
                  {invoice.tax_amount > 0 && (
                    <tr>
                      <td colSpan={3} className="text-right text-corporate-gray">
                        Tax{invoice.tax_rate ? ` (${invoice.tax_rate}%)` : ''}
                      </td>
                      <td className="text-right text-corporate-slate">{formatCurrency(invoice.tax_amount)}</td>
                    </tr>
                  )}
                  <tr className="border-t">
                    <td colSpan={3} className="text-right font-bold text-corporate-dark">Total</td>
                    <td className="text-right font-bold text-corporate-dark">{formatCurrency(invoice.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Payment History */}
          <div className="card">
            <h3 className="text-lg font-medium text-corporate-dark mb-4">Payment History</h3>
            {payments.length === 0 ? (
              <p className="text-corporate-gray text-sm">No payments recorded for this invoice.</p>
            ) : (
              <div className="space-y-3">
                {payments.map((pmt) => (
                  <div key={pmt.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-corporate-dark">{pmt.payment_number}</p>
                      <p className="text-sm text-corporate-gray">
                        {new Date(pmt.payment_date).toLocaleDateString()} - {(pmt.payment_method || 'other').replace('_', ' ')}
                        {pmt.reference && ` (${pmt.reference})`}
                      </p>
                    </div>
                    <p className="font-semibold text-green-600">{formatCurrency(pmt.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reminders History */}
          {reminders.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-medium text-corporate-dark mb-4">
                Reminders Sent
                <span className="ml-2 text-sm font-normal text-corporate-gray">({reminders.length})</span>
              </h3>
              <div className="space-y-3">
                {reminders.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div>
                      <p className="font-medium text-corporate-dark capitalize">{r.reminder_type} reminder</p>
                      {r.message && <p className="text-sm text-corporate-gray">{r.message}</p>}
                    </div>
                    <p className="text-sm text-corporate-gray whitespace-nowrap">
                      {new Date(r.sent_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Late Fees History */}
          {lateFees.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-medium text-corporate-dark mb-4">
                Late Fees Applied
                <span className="ml-2 text-sm font-normal text-corporate-gray">({lateFees.length})</span>
              </h3>
              <div className="space-y-3">
                {lateFees.map((fee) => (
                  <div key={fee.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium text-corporate-dark">
                        {fee.fee_type === 'percentage'
                          ? `${fee.fee_amount}% late fee`
                          : `${formatCurrency(fee.fee_amount)} flat fee`}
                        <span className="text-xs text-corporate-gray ml-2 capitalize">({fee.applied_type})</span>
                      </p>
                      <p className="text-sm text-corporate-gray">
                        {formatCurrency(fee.invoice_total_before)} &rarr; {formatCurrency(fee.invoice_total_after)}
                        {fee.reversed === 1 && (
                          <span className="ml-2 text-xs text-red-600 font-medium">(Reversed)</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">+{formatCurrency(fee.calculated_fee)}</p>
                      <p className="text-xs text-corporate-gray">
                        {new Date(fee.applied_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Summary + Notes */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="card">
            <h3 className="text-lg font-medium text-corporate-dark mb-4">Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-corporate-gray">Subtotal</span>
                <span className="font-medium text-corporate-dark">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-corporate-gray">Tax{invoice.tax_rate ? ` (${invoice.tax_rate}%)` : ''}</span>
                  <span className="font-medium text-corporate-dark">{formatCurrency(invoice.tax_amount)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between">
                <span className="font-medium text-corporate-dark">Total</span>
                <span className="font-medium text-corporate-dark">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-corporate-gray">Paid</span>
                <span className="font-medium text-green-600">{formatCurrency(invoice.amount_paid || 0)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold text-corporate-dark">Balance Due</span>
                <span className={`text-xl font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>

            {isActionable && balanceDue > 0 && (
              <Link
                href={`/dashboard/payments/receive?invoice=${invoice.id}`}
                className="w-full btn-primary mt-4 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Receive {formatCurrency(balanceDue)}
              </Link>
            )}
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <div className="card">
              {invoice.terms && (
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-corporate-dark mb-2">Terms</h3>
                  <p className="text-corporate-slate text-sm whitespace-pre-wrap">{invoice.terms}</p>
                </div>
              )}
              {invoice.notes && (
                <div>
                  <h3 className="text-lg font-medium text-corporate-dark mb-2">Notes</h3>
                  <p className="text-corporate-slate text-sm whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
