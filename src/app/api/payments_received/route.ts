import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

// GET /api/payments-received - List payments received
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const invoiceId = searchParams.get('invoice_id');
  const customerId = searchParams.get('customer_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    let query = supabaseAdmin
      .from('payments_received')
      .select('*, invoices(id, invoice_number, total), customers(id, name)')
      .eq('user_id', userId);

    if (invoiceId) {
      query = query.eq('invoice_id', invoiceId);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query.order('payment_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payments received:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST /api/payments-received - Record payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, invoice_id, customer_id, amount, payment_date, payment_method, reference_number, notes } = body;

    if (!user_id || !amount) {
      return NextResponse.json({ error: 'user_id and amount are required' }, { status: 400 });
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments_received')
      .insert({
        user_id,
        invoice_id,
        customer_id,
        amount,
        payment_date: payment_date || new Date().toISOString().split('T')[0],
        payment_method,
        reference_number,
        notes,
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Update invoice amount_paid if linked
    if (invoice_id) {
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('amount_paid, total')
        .eq('id', invoice_id)
        .single();

      if (invoice) {
        const invoiceData = invoice as any;
        const newAmountPaid = (invoiceData.amount_paid || 0) + amount;
        const newStatus = newAmountPaid >= invoiceData.total ? 'paid' : 'sent';

        await supabaseAdmin
          .from('invoices')
          .update({ amount_paid: newAmountPaid, status: newStatus })
          .eq('id', invoice_id);
      }
    }

    // Update customer balance if linked
    if (customer_id) {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('balance')
        .eq('id', customer_id)
        .single();

      if (customer) {
        const customerData = customer as any;
        await supabaseAdmin
          .from('customers')
          .update({ balance: (customerData.balance || 0) - amount })
          .eq('id', customer_id);
      }
    }

    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error) {
    console.error('Error recording payment:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}

// DELETE /api/payments-received?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    // Get payment details first
    const { data: payment } = await supabaseAdmin
      .from('payments_received')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    const paymentData = payment as any;

    // Delete payment
    const { error } = await supabaseAdmin
      .from('payments_received')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    // Reverse invoice amount_paid if linked
    if (paymentData.invoice_id) {
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('amount_paid, total')
        .eq('id', paymentData.invoice_id)
        .single();

      if (invoice) {
        const invoiceData = invoice as any;
        const newAmountPaid = Math.max(0, (invoiceData.amount_paid || 0) - paymentData.amount);
        const newStatus = newAmountPaid >= invoiceData.total ? 'paid' : 'sent';

        await supabaseAdmin
          .from('invoices')
          .update({ amount_paid: newAmountPaid, status: newStatus })
          .eq('id', paymentData.invoice_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
