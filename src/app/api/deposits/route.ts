import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/deposits - List deposits
// GET /api/deposits?id=xxx - Get single deposit with items
// GET /api/deposits?undeposited=true - List undeposited payments
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const depositId = searchParams.get('id');
  const undeposited = searchParams.get('undeposited');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    // Return undeposited payments
    if (undeposited === 'true') {
      const { data, error } = await supabaseAdmin
        .from('payments_received')
        .select('*, invoices(id, invoice_number, total), customers(id, name)')
        .eq('user_id', userId)
        .is('deposit_id', null)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (depositId) {
      // Fetch deposit with bank account
      const { data: deposit, error: depositError } = await supabaseAdmin
        .from('deposits')
        .select('*, bank_accounts(id, name, institution)')
        .eq('id', depositId)
        .eq('user_id', userId)
        .single();

      if (depositError) throw depositError;

      // Fetch deposit items
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('deposit_items')
        .select('*, payments_received(id, amount, payment_date, payment_method, reference_number, customer_id)')
        .eq('deposit_id', depositId);

      if (itemsError) throw itemsError;

      // Fetch customer names for payments
      const customerIds = [...new Set(
        ((items || []) as Record<string, unknown>[])
          .map(i => (i.payments_received as Record<string, unknown>)?.customer_id)
          .filter(Boolean)
      )] as string[];

      const customerMap: Record<string, string> = {};
      if (customerIds.length > 0) {
        const { data: customers } = await supabaseAdmin
          .from('customers')
          .select('id, name')
          .in('id', customerIds);
        for (const c of (customers || []) as { id: string; name: string }[]) {
          customerMap[c.id] = c.name;
        }
      }

      // Attach customer names to payment data
      const enrichedItems = ((items || []) as Record<string, unknown>[]).map(item => {
        const payment = item.payments_received as Record<string, unknown> | null;
        if (payment?.customer_id) {
          return {
            ...item,
            payments_received: {
              ...payment,
              customers: { id: payment.customer_id, name: customerMap[payment.customer_id as string] || null },
            },
          };
        }
        return item;
      });

      return NextResponse.json({ success: true, data: { ...deposit, deposit_items: enrichedItems } });
    }

    const { data, error } = await supabaseAdmin
      .from('deposits')
      .select('*, bank_accounts(id, name, institution)')
      .eq('user_id', userId)
      .order('deposit_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching deposits:', error);
    return NextResponse.json({ error: 'Failed to fetch deposits' }, { status: 500 });
  }
}

// POST /api/deposits - Create deposit from selected payments
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, bank_account_id, deposit_date, memo, payment_ids } = body;

    if (!user_id || !payment_ids || payment_ids.length === 0) {
      return NextResponse.json({ error: 'user_id and payment_ids are required' }, { status: 400 });
    }

    // Get the selected payments
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('payments_received')
      .select('*')
      .eq('user_id', user_id)
      .is('deposit_id', null)
      .in('id', payment_ids);

    if (paymentsError) throw paymentsError;
    if (!payments || payments.length === 0) {
      return NextResponse.json({ error: 'No valid undeposited payments found' }, { status: 400 });
    }

    // Calculate total
    const total = (payments as { amount: number }[]).reduce((sum, p) => sum + p.amount, 0);

    // Generate deposit number
    const { data: countData } = await supabaseAdmin
      .from('deposits')
      .select('id')
      .eq('user_id', user_id);
    const count = (countData || []).length + 1;
    const depositNumber = `DEP-${String(count).padStart(4, '0')}`;

    // Create deposit
    const { data: deposit, error: depositError } = await supabaseAdmin
      .from('deposits')
      .insert({
        user_id,
        bank_account_id: bank_account_id || null,
        deposit_number: depositNumber,
        deposit_date: deposit_date || new Date().toISOString().split('T')[0],
        total,
        memo: memo || null,
        status: bank_account_id ? 'deposited' : 'pending',
      })
      .select()
      .single();

    if (depositError) throw depositError;
    if (!deposit) throw new Error('Failed to create deposit');

    const depositData = deposit as { id: string };

    // Create deposit items and link payments
    const depositItems = (payments as { id: string; amount: number; reference_number?: string }[]).map((p, index) => ({
      deposit_id: depositData.id,
      payment_id: p.id,
      description: p.reference_number || `Payment ${index + 1}`,
      amount: p.amount,
      sort_order: index,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('deposit_items')
      .insert(depositItems);

    if (itemsError) throw itemsError;

    // Mark payments as deposited
    for (const paymentId of payment_ids) {
      await supabaseAdmin
        .from('payments_received')
        .update({ deposit_id: depositData.id })
        .eq('id', paymentId)
        .eq('user_id', user_id);
    }

    // Update bank account balance if specified
    if (bank_account_id) {
      const { data: account } = await supabaseAdmin
        .from('bank_accounts')
        .select('current_balance')
        .eq('id', bank_account_id)
        .single();

      if (account) {
        await supabaseAdmin
          .from('bank_accounts')
          .update({ current_balance: ((account as { current_balance: number }).current_balance || 0) + total })
          .eq('id', bank_account_id);
      }
    }

    return NextResponse.json({ success: true, data: deposit }, { status: 201 });
  } catch (error) {
    console.error('Error creating deposit:', error);
    return NextResponse.json({ error: 'Failed to create deposit' }, { status: 500 });
  }
}

// PUT /api/deposits - Update deposit
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('deposits')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating deposit:', error);
    return NextResponse.json({ error: 'Failed to update deposit' }, { status: 500 });
  }
}

// DELETE /api/deposits?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    // Unlink payments from this deposit
    await supabaseAdmin
      .from('payments_received')
      .update({ deposit_id: null })
      .eq('deposit_id', id)
      .eq('user_id', userId);

    // Delete deposit (cascade deletes deposit_items)
    const { error } = await supabaseAdmin
      .from('deposits')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting deposit:', error);
    return NextResponse.json({ error: 'Failed to delete deposit' }, { status: 500 });
  }
}
