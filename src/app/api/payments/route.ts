import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/payments - List payments
// GET /api/payments?id=xxx - Get single payment
// Filters: type (received|made), bill_id, invoice_id
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const paymentId = searchParams.get('id');
  const type = searchParams.get('type');
  const billId = searchParams.get('bill_id');
  const invoiceId = searchParams.get('invoice_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (paymentId) {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*, invoices(id, invoice_number), bills(id, bill_number)')
        .eq('id', paymentId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin
      .from('payments')
      .select('*, invoices(id, invoice_number), bills(id, bill_number)')
      .eq('user_id', userId);

    if (type) query = query.eq('type', type);
    if (billId) query = query.eq('bill_id', billId);
    if (invoiceId) query = query.eq('invoice_id', invoiceId);

    const { data, error } = await query.order('payment_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST /api/payments - Create payment
// Records payment and updates related bill/invoice status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id, payment_number, type, bill_id, invoice_id,
      amount, payment_date, payment_method, reference, notes,
    } = body;

    if (!user_id || !amount || !payment_date || !payment_method || !type) {
      return NextResponse.json(
        { error: 'user_id, amount, payment_date, payment_method, and type are required' },
        { status: 400 },
      );
    }

    // Generate payment number if not provided
    let finalPaymentNumber = payment_number;
    if (!finalPaymentNumber) {
      const { data: countData } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('user_id', user_id);
      const count = (countData || []).length + 1;
      finalPaymentNumber = `PMT-${String(count).padStart(4, '0')}`;
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id,
        payment_number: finalPaymentNumber,
        type,
        bill_id: bill_id || null,
        invoice_id: invoice_id || null,
        amount,
        payment_date,
        payment_method,
        reference: reference || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Update bill status if paying a bill
    if (bill_id && type === 'made') {
      const { data: bill } = await supabaseAdmin
        .from('bills')
        .select('total, amount_paid')
        .eq('id', bill_id)
        .eq('user_id', user_id)
        .single();

      if (bill) {
        const billData = bill as { total: number; amount_paid: number };
        const newAmountPaid = (billData.amount_paid || 0) + amount;
        // Only transition to 'paid' when fully paid; keep 'unpaid' for partial
        const newStatus = newAmountPaid >= billData.total ? 'paid' : 'unpaid';

        await supabaseAdmin
          .from('bills')
          .update({ amount_paid: newAmountPaid, status: newStatus })
          .eq('id', bill_id)
          .eq('user_id', user_id);
      }
    }

    // Update invoice status if receiving payment
    if (invoice_id && type === 'received') {
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('total, amount_paid')
        .eq('id', invoice_id)
        .eq('user_id', user_id)
        .single();

      if (invoice) {
        const invoiceData = invoice as { total: number; amount_paid: number };
        const newAmountPaid = (invoiceData.amount_paid || 0) + amount;
        // Only transition to 'paid' when fully paid; keep current status for partial
        const newStatus = newAmountPaid >= invoiceData.total ? 'paid' : 'sent';

        await supabaseAdmin
          .from('invoices')
          .update({ amount_paid: newAmountPaid, status: newStatus })
          .eq('id', invoice_id)
          .eq('user_id', user_id);
      }
    }

    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

// DELETE /api/payments?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    // Get payment details before deleting (to reverse bill/invoice update)
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const pmt = payment as { bill_id: string | null; invoice_id: string | null; amount: number; type: string };

    // Reverse bill amount_paid
    if (pmt.bill_id && pmt.type === 'made') {
      const { data: bill } = await supabaseAdmin
        .from('bills')
        .select('total, amount_paid')
        .eq('id', pmt.bill_id)
        .eq('user_id', userId)
        .single();

      if (bill) {
        const billData = bill as { total: number; amount_paid: number };
        const newAmountPaid = Math.max(0, (billData.amount_paid || 0) - pmt.amount);
        const newStatus = 'unpaid';

        await supabaseAdmin
          .from('bills')
          .update({ amount_paid: newAmountPaid, status: newStatus })
          .eq('id', pmt.bill_id)
          .eq('user_id', userId);
      }
    }

    // Reverse invoice amount_paid
    if (pmt.invoice_id && pmt.type === 'received') {
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('total, amount_paid')
        .eq('id', pmt.invoice_id)
        .eq('user_id', userId)
        .single();

      if (invoice) {
        const invoiceData = invoice as { total: number; amount_paid: number };
        const newAmountPaid = Math.max(0, (invoiceData.amount_paid || 0) - pmt.amount);
        const newStatus = 'sent';

        await supabaseAdmin
          .from('invoices')
          .update({ amount_paid: newAmountPaid, status: newStatus })
          .eq('id', pmt.invoice_id)
          .eq('user_id', userId);
      }
    }

    const { error } = await supabaseAdmin
      .from('payments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
