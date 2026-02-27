'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Estimate {
  id: string;
  estimate_number: string;
  customer_id: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted';
  issue_date: string;
  expiry_date: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string;
  terms: string;
  converted_invoice_id: string | null;
  customers?: { id: string; name: string; email: string; company: string; address: string; phone: string } | null;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export default function EstimateDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadEstimate();
  }, [params.id]);

  const loadEstimate = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: estimateData, error } = await supabase
      .from('estimates')
      .select(`
        *,
        customers (id, name, email, company, address, phone)
      `)
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !estimateData) {
      router.push('/dashboard/estimates');
      return;
    }

    setEstimate(estimateData);

    const { data: itemsData } = await supabase
      .from('estimate_items')
      .select('*')
      .eq('estimate_id', params.id)
      .order('sort_order');

    setLineItems(itemsData || []);
    setLoading(false);
  };

  const updateStatus = async (status: Estimate['status']) => {
    if (!estimate) return;
    setUpdating(true);

    const { error } = await supabase
      .from('estimates')
      .update({ status })
      .eq('id', estimate.id);

    if (!error) {
      setEstimate({ ...estimate, status });
    }
    setUpdating(false);
  };

  const convertToInvoice = async () => {
    if (!estimate || estimate.status === 'converted') return;
    setConverting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Create invoice from estimate
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: session.user.id,
        customer_id: estimate.customer_id,
        invoice_number: `INV-${estimate.estimate_number.replace('EST-', '')}`,
        status: 'draft',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal: estimate.subtotal,
        tax_amount: estimate.tax_amount,
        total: estimate.total,
        notes: estimate.notes,
        estimate_id: estimate.id,
      })
      .select()
      .single();

    if (invoiceError || !invoice) {
      console.error('Error creating invoice:', invoiceError);
      alert('Error creating invoice');
      setConverting(false);
      return;
    }

    // Copy line items
    const items = lineItems.map((item, index) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
      sort_order: index,
    }));

    if (items.length > 0) {
      await supabase.from('invoice_items').insert(items);
    }

    // Update estimate status
    await supabase
      .from('estimates')
      .update({ status: 'converted', converted_invoice_id: invoice.id })
      .eq('id', estimate.id);

    router.push(`/dashboard/invoices/${invoice.id}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      accepted: 'bg-green-100 text-green-700',
      declined: 'bg-red-100 text-red-700',
      expired: 'bg-yellow-100 text-yellow-700',
      converted: 'bg-purple-100 text-purple-700',
    };
    const labels: Record<string, string> = {
      draft: 'Draft',
      sent: 'Sent',
      accepted: 'Accepted',
      declined: 'Declined',
      expired: 'Expired',
      converted: 'Converted to Invoice',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading || !estimate) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const isExpired = new Date(estimate.expiry_date) < new Date() && estimate.status === 'sent';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard/estimates" className="text-corporate-gray hover:text-corporate-dark">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-lg font-semibold text-corporate-dark">{estimate.estimate_number}</span>
            {getStatusBadge(isExpired ? 'expired' : estimate.status)}
          </div>
          <p className="text-corporate-gray">
            Created on {formatDate(estimate.issue_date)}
            {estimate.status !== 'converted' && (
              <> • Expires {formatDate(estimate.expiry_date)}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {estimate.status === 'draft' && (
            <button
              onClick={() => updateStatus('sent')}
              disabled={updating}
              className="btn-primary"
            >
              Send Estimate
            </button>
          )}
          {estimate.status === 'sent' && !isExpired && (
            <>
              <button
                onClick={() => updateStatus('accepted')}
                disabled={updating}
                className="btn-primary bg-green-600 hover:bg-green-700"
              >
                Mark Accepted
              </button>
              <button
                onClick={() => updateStatus('declined')}
                disabled={updating}
                className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
              >
                Mark Declined
              </button>
            </>
          )}
          {estimate.status === 'accepted' && (
            <button
              onClick={convertToInvoice}
              disabled={converting}
              className="btn-primary bg-purple-600 hover:bg-purple-700"
            >
              {converting ? 'Converting...' : 'Convert to Invoice'}
            </button>
          )}
          {estimate.status === 'converted' && estimate.converted_invoice_id && (
            <Link
              href={`/dashboard/invoices/${estimate.converted_invoice_id}`}
              className="btn-secondary"
            >
              View Invoice
            </Link>
          )}
          <Link href={`/dashboard/estimates/${estimate.id}/edit`} className="btn-secondary">
            Edit
          </Link>
        </div>
      </div>

      {/* Estimate Document */}
      <div className="card">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-corporate-dark mb-1">ESTIMATE</h2>
            <p className="text-corporate-gray">{estimate.estimate_number}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-corporate-gray">Issue Date</p>
            <p className="font-medium text-corporate-dark">{formatDate(estimate.issue_date)}</p>
            <p className="text-sm text-corporate-gray mt-2">Valid Until</p>
            <p className={`font-medium ${isExpired ? 'text-red-600' : 'text-corporate-dark'}`}>
              {formatDate(estimate.expiry_date)}
              {isExpired && ' (Expired)'}
            </p>
          </div>
        </div>

        {/* Customer Info */}
        <div className="py-6 border-b border-gray-200">
          <p className="text-sm text-corporate-gray mb-2">Prepared For</p>
          {estimate.customers && (
            <div>
              <p className="font-semibold text-corporate-dark">{estimate.customers.name}</p>
              {estimate.customers.company && <p className="text-corporate-slate">{estimate.customers.company}</p>}
              {estimate.customers.address && <p className="text-corporate-slate">{estimate.customers.address}</p>}
              {estimate.customers.email && <p className="text-corporate-slate">{estimate.customers.email}</p>}
              {estimate.customers.phone && <p className="text-corporate-slate">{estimate.customers.phone}</p>}
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="py-6">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-corporate-gray border-b border-gray-200">
                <th className="pb-3">Description</th>
                <th className="pb-3 text-right">Qty</th>
                <th className="pb-3 text-right">Rate</th>
                <th className="pb-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-4 text-corporate-dark">{item.description}</td>
                  <td className="py-4 text-right text-corporate-slate">{item.quantity}</td>
                  <td className="py-4 text-right text-corporate-slate">{formatCurrency(item.rate)}</td>
                  <td className="py-4 text-right font-medium text-corporate-dark">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-corporate-slate">
                <span>Subtotal</span>
                <span>{formatCurrency(estimate.subtotal)}</span>
              </div>
              <div className="flex justify-between text-corporate-slate">
                <span>Tax</span>
                <span>{formatCurrency(estimate.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-corporate-dark pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{formatCurrency(estimate.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(estimate.notes || estimate.terms) && (
          <div className="mt-8 pt-6 border-t border-gray-200 space-y-4">
            {estimate.notes && (
              <div>
                <p className="text-sm font-medium text-corporate-gray mb-1">Notes</p>
                <p className="text-corporate-slate whitespace-pre-wrap">{estimate.notes}</p>
              </div>
            )}
            {estimate.terms && (
              <div>
                <p className="text-sm font-medium text-corporate-gray mb-1">Terms & Conditions</p>
                <p className="text-corporate-slate whitespace-pre-wrap">{estimate.terms}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <button className="btn-secondary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download PDF
        </button>
        <button className="btn-secondary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email to Customer
        </button>
      </div>
    </div>
  );
}
