import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

// GET /api/dashboard - Get dashboard stats
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    // Fetch all data in parallel
    const [
      customersResult,
      vendorsResult,
      invoicesResult,
      billsResult,
      paymentsReceivedResult,
      paymentsMadeResult,
    ] = await Promise.all([
      supabaseAdmin.from('customers').select('id', { count: 'exact' }).eq('user_id', userId).eq('is_active', true),
      supabaseAdmin.from('vendors').select('id', { count: 'exact' }).eq('user_id', userId).eq('is_active', true),
      supabaseAdmin.from('invoices').select('*').eq('user_id', userId),
      supabaseAdmin.from('bills').select('*').eq('user_id', userId),
      supabaseAdmin.from('payments_received').select('amount, payment_date').eq('user_id', userId),
      supabaseAdmin.from('payments_made').select('amount, payment_date').eq('user_id', userId),
    ]);

    const invoices = invoicesResult.data || [];
    const bills = billsResult.data || [];
    const paymentsReceived = paymentsReceivedResult.data || [];
    const paymentsMade = paymentsMadeResult.data || [];

    // Calculate stats
    const totalRevenue = invoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + Number(i.total || 0), 0);

    const outstandingReceivables = invoices
      .filter(i => ['sent', 'overdue'].includes(i.status))
      .reduce((sum, i) => sum + (Number(i.total || 0) - Number(i.amount_paid || 0)), 0);

    const outstandingPayables = bills
      .filter(b => ['unpaid', 'overdue'].includes(b.status))
      .reduce((sum, b) => sum + (Number(b.total || 0) - Number(b.amount_paid || 0)), 0);

    const invoicesDue = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).length;
    const billsDue = bills.filter(b => ['unpaid', 'overdue'].includes(b.status)).length;

    // This month stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const thisMonthRevenue = paymentsReceived
      .filter(p => p.payment_date >= startOfMonth)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const thisMonthExpenses = paymentsMade
      .filter(p => p.payment_date >= startOfMonth)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Recent activity (last 10 items)
    const recentInvoices = invoices
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(i => ({
        id: i.id,
        type: 'invoice' as const,
        description: `Invoice #${i.invoice_number} - ${i.status}`,
        amount: i.total,
        date: i.created_at,
      }));

    const recentBills = bills
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(b => ({
        id: b.id,
        type: 'bill' as const,
        description: `Bill ${b.bill_number || ''} - ${b.status}`,
        amount: b.total,
        date: b.created_at,
      }));

    const recentActivity = [...recentInvoices, ...recentBills]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    // Overdue items
    const today = new Date().toISOString().split('T')[0];
    const overdueInvoices = invoices.filter(i => i.status === 'sent' && i.due_date < today).length;
    const overdueBills = bills.filter(b => b.status === 'unpaid' && b.due_date < today).length;

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalRevenue,
          outstandingReceivables,
          outstandingPayables,
          customersCount: customersResult.count || 0,
          vendorsCount: vendorsResult.count || 0,
          invoicesDue,
          billsDue,
          thisMonthRevenue,
          thisMonthExpenses,
          thisMonthProfit: thisMonthRevenue - thisMonthExpenses,
          overdueInvoices,
          overdueBills,
        },
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
