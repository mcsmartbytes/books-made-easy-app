'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSession } from 'next-auth/react';

interface BillItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Bill {
  id: string;
  bill_number: string;
  vendor_id: string;
  status: string;
  bill_date: string;
  due_date: string;
  category: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  description: string;
  notes: string;
  vendors?: { id: string; name: string; email: string; company: string } | null;
  bill_items?: BillItem[];
}

interface Payment {
  id: string;
  payment_number: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string;
}

export default function BillDetailPage() {
  const params = useParams();
  const billId = params.id as string;
  const [bill, setBill] = useState<Bill | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBill();
  }, [billId]);

  const loadBill = async () => {
    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;

    const [billRes, paymentsRes] = await Promise.all([
      fetch(`/api/bills?id=${billId}&user_id=${userId}`).then(r => r.json()),
      fetch(`/api/payments?bill_id=${billId}&user_id=${userId}`).then(r => r.json()),
    ]);

    if (billRes.success) setBill(billRes.data);
    if (paymentsRes.success) setPayments(paymentsRes.data || []);
    setLoading(false);
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
      partial: 'bg-yellow-100 text-yellow-700',
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

  if (!bill) {
    return (
      <div className="text-center py-12">
        <p className="text-corporate-gray">Bill not found</p>
        <Link href="/dashboard/bills" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">
          Back to Bills
        </Link>
      </div>
    );
  }

  const balanceDue = bill.total - (bill.amount_paid || 0);
  const isPayable = bill.status === 'unpaid' || bill.status === 'overdue';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-corporate-gray mb-1">
          <Link href="/dashboard/bills" className="hover:text-primary-600">Bills</Link>
          <span>/</span>
          <span>{bill.bill_number}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-corporate-dark">{bill.bill_number}</h1>
            {getStatusBadge(bill.status)}
          </div>
          {isPayable && (
            <Link
              href={`/dashboard/payments/pay?bill=${bill.id}`}
              className="btn-primary flex items-center gap-2 justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Record Payment
            </Link>
          )}
        </div>
      </div>

      {/* Bill Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Vendor & Dates */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h3 className="text-lg font-medium text-corporate-dark mb-4">Bill Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-corporate-gray">Vendor</p>
                <p className="font-medium text-corporate-dark">{bill.vendors?.name || '-'}</p>
                {bill.vendors?.email && <p className="text-xs text-corporate-gray">{bill.vendors.email}</p>}
              </div>
              <div>
                <p className="text-sm text-corporate-gray">Bill Date</p>
                <p className="font-medium text-corporate-dark">{new Date(bill.bill_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-corporate-gray">Due Date</p>
                <p className={`font-medium ${bill.status === 'overdue' ? 'text-red-600' : 'text-corporate-dark'}`}>
                  {new Date(bill.due_date).toLocaleDateString()}
                </p>
              </div>
              {bill.category && (
                <div>
                  <p className="text-sm text-corporate-gray">Category</p>
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs text-corporate-slate">{bill.category}</span>
                </div>
              )}
              {bill.description && (
                <div className="col-span-2">
                  <p className="text-sm text-corporate-gray">Description</p>
                  <p className="text-corporate-dark">{bill.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          {bill.bill_items && bill.bill_items.length > 0 && (
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
                  {bill.bill_items.map((item) => (
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
                    <td className="text-right font-medium text-corporate-dark">{formatCurrency(bill.subtotal)}</td>
                  </tr>
                  {bill.tax_amount > 0 && (
                    <tr>
                      <td colSpan={3} className="text-right text-corporate-gray">Tax</td>
                      <td className="text-right text-corporate-slate">{formatCurrency(bill.tax_amount)}</td>
                    </tr>
                  )}
                  <tr className="border-t">
                    <td colSpan={3} className="text-right font-bold text-corporate-dark">Total</td>
                    <td className="text-right font-bold text-corporate-dark">{formatCurrency(bill.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Payment History */}
          <div className="card">
            <h3 className="text-lg font-medium text-corporate-dark mb-4">Payment History</h3>
            {payments.length === 0 ? (
              <p className="text-corporate-gray text-sm">No payments recorded for this bill.</p>
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
        </div>

        {/* Right: Summary */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-medium text-corporate-dark mb-4">Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-corporate-gray">Total</span>
                <span className="font-medium text-corporate-dark">{formatCurrency(bill.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-corporate-gray">Paid</span>
                <span className="font-medium text-green-600">{formatCurrency(bill.amount_paid || 0)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold text-corporate-dark">Balance Due</span>
                <span className={`text-xl font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>

            {isPayable && (
              <Link
                href={`/dashboard/payments/pay?bill=${bill.id}`}
                className="w-full btn-primary mt-4 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Pay {formatCurrency(balanceDue)}
              </Link>
            )}
          </div>

          {bill.notes && (
            <div className="card">
              <h3 className="text-lg font-medium text-corporate-dark mb-2">Notes</h3>
              <p className="text-corporate-slate text-sm whitespace-pre-wrap">{bill.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
