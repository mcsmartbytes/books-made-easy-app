'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  tax_id: string;
  notes: string;
  balance: number;
  created_at: string;
}

interface Bill {
  id: string;
  bill_number: string;
  status: string;
  bill_date: string;
  due_date: string;
  total: number;
  category: string;
}

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Vendor>>({});

  useEffect(() => {
    loadVendor();
  }, [params.id]);

  const loadVendor = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: vendorData, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !vendorData) {
      router.push('/dashboard/vendors');
      return;
    }

    setVendor(vendorData);
    setFormData(vendorData);

    const { data: billsData } = await supabase
      .from('bills')
      .select('*')
      .eq('vendor_id', params.id)
      .order('bill_date', { ascending: false });

    setBills(billsData || []);
    setLoading(false);
  };

  const handleSave = async () => {
    const { error } = await supabase
      .from('vendors')
      .update(formData)
      .eq('id', params.id);

    if (!error) {
      setVendor({ ...vendor, ...formData } as Vendor);
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this vendor? This cannot be undone.')) return;

    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', params.id);

    if (!error) {
      router.push('/dashboard/vendors');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      unpaid: 'bg-orange-100 text-orange-700',
      paid: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
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

  if (!vendor) return null;

  const totalBilled = bills.reduce((sum, b) => sum + (b.total || 0), 0);
  const totalPaid = bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.total || 0), 0);
  const outstanding = bills.filter(b => b.status !== 'paid' && b.status !== 'draft').reduce((sum, b) => sum + (b.total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/vendors" className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 font-bold text-xl">{vendor.name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-corporate-dark">{vendor.name}</h1>
              <p className="text-corporate-gray">{vendor.company || vendor.email}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/bills/new?vendor=${vendor.id}`}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Bill
          </Link>
          <button onClick={() => setEditing(!editing)} className="btn-secondary">
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Billed</p>
          <p className="text-xl font-bold text-corporate-dark">{formatCurrency(totalBilled)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Total Paid</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Outstanding</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(outstanding)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-corporate-gray">Bills</p>
          <p className="text-xl font-bold text-corporate-dark">{bills.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendor Details */}
        <div className="card">
          <h2 className="text-lg font-semibold text-corporate-dark mb-4">Vendor Information</h2>
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
                <label className="label">Tax ID</label>
                <input
                  type="text"
                  value={formData.tax_id || ''}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  className="input-field"
                  placeholder="For 1099 reporting"
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
                <input type="text" placeholder="City" value={formData.city || ''} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="input-field" />
                <input type="text" placeholder="State" value={formData.state || ''} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="input-field" />
                <input type="text" placeholder="ZIP" value={formData.zip || ''} onChange={(e) => setFormData({ ...formData, zip: e.target.value })} className="input-field" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} className="btn-primary flex-1">Save</button>
                <button onClick={handleDelete} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">Delete</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {vendor.email && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${vendor.email}`} className="text-primary-600 hover:underline">{vendor.email}</a>
                </div>
              )}
              {vendor.phone && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-corporate-slate">{vendor.phone}</span>
                </div>
              )}
              {vendor.tax_id && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-corporate-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-corporate-slate">Tax ID: {vendor.tax_id}</span>
                </div>
              )}
              {(vendor.address || vendor.city) && (
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-corporate-gray mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <div className="text-corporate-slate">
                    {vendor.address && <p>{vendor.address}</p>}
                    <p>{[vendor.city, vendor.state, vendor.zip].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
              )}
              <div className="pt-2 text-xs text-corporate-gray">
                Vendor since {new Date(vendor.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            </div>
          )}
        </div>

        {/* Bill History */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-corporate-dark">Bill History</h2>
            <Link href={`/dashboard/bills/new?vendor=${vendor.id}`} className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              + New Bill
            </Link>
          </div>
          {bills.length === 0 ? (
            <p className="text-corporate-gray text-center py-8">No bills yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill.id}>
                      <td>
                        <Link href={`/dashboard/bills/${bill.id}`} className="text-primary-600 hover:underline font-medium">
                          {bill.bill_number || `BILL-${bill.id.slice(0, 6)}`}
                        </Link>
                      </td>
                      <td className="text-corporate-slate">{new Date(bill.bill_date).toLocaleDateString()}</td>
                      <td><span className="px-2 py-1 bg-gray-100 rounded text-xs">{bill.category || 'Uncategorized'}</span></td>
                      <td>{getStatusBadge(bill.status)}</td>
                      <td className="text-right font-semibold">{formatCurrency(bill.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
