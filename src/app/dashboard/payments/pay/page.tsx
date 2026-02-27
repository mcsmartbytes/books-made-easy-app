'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSession } from 'next-auth/react';

interface Vendor {
  id: string;
  name: string;
  email: string;
}

interface Bill {
  id: string;
  bill_number: string;
  vendor_id: string;
  total: number;
  amount_paid: number;
  status: string;
  due_date: string;
  vendors?: { id: string; name: string; email: string } | null;
}

export default function PayBillPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [error, setError] = useState('');
  const vendorRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
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
      if (vendorRef.current && !vendorRef.current.contains(e.target as Node)) {
        setShowVendorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedVendor) {
      loadVendorBills(selectedVendor.id);
    } else {
      setBills([]);
      setSelectedBill(null);
    }
  }, [selectedVendor]);

  const loadData = async () => {
    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;

    const res = await fetch(`/api/vendors?user_id=${userId}`);
    const result = await res.json();
    if (result.success) {
      setVendors(result.data || []);
    }

    // Check for pre-selected bill
    const billId = searchParams.get('bill');
    if (billId) {
      const billRes = await fetch(`/api/bills?id=${billId}&user_id=${userId}`);
      const billResult = await billRes.json();

      if (billResult.success && billResult.data) {
        const bill = billResult.data;
        if (bill.vendors) {
          setSelectedVendor(bill.vendors);
          setVendorSearch(bill.vendors.name);
          setSelectedBill(bill);
          setFormData(prev => ({
            ...prev,
            amount: bill.total - (bill.amount_paid || 0),
          }));
        }
      }
    }

    setDataLoading(false);
  };

  const loadVendorBills = async (vendorId: string) => {
    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;

    const res = await fetch(`/api/bills?user_id=${userId}&vendor_id=${vendorId}`);
    const result = await res.json();
    if (result.success) {
      // Only show unpaid/overdue bills (excludes paid and draft)
      const unpaid = (result.data || []).filter(
        (b: Bill) => b.status === 'unpaid' || b.status === 'overdue'
      );
      setBills(unpaid);
    }
  };

  const selectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setVendorSearch(vendor.name);
    setShowVendorDropdown(false);
    setSelectedBill(null);
    setFormData(prev => ({ ...prev, amount: 0 }));
  };

  const selectBill = (bill: Bill) => {
    setSelectedBill(bill);
    const balance = bill.total - (bill.amount_paid || 0);
    setFormData(prev => ({ ...prev, amount: balance }));
  };

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.email?.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor || formData.amount <= 0) {
      setError('Please select a vendor and enter a valid amount.');
      return;
    }
    setLoading(true);
    setError('');

    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;

    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        type: 'made',
        bill_id: selectedBill?.id || null,
        amount: formData.amount,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        reference: formData.reference || null,
        notes: formData.notes || null,
      }),
    });

    const result = await res.json();
    if (result.success) {
      router.push('/dashboard/payments');
    } else {
      setError(result.error || 'Failed to record payment');
    }
    setLoading(false);
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-corporate-gray mb-1">
            <Link href="/dashboard/payments" className="hover:text-primary-600">Payments</Link>
            <span>/</span>
            <span>Pay Bill</span>
          </div>
          <h1 className="text-2xl font-bold text-corporate-dark">Pay Bill</h1>
          <p className="text-corporate-gray mt-1">Record a payment to a vendor</p>
        </div>
        <Link href="/dashboard/payments" className="px-4 py-2 border border-gray-300 rounded-lg text-corporate-slate hover:bg-gray-50">Cancel</Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vendor Selection */}
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-4">Vendor</h2>
          <div ref={vendorRef} className="relative">
            <label className="block text-sm font-medium text-corporate-dark mb-1">Select Vendor *</label>
            <div className="relative">
              <input
                type="text"
                value={vendorSearch}
                onChange={(e) => {
                  setVendorSearch(e.target.value);
                  setShowVendorDropdown(true);
                  if (!e.target.value) {
                    setSelectedVendor(null);
                    setSelectedBill(null);
                  }
                }}
                onFocus={() => setShowVendorDropdown(true)}
                className="input-field pr-10"
                placeholder="Search vendors..."
              />
              <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {showVendorDropdown && filteredVendors.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {filteredVendors.map(vendor => (
                  <button
                    key={vendor.id}
                    type="button"
                    onClick={() => selectVendor(vendor)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 ${selectedVendor?.id === vendor.id ? 'bg-primary-50' : ''}`}
                  >
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-orange-600 font-semibold">{vendor.name.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-corporate-dark truncate">{vendor.name}</p>
                      <p className="text-sm text-corporate-gray truncate">{vendor.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedVendor && (
              <div className="mt-3 p-3 bg-orange-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 font-semibold">{selectedVendor.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-medium text-corporate-dark">{selectedVendor.name}</p>
                    <p className="text-sm text-corporate-gray">{selectedVendor.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedVendor(null); setVendorSearch(''); setSelectedBill(null); }}
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

        {/* Bill Selection */}
        {selectedVendor && (
          <div className="card">
            <h2 className="text-lg font-semibold text-corporate-dark mb-4">Apply to Bill (Optional)</h2>
            {bills.length === 0 ? (
              <p className="text-corporate-gray text-sm">No outstanding bills for this vendor</p>
            ) : (
              <div className="space-y-2">
                {bills.map(bill => {
                  const balance = bill.total - (bill.amount_paid || 0);
                  const isOverdue = new Date(bill.due_date) < new Date();
                  return (
                    <button
                      key={bill.id}
                      type="button"
                      onClick={() => selectBill(bill)}
                      className={`w-full p-4 border rounded-lg text-left transition-all ${
                        selectedBill?.id === bill.id
                          ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200'
                          : 'border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-corporate-dark">{bill.bill_number}</p>
                            {isOverdue && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Overdue</span>
                            )}
                          </div>
                          <p className="text-sm text-corporate-gray">
                            Due: {new Date(bill.due_date).toLocaleDateString()}
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
                {selectedBill && (
                  <button
                    type="button"
                    onClick={() => { setSelectedBill(null); setFormData(prev => ({ ...prev, amount: 0 })); }}
                    className="text-sm text-orange-600 hover:text-orange-700"
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
              <label className="block text-sm font-medium text-corporate-dark mb-1">Payment Date *</label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-corporate-dark mb-1">Amount *</label>
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
              <label className="block text-sm font-medium text-corporate-dark mb-1">Payment Method</label>
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
            <div>
              <label className="block text-sm font-medium text-corporate-dark mb-1">Reference #</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="input-field"
                placeholder="e.g., Check #1234"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-corporate-dark mb-1">Notes</label>
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
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold text-corporate-dark">Payment Amount</span>
            <span className="text-2xl font-bold text-red-600">{formatCurrency(formData.amount)}</span>
          </div>
          {selectedBill && (
            <p className="text-sm text-corporate-gray mb-4">
              Applying to {selectedBill.bill_number}.
              {formData.amount >= (selectedBill.total - (selectedBill.amount_paid || 0))
                ? ' This will mark the bill as paid.'
                : ' This will be recorded as a partial payment.'}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !selectedVendor || formData.amount <= 0}
            className="w-full btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
