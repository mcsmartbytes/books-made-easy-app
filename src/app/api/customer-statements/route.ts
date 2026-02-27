import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/customer-statements?user_id=xxx&customer_id=xxx&start_date=xxx&end_date=xxx
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  const customerId = request.nextUrl.searchParams.get('customer_id');
  const startDate = request.nextUrl.searchParams.get('start_date');
  const endDate = request.nextUrl.searchParams.get('end_date');

  if (!userId || !customerId) {
    return NextResponse.json({ error: 'user_id and customer_id are required' }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 });
  }

  try {
    // Get customer info
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('user_id', userId)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get all invoices for this customer in date range (by issue_date)
    const { data: allInvoices } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .eq('user_id', userId)
      .order('issue_date', { ascending: true });

    const invoices = (allInvoices || []).filter((inv: Record<string, unknown>) => {
      const d = inv.issue_date as string;
      return d >= startDate && d <= endDate;
    });

    // Get invoices before start_date for opening balance calculation
    const priorInvoices = (allInvoices || []).filter((inv: Record<string, unknown>) => {
      const d = inv.issue_date as string;
      return d < startDate;
    });

    // Get all payments linked to this customer's invoices
    const allInvoiceIds = (allInvoices || []).map((inv: Record<string, unknown>) => inv.id as string);

    let allPayments: Record<string, unknown>[] = [];
    if (allInvoiceIds.length > 0) {
      // Fetch payments for these invoices
      const { data: paymentsData } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('type', 'received')
        .eq('user_id', userId)
        .order('payment_date', { ascending: true });

      allPayments = (paymentsData || []).filter((p: Record<string, unknown>) =>
        allInvoiceIds.includes(p.invoice_id as string)
      );
    }

    const paymentsInRange = allPayments.filter((p: Record<string, unknown>) => {
      const d = p.payment_date as string;
      return d >= startDate && d <= endDate;
    });

    const priorPayments = allPayments.filter((p: Record<string, unknown>) => {
      const d = p.payment_date as string;
      return d < startDate;
    });

    // Calculate opening balance (prior invoices total - prior payments total)
    const priorInvoiceTotal = priorInvoices.reduce((sum: number, inv: Record<string, unknown>) =>
      sum + ((inv.total as number) || 0), 0);
    const priorPaymentTotal = priorPayments.reduce((sum: number, p: Record<string, unknown>) =>
      sum + ((p.amount as number) || 0), 0);
    const openingBalance = Math.round((priorInvoiceTotal - priorPaymentTotal) * 100) / 100;

    // Calculate period totals
    const periodInvoiceTotal = invoices.reduce((sum: number, inv: Record<string, unknown>) =>
      sum + ((inv.total as number) || 0), 0);
    const periodPaymentTotal = paymentsInRange.reduce((sum: number, p: Record<string, unknown>) =>
      sum + ((p.amount as number) || 0), 0);
    const endingBalance = Math.round((openingBalance + periodInvoiceTotal - periodPaymentTotal) * 100) / 100;

    return NextResponse.json({
      success: true,
      data: {
        customer,
        start_date: startDate,
        end_date: endDate,
        opening_balance: openingBalance,
        invoices: invoices.map((inv: Record<string, unknown>) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          status: inv.status,
          total: inv.total,
        })),
        payments: paymentsInRange.map((p: Record<string, unknown>) => ({
          id: p.id,
          payment_number: p.payment_number,
          payment_date: p.payment_date,
          payment_method: p.payment_method,
          amount: p.amount,
          invoice_id: p.invoice_id,
        })),
        period_invoice_total: Math.round(periodInvoiceTotal * 100) / 100,
        period_payment_total: Math.round(periodPaymentTotal * 100) / 100,
        ending_balance: endingBalance,
      },
    });
  } catch (error) {
    console.error('Error generating customer statement:', error);
    return NextResponse.json({ error: 'Failed to generate customer statement' }, { status: 500 });
  }
}
