'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Payment {
  id: string;
  payment_number: string;
  type: 'received' | 'made';
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string;
  invoice_id: string | null;
  bill_id: string | null;
  customer_name: string | null;
  vendor_name: string | null;
  document_number: string | null;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'received' | 'made'>('all');

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: paymentsData, error } = await supabase
      .from('payments')
      .select(`
        *,
        invoices (invoice_number, customers (name)),
        bills (bill_number, vendors (name))
      `)
      .eq('user_id', session.user.id)
      .order('payment_date', { ascending: false });

    if (!error && paymentsData) {
      const mapped = paymentsData.map(p => ({
        ...p,
        customer_name: p.invoices?.customers?.name || null,
        vendor_name: p.bills?.vendors?.name || null,
        document_number: p.invoices?.invoice_number || p.bills?.bill_number || null,
      }));
      setPayments(mapped);
    }
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getPaymentMethodBadge = (method: string) => {
    const styles: Record<string, string> = {
      cash: 'bg-green-100 text-green-700',
      check: 'bg-blue-100 text-blue-700',
      credit_card: 'bg-purple-100 text-purple-700',
      bank_transfer: 'bg-indigo-100 text-indigo-700',
      other: 'bg-gray-100 text-gray-700',
    };
    const labels: Record<string, string> = {
      cash: 'Cash',
      check: 'Check',
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
      other: 'Other',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[method] || styles.other}`}>
        {labels[method] || method}
      </span>
    );
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      payment.payment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.reference?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || payment.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totals = {
    received: payments.filter(p => p.type === 'received').reduce((sum, p) => sum + p.amount, 0),
    made: payments.filter(p => p.type === 'made').reduce((sum, p) => sum + p.amount, 0),
  };

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
          <h1 className="text-2xl font-bold text-corporate-dark">Payments</h1>
          <p className="text-corporate-gray mt-1">Record customer payments and bill payments</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/payments/receive" className="btn-primary flex items-center gap-2 justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Receive Payment
          </Link>
          <Link href="/dashboard/payments/pay" className="btn-secondary flex items-center gap-2 justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Pay Bill
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-primary-200" onClick={() => setTypeFilter('all')}>
          <p className="text-sm text-corporate-gray">Net Cash Flow</p>
          <p className={`text-2xl font-bold ${totals.received - totals.made >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totals.received - totals.made)}
          </p>
          <p className="text-xs text-corporate-gray">{payments.length} total transactions</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-green-200" onClick={() => setTypeFilter('received')}>
          <p className="text-sm text-corporate-gray">Payments Received</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.received)}</p>
          <p className="text-xs text-corporate-gray">{payments.filter(p => p.type === 'received').length} payments</p>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-red-200" onClick={() => setTypeFilter('made')}>
          <p className="text-sm text-corporate-gray">Payments Made</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.made)}</p>
          <p className="text-xs text-corporate-gray">{payments.filter(p => p.type === 'made').length} payments</p>
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
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="input-field w-auto"
          >
            <option value="all">All Payments</option>
            <option value="received">Received</option>
            <option value="made">Made</option>
          </select>
        </div>
      </div>

      {/* Payments table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment #</th>
                <th>Type</th>
                <th>Customer/Vendor</th>
                <th>For</th>
                <th>Date</th>
                <th>Method</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-corporate-gray">
                    {payments.length === 0 ? (
                      <div className="space-y-2">
                        <p>No payments recorded yet</p>
                        <div className="flex justify-center gap-4">
                          <Link href="/dashboard/payments/receive" className="text-primary-600 hover:underline">
                            Receive a payment
                          </Link>
                          <Link href="/dashboard/payments/pay" className="text-primary-600 hover:underline">
                            Pay a bill
                          </Link>
                        </div>
                      </div>
                    ) : (
                      'No payments found matching your search'
                    )}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-medium text-corporate-dark">{payment.payment_number}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        payment.type === 'received' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {payment.type === 'received' ? 'Received' : 'Made'}
                      </span>
                    </td>
                    <td className="text-corporate-slate">
                      {payment.type === 'received' ? payment.customer_name : payment.vendor_name}
                    </td>
                    <td>
                      {payment.document_number ? (
                        <Link
                          href={`/dashboard/${payment.type === 'received' ? 'invoices' : 'bills'}/${payment.invoice_id || payment.bill_id}`}
                          className="text-primary-600 hover:text-primary-700"
                        >
                          {payment.document_number}
                        </Link>
                      ) : (
                        <span className="text-corporate-gray">—</span>
                      )}
                    </td>
                    <td className="text-corporate-slate">{formatDate(payment.payment_date)}</td>
                    <td>{getPaymentMethodBadge(payment.payment_method)}</td>
                    <td className={`text-right font-semibold ${
                      payment.type === 'received' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {payment.type === 'received' ? '+' : '-'}{formatCurrency(payment.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
