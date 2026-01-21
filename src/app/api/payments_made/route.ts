import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

// GET /api/payments-made - List payments made
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const billId = searchParams.get('bill_id');
  const vendorId = searchParams.get('vendor_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    let query = supabaseAdmin
      .from('payments_made')
      .select('*, bills(id, bill_number, total), vendors(id, name)')
      .eq('user_id', userId);

    if (billId) {
      query = query.eq('bill_id', billId);
    }

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query.order('payment_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payments made:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST /api/payments-made - Record payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, bill_id, vendor_id, amount, payment_date, payment_method, reference_number, notes } = body;

    if (!user_id || !amount) {
      return NextResponse.json({ error: 'user_id and amount are required' }, { status: 400 });
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments_made')
      .insert({
        user_id,
        bill_id,
        vendor_id,
        amount,
        payment_date: payment_date || new Date().toISOString().split('T')[0],
        payment_method,
        reference_number,
        notes,
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Update bill amount_paid if linked
    if (bill_id) {
      const { data: bill } = await supabaseAdmin
        .from('bills')
        .select('amount_paid, total')
        .eq('id', bill_id)
        .single();

      if (bill) {
        const billData = bill as any;
        const newAmountPaid = (billData.amount_paid || 0) + amount;
        const newStatus = newAmountPaid >= billData.total ? 'paid' : 'unpaid';

        await supabaseAdmin
          .from('bills')
          .update({ amount_paid: newAmountPaid, status: newStatus })
          .eq('id', bill_id);
      }
    }

    // Update vendor balance if linked
    if (vendor_id) {
      const { data: vendor } = await supabaseAdmin
        .from('vendors')
        .select('balance')
        .eq('id', vendor_id)
        .single();

      if (vendor) {
        const vendorData = vendor as any;
        await supabaseAdmin
          .from('vendors')
          .update({ balance: (vendorData.balance || 0) - amount })
          .eq('id', vendor_id);
      }
    }

    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error) {
    console.error('Error recording payment:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}

// DELETE /api/payments-made?id=xxx&user_id=xxx
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
      .from('payments_made')
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
      .from('payments_made')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    // Reverse bill amount_paid if linked
    if (paymentData.bill_id) {
      const { data: bill } = await supabaseAdmin
        .from('bills')
        .select('amount_paid, total')
        .eq('id', paymentData.bill_id)
        .single();

      if (bill) {
        const billData = bill as any;
        const newAmountPaid = Math.max(0, (billData.amount_paid || 0) - paymentData.amount);
        const newStatus = newAmountPaid >= billData.total ? 'paid' : 'unpaid';

        await supabaseAdmin
          .from('bills')
          .update({ amount_paid: newAmountPaid, status: newStatus })
          .eq('id', paymentData.bill_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
