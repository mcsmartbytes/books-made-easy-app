'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Vendor {
  id: string;
  name: string;
  email: string;
  company: string;
  tax_id?: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  category_id: string;
}

export default function NewBillPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Vendors
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const vendorRef = useRef<HTMLDivElement>(null);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, rate: 0, amount: 0, category_id: '' }
  ]);

  // Bill details
  const [formData, setFormData] = useState({
    bill_number: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    loadData();

    // Handle click outside for vendor dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (vendorRef.current && !vendorRef.current.contains(event.target as Node)) {
        setShowVendorDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    // Load vendors
    const { data: vendorData } = await supabase
      .from('vendors')
      .select('id, name, email, company, tax_id')
      .eq('user_id', session.user.id)
      .order('name');

    if (vendorData) setVendors(vendorData);

    // Load expense categories
    const { data: categoryData } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', session.user.id)
      .eq('type', 'expense')
      .order('name');

    if (categoryData) setCategories(categoryData);

    // Check if vendor is pre-selected from URL
    const vendorId = searchParams.get('vendor');
    if (vendorId && vendorData) {
      const vendor = vendorData.find((v: Vendor) => v.id === vendorId);
      if (vendor) {
        setSelectedVendor(vendor);
        setVendorSearch(vendor.name);
      }
    }

    setPageLoading(false);
  };

  const selectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setVendorSearch(vendor.name);
    setShowVendorDropdown(false);
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    vendor.email.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    (vendor.company && vendor.company.toLowerCase().includes(vendorSearch.toLowerCase()))
  );

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: String(Date.now()), description: '', quantity: 1, rate: 0, amount: 0, category_id: '' }
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updated.amount = updated.quantity * updated.rate;
        }
        return updated;
      }
      return item;
    }));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  const handleSubmit = async (e: React.FormEvent, status: 'draft' | 'unpaid') => {
    e.preventDefault();
    if (!selectedVendor) {
      alert('Please select a vendor');
      return;
    }

    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      // Generate bill number if not provided
      const billNumber = formData.bill_number || `BILL-${Date.now().toString().slice(-6)}`;

      // Create the bill
      const { data: billData, error: billError } = await supabase
        .from('bills')
        .insert({
          user_id: session.user.id,
          vendor_id: selectedVendor.id,
          bill_number: billNumber,
          bill_date: formData.bill_date,
          due_date: formData.due_date,
          subtotal: subtotal,
          total: subtotal,
          status: status,
          notes: formData.notes,
          category: lineItems[0]?.category_id ? categories.find(c => c.id === lineItems[0].category_id)?.name : null,
        })
        .select()
        .single();

      if (billError) throw billError;
      if (!billData) throw new Error('Failed to create bill');
      const bill = billData as any;

      // Create bill items
      const billItems = lineItems
        .filter(item => item.description.trim())
        .map(item => ({
          bill_id: bill.id,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          category_id: item.category_id || null,
        }));

      if (billItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('bill_items')
          .insert(billItems);

        if (itemsError) console.error('Error creating bill items:', itemsError);
      }

      router.push('/dashboard/bills');
    } catch (error) {
      console.error('Error creating bill:', error);
      alert('Error creating bill. Please try again.');
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">New Bill</h1>
          <p className="text-corporate-gray mt-1">Record a bill from a vendor</p>
        </div>
        <Link href="/dashboard/bills" className="btn-secondary">
          Cancel
        </Link>
      </div>

      <form onSubmit={(e) => handleSubmit(e, 'unpaid')} className="space-y-6">
        {/* Vendor Selection */}
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-4">Vendor</h2>
          <div className="relative" ref={vendorRef}>
            <div className="flex items-center gap-3">
              {selectedVendor && (
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-600 font-semibold">{selectedVendor.name.charAt(0)}</span>
                </div>
              )}
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={vendorSearch}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setShowVendorDropdown(true);
                    if (!e.target.value) setSelectedVendor(null);
                  }}
                  onFocus={() => setShowVendorDropdown(true)}
                  placeholder="Search vendors by name, email, or company..."
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Vendor dropdown */}
            {showVendorDropdown && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                {filteredVendors.length === 0 ? (
                  <div className="p-4 text-center text-corporate-gray">
                    <p>No vendors found</p>
                    <Link href="/dashboard/vendors" className="text-primary-600 hover:underline text-sm mt-2 block">
                      + Add a new vendor
                    </Link>
                  </div>
                ) : (
                  filteredVendors.map(vendor => (
                    <button
                      key={vendor.id}
                      type="button"
                      onClick={() => selectVendor(vendor)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                    >
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-orange-600 font-semibold text-sm">{vendor.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-corporate-dark truncate">{vendor.name}</p>
                        <p className="text-sm text-corporate-gray truncate">{vendor.email}</p>
                      </div>
                      {vendor.tax_id && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">1099</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedVendor && (
            <div className="mt-3 p-3 bg-orange-50 rounded-lg">
              <p className="text-sm text-corporate-slate">
                {selectedVendor.company && <span>{selectedVendor.company} • </span>}
                {selectedVendor.email}
                {selectedVendor.tax_id && <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">Tax ID: {selectedVendor.tax_id}</span>}
              </p>
            </div>
          )}
        </div>

        {/* Bill Details */}
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-4">Bill Details</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Bill Number</label>
              <input
                type="text"
                value={formData.bill_number}
                onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                className="input-field"
                placeholder="Auto-generated"
              />
            </div>
            <div>
              <label className="label">Bill Date *</label>
              <input
                type="date"
                required
                value={formData.bill_date}
                onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-4">Line Items</h2>
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-corporate-gray px-2">
              <div className="col-span-4">Description</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-1 text-right">Amount</div>
              <div className="col-span-1"></div>
            </div>

            {lineItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                    placeholder={`Item ${index + 1}`}
                    className="input-field"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={item.category_id}
                    onChange={(e) => updateLineItem(item.id, 'category_id', e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="">Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="input-field text-center"
                  />
                </div>
                <div className="col-span-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-corporate-gray">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                      className="input-field pl-7 text-right"
                    />
                  </div>
                </div>
                <div className="col-span-1 text-right font-medium text-corporate-dark">
                  ${item.amount.toFixed(2)}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => removeLineItem(item.id)}
                    className="p-1.5 text-corporate-gray hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    disabled={lineItems.length === 1}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium mt-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Line Item
            </button>
          </div>

          {/* Totals */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-corporate-slate">
                  <span>Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-corporate-dark">
                  <span>Total</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <label className="label">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="input-field"
            rows={3}
            placeholder="Any additional notes about this bill..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent, 'draft')}
            disabled={loading}
            className="flex-1 btn-secondary disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="submit"
            disabled={loading || !selectedVendor || subtotal === 0}
            className="flex-1 btn-primary disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Bill'}
          </button>
        </div>
      </form>
    </div>
  );
}
