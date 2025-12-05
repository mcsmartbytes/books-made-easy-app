'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  total: number;
  amount_paid: number;
  status: string;
  due_date: string;
}

export default function ReceivePaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    payment_number: `PMT-${String(Date.now()).slice(-6)}`,
    payment_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'bank_transfer',
    reference: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerInvoices(selectedCustomer.id);
    } else {
      setInvoices([]);
      setSelectedInvoice(null);
    }
  }, [selectedCustomer]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: customersData } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('user_id', session.user.id)
      .order('name');

    setCustomers(customersData || []);

    // Check for pre-selected invoice
    const invoiceId = searchParams.get('invoice');
    if (invoiceId) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select(`*, customers (id, name, email)`)
        .eq('id', invoiceId)
        .single();

      if (invoice && invoice.customers) {
        setSelectedCustomer(invoice.customers);
        setCustomerSearch(invoice.customers.name);
        setSelectedInvoice(invoice);
        setFormData(prev => ({
          ...prev,
          amount: invoice.total - (invoice.amount_paid || 0)
        }));
      }
    }
  };

  const loadCustomerInvoices = async (customerId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('customer_id', customerId)
      .in('status', ['sent', 'overdue', 'partial'])
      .order('due_date');

    setInvoices(invoicesData || []);
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
    setSelectedInvoice(null);
    setFormData(prev => ({ ...prev, amount: 0 }));
  };

  const selectInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const balance = invoice.total - (invoice.amount_paid || 0);
    setFormData(prev => ({ ...prev, amount: balance }));
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || formData.amount <= 0) {
      alert('Please select a customer and enter a valid amount');
      return;
    }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: session.user.id,
        payment_number: formData.payment_number,
        type: 'received',
        invoice_id: selectedInvoice?.id || null,
        amount: formData.amount,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        reference: formData.reference,
        notes: formData.notes,
      });

    if (paymentError) {
      console.error('Error creating payment:', paymentError);
      alert('Error creating payment: ' + paymentError.message);
      setLoading(false);
      return;
    }

    // Update invoice if one was selected
    if (selectedInvoice) {
      const newAmountPaid = (selectedInvoice.amount_paid || 0) + formData.amount;
      const newStatus = newAmountPaid >= selectedInvoice.total ? 'paid' : 'partial';

      await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq('id', selectedInvoice.id);
    }

    router.push('/dashboard/payments');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">Receive Payment</h1>
          <p className="text-corporate-gray mt-1">Record a payment from a customer</p>
        </div>
        <Link href="/dashboard/payments" className="btn-secondary">Cancel</Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-4">Customer</h2>
          <div ref={customerRef} className="relative">
            <label className="label">Select Customer *</label>
            <div className="relative">
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                  if (!e.target.value) {
                    setSelectedCustomer(null);
                    setSelectedInvoice(null);
                  }
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                className="input-field pr-10"
                placeholder="Search customers..."
              />
              <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {showCustomerDropdown && filteredCustomers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {filteredCustomers.map(customer => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => selectCustomer(customer)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 ${selectedCustomer?.id === customer.id ? 'bg-primary-50' : ''}`}
                  >
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-600 font-semibold">{customer.name.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-corporate-dark truncate">{customer.name}</p>
                      <p className="text-sm text-corporate-gray truncate">{customer.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedCustomer && (
              <div className="mt-3 p-3 bg-primary-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-semibold">{selectedCustomer.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-medium text-corporate-dark">{selectedCustomer.name}</p>
                    <p className="text-sm text-corporate-gray">{selectedCustomer.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setSelectedInvoice(null); }}
                  className="text-corporate-gray hover:text-red-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Selection */}
        {selectedCustomer && (
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-4">Apply to Invoice (Optional)</h2>
            {invoices.length === 0 ? (
              <p className="text-corporate-gray text-sm">No outstanding invoices for this customer</p>
            ) : (
              <div className="space-y-2">
                {invoices.map(invoice => {
                  const balance = invoice.total - (invoice.amount_paid || 0);
                  return (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => selectInvoice(invoice)}
                      className={`w-full p-4 border rounded-lg text-left transition-all ${
                        selectedInvoice?.id === invoice.id
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                          : 'border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-corporate-dark">{invoice.invoice_number}</p>
                          <p className="text-sm text-corporate-gray">
                            Due: {new Date(invoice.due_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-corporate-dark">{formatCurrency(balance)}</p>
                          <p className="text-xs text-corporate-gray">Balance due</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {selectedInvoice && (
                  <button
                    type="button"
                    onClick={() => { setSelectedInvoice(null); setFormData(prev => ({ ...prev, amount: 0 })); }}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Clear selection (unapplied payment)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Payment Details */}
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-4">Payment Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Payment Number</label>
              <input
                type="text"
                value={formData.payment_number}
                onChange={(e) => setFormData({ ...formData, payment_number: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Payment Date *</label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Amount *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="input-field"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="input-field"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="credit_card">Credit Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Reference # (check number, transaction ID, etc.)</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="input-field"
                placeholder="e.g., Check #1234 or ACH-98765"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field"
                rows={2}
                placeholder="Internal notes about this payment..."
              />
            </div>
          </div>
        </div>

        {/* Summary & Submit */}
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold text-corporate-dark">Payment Amount</span>
            <span className="text-2xl font-bold text-green-600">{formatCurrency(formData.amount)}</span>
          </div>
          {selectedInvoice && (
            <p className="text-sm text-corporate-gray mb-4">
              Applying to {selectedInvoice.invoice_number}.
              {formData.amount >= (selectedInvoice.total - (selectedInvoice.amount_paid || 0))
                ? ' This will mark the invoice as paid.'
                : ' This will be recorded as a partial payment.'}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !selectedCustomer || formData.amount <= 0}
            className="w-full btn-primary bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
