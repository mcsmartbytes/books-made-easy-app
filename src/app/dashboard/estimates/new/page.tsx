'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
}

interface ProductService {
  id: string;
  name: string;
  description: string;
  type: string;
  price: number;
}

interface LineItem {
  id: string;
  product_service_id: string | null;
  description: string;
  quantity: number;
  rate: number;
}

export default function NewEstimatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<ProductService[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [productSearches, setProductSearches] = useState<Record<string, string>>({});
  const [activeProductDropdown, setActiveProductDropdown] = useState<string | null>(null);
  const customerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    estimate_number: `EST-${String(Date.now()).slice(-4)}`,
    issue_date: new Date().toISOString().split('T')[0],
    expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    terms: 'This estimate is valid for 30 days from the issue date.',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', product_service_id: null, description: '', quantity: 1, rate: 0 },
  ]);

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

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: customersData } = await supabase
      .from('customers')
      .select('id, name, email, company')
      .eq('user_id', session.user.id)
      .order('name');

    setCustomers(customersData || []);

    const { data: productsData } = await supabase
      .from('products_services')
      .select('id, name, description, type, price')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('name');

    setProducts(productsData || []);

    const customerId = searchParams.get('customer');
    if (customerId && customersData) {
      const customer = customersData.find((c: Customer) => c.id === customerId);
      if (customer) {
        setSelectedCustomer(customer);
        setCustomerSearch(customer.name);
      }
    }
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const selectProduct = (itemId: string, product: ProductService) => {
    setLineItems(lineItems.map(item =>
      item.id === itemId
        ? { ...item, product_service_id: product.id, description: product.name, rate: product.price }
        : item
    ));
    setActiveProductDropdown(null);
    setProductSearches({ ...productSearches, [itemId]: '' });
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.company?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const getFilteredProducts = (itemId: string) => {
    const search = productSearches[itemId] || '';
    return products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
    );
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: String(Date.now()), product_service_id: null, description: '', quantity: 1, rate: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number | null) => {
    setLineItems(lineItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const tax = subtotal * 0;
  const total = subtotal + tax;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent, status: 'draft' | 'sent') => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('Please select a customer');
      return;
    }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: estimate, error } = await supabase
      .from('estimates')
      .insert({
        user_id: session.user.id,
        customer_id: selectedCustomer.id,
        estimate_number: formData.estimate_number,
        status,
        issue_date: formData.issue_date,
        expiry_date: formData.expiry_date,
        subtotal,
        tax_amount: tax,
        total,
        notes: formData.notes,
        terms: formData.terms,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating estimate:', error);
      alert('Error creating estimate: ' + error.message);
      setLoading(false);
      return;
    }

    const items = lineItems.filter(i => i.description).map((item, index) => ({
      estimate_id: estimate.id,
      product_service_id: item.product_service_id,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate,
      sort_order: index,
    }));

    if (items.length > 0) {
      await supabase.from('estimate_items').insert(items);
    }

    router.push('/dashboard/estimates');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">New Estimate</h1>
          <p className="text-corporate-gray mt-1">Create a quote for your customer</p>
        </div>
        <Link href="/dashboard/estimates" className="btn-secondary">Cancel</Link>
      </div>

      <form onSubmit={(e) => handleSubmit(e, 'draft')}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">
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
                      if (!e.target.value) setSelectedCustomer(null);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="input-field pr-10"
                    placeholder="Search customers..."
                  />
                  <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-corporate-gray">
                        <p>No customers found</p>
                        <Link href="/dashboard/customers" className="text-primary-600 hover:underline text-sm">+ Add a customer</Link>
                      </div>
                    ) : (
                      filteredCustomers.map(customer => (
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
                            <p className="text-sm text-corporate-gray truncate">{customer.company || customer.email}</p>
                          </div>
                        </button>
                      ))
                    )}
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
                      onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
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

            {/* Line Items */}
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Line Items</h2>
              <div className="space-y-4">
                <div className="hidden sm:grid sm:grid-cols-12 gap-4 text-xs font-semibold text-corporate-gray uppercase">
                  <div className="col-span-6">Product/Service</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Rate</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>

                {lineItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-4 items-start">
                    <div className="col-span-12 sm:col-span-6 relative">
                      <div className="relative">
                        <input
                          type="text"
                          value={activeProductDropdown === item.id ? (productSearches[item.id] || '') : item.description}
                          onChange={(e) => {
                            setProductSearches({ ...productSearches, [item.id]: e.target.value });
                            updateLineItem(item.id, 'description', e.target.value);
                            setActiveProductDropdown(item.id);
                          }}
                          onFocus={() => setActiveProductDropdown(item.id)}
                          className="input-field"
                          placeholder="Search or type description..."
                        />
                      </div>
                      {activeProductDropdown === item.id && products.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                          {getFilteredProducts(item.id).map(product => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => selectProduct(item.id, product)}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                            >
                              <div>
                                <p className="font-medium text-corporate-dark">{product.name}</p>
                                <p className="text-xs text-corporate-gray">{product.type}</p>
                              </div>
                              <span className="text-corporate-slate font-medium">{formatCurrency(product.price)}</span>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setActiveProductDropdown(null)}
                            className="w-full px-4 py-2 text-left text-sm text-corporate-gray hover:bg-gray-50 border-t"
                          >
                            Use custom description
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="input-field"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                        className="input-field"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2">
                      <span className="font-medium text-corporate-dark">{formatCurrency(item.quantity * item.rate)}</span>
                      {lineItems.length > 1 && (
                        <button type="button" onClick={() => removeLineItem(item.id)} className="p-1 text-corporate-gray hover:text-red-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button type="button" onClick={addLineItem} className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Line Item
                </button>
              </div>
            </div>

            {/* Notes & Terms */}
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Notes & Terms</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Notes (visible to customer)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input-field"
                    rows={2}
                    placeholder="Additional notes for the customer..."
                  />
                </div>
                <div>
                  <label className="label">Terms & Conditions</label>
                  <textarea
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    className="input-field"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-corporate-dark mb-4">Estimate Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Estimate Number</label>
                  <input type="text" value={formData.estimate_number} onChange={(e) => setFormData({ ...formData, estimate_number: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label">Issue Date</label>
                  <input type="date" value={formData.issue_date} onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label">Expiry Date</label>
                  <input type="date" value={formData.expiry_date} onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} className="input-field" />
                </div>
              </div>
            </div>

            <div className="card bg-corporate-light">
              <div className="space-y-3">
                <div className="flex justify-between text-corporate-slate">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-corporate-slate">
                  <span>Tax (0%)</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="border-t border-gray-300 pt-3 flex justify-between text-lg font-bold text-corporate-dark">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={(e) => handleSubmit(e as unknown as React.FormEvent, 'sent')}
                disabled={loading || !selectedCustomer}
                className="w-full btn-primary disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create & Send Estimate'}
              </button>
              <button type="submit" disabled={loading || !selectedCustomer} className="w-full btn-secondary disabled:opacity-50">
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
