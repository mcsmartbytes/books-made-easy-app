import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/bank-transactions - List transactions with filters
// GET /api/bank-transactions?id=xxx - Get single transaction
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const txnId = searchParams.get('id');
  const bankAccountId = searchParams.get('bank_account_id');
  const status = searchParams.get('status');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const reconciliationId = searchParams.get('reconciliation_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (txnId) {
      const { data, error } = await supabaseAdmin
        .from('bank_transactions')
        .select('*, bank_accounts(id, name, institution), categories(id, name)')
        .eq('id', txnId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin
      .from('bank_transactions')
      .select('*, bank_accounts(id, name), categories(id, name)')
      .eq('user_id', userId);

    if (bankAccountId) {
      query = query.eq('bank_account_id', bankAccountId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }
    if (reconciliationId) {
      query = query.eq('reconciliation_id', reconciliationId);
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching bank transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch bank transactions' }, { status: 500 });
  }
}

// POST /api/bank-transactions - Create transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, bank_account_id, date, description, amount, type, category_id, payee, reference, check_number, memo } = body;

    if (!user_id || !bank_account_id || !date || !description || amount === undefined) {
      return NextResponse.json({ error: 'user_id, bank_account_id, date, description, and amount are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('bank_transactions')
      .insert({
        user_id,
        bank_account_id,
        date,
        description,
        amount: Math.abs(amount),
        type: type || (amount < 0 ? 'debit' : 'credit'),
        category_id: category_id || null,
        payee: payee || null,
        reference: reference || null,
        check_number: check_number || null,
        memo: memo || null,
        status: 'unreviewed',
      })
      .select()
      .single();

    if (error) throw error;

    // Update bank account balance
    const balanceChange = (type || (amount < 0 ? 'debit' : 'credit')) === 'credit' ? Math.abs(amount) : -Math.abs(amount);
    const { data: account } = await supabaseAdmin
      .from('bank_accounts')
      .select('current_balance')
      .eq('id', bank_account_id)
      .single();

    if (account) {
      await supabaseAdmin
        .from('bank_accounts')
        .update({ current_balance: (Number(account.current_balance) || 0) + balanceChange })
        .eq('id', bank_account_id);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating bank transaction:', error);
    return NextResponse.json({ error: 'Failed to create bank transaction' }, { status: 500 });
  }
}

// PUT /api/bank-transactions - Update transaction
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('bank_transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating bank transaction:', error);
    return NextResponse.json({ error: 'Failed to update bank transaction' }, { status: 500 });
  }
}

// DELETE /api/bank-transactions?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('bank_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bank transaction:', error);
    return NextResponse.json({ error: 'Failed to delete bank transaction' }, { status: 500 });
  }
}
