import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/reconciliations - List reconciliations
// GET /api/reconciliations?id=xxx - Get single reconciliation with transactions
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const reconciliationId = searchParams.get('id');
  const bankAccountId = searchParams.get('bank_account_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (reconciliationId) {
      const { data, error } = await supabaseAdmin
        .from('reconciliations')
        .select('*, bank_accounts(id, name, institution)')
        .eq('id', reconciliationId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin
      .from('reconciliations')
      .select('*, bank_accounts(id, name, institution)')
      .eq('user_id', userId);

    if (bankAccountId) {
      query = query.eq('bank_account_id', bankAccountId);
    }

    const { data, error } = await query.order('statement_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching reconciliations:', error);
    return NextResponse.json({ error: 'Failed to fetch reconciliations' }, { status: 500 });
  }
}

// POST /api/reconciliations - Start a new reconciliation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, bank_account_id, statement_date, statement_balance } = body;

    if (!user_id || !bank_account_id || !statement_date || statement_balance === undefined) {
      return NextResponse.json({ error: 'user_id, bank_account_id, statement_date, and statement_balance are required' }, { status: 400 });
    }

    // Get the opening balance (last reconciled balance or 0)
    const { data: account } = await supabaseAdmin
      .from('bank_accounts')
      .select('last_reconciled_balance')
      .eq('id', bank_account_id)
      .eq('user_id', user_id)
      .single();

    const openingBalance = Number(account?.last_reconciled_balance) || 0;

    const { data, error } = await supabaseAdmin
      .from('reconciliations')
      .insert({
        user_id,
        bank_account_id,
        statement_date,
        statement_balance,
        opening_balance: openingBalance,
        cleared_balance: openingBalance,
        difference: Number(statement_balance) - openingBalance,
        status: 'in_progress',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating reconciliation:', error);
    return NextResponse.json({ error: 'Failed to create reconciliation' }, { status: 500 });
  }
}

// PUT /api/reconciliations - Update reconciliation (toggle transactions, complete)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, action, transaction_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    // Toggle a transaction's reconciliation status
    if (action === 'toggle_transaction' && transaction_id) {
      const { data: txn } = await supabaseAdmin
        .from('bank_transactions')
        .select('reconciliation_id, amount, type')
        .eq('id', transaction_id)
        .eq('user_id', user_id)
        .single();

      if (!txn) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      const isClearing = !txn.reconciliation_id || txn.reconciliation_id !== id;

      // Update the transaction
      await supabaseAdmin
        .from('bank_transactions')
        .update({
          reconciliation_id: isClearing ? id : null,
          is_reconciled: isClearing ? 0 : 0,  // Not fully reconciled until completed
        })
        .eq('id', transaction_id)
        .eq('user_id', user_id);

      // Recalculate cleared balance
      const { data: reconciliation } = await supabaseAdmin
        .from('reconciliations')
        .select('opening_balance, statement_balance')
        .eq('id', id)
        .single();

      const { data: clearedTxns } = await supabaseAdmin
        .from('bank_transactions')
        .select('amount, type')
        .eq('reconciliation_id', id)
        .eq('user_id', user_id);

      const clearedTotal = (clearedTxns || []).reduce((sum: number, t: Record<string, unknown>) => {
        return sum + (t.type === 'credit' ? Number(t.amount) : -Number(t.amount));
      }, 0);

      const clearedBalance = (Number(reconciliation?.opening_balance) || 0) + clearedTotal;
      const difference = (Number(reconciliation?.statement_balance) || 0) - clearedBalance;

      await supabaseAdmin
        .from('reconciliations')
        .update({ cleared_balance: clearedBalance, difference })
        .eq('id', id);

      return NextResponse.json({ success: true, data: { cleared_balance: clearedBalance, difference } });
    }

    // Complete reconciliation
    if (action === 'complete') {
      const { data: reconciliation } = await supabaseAdmin
        .from('reconciliations')
        .select('difference, bank_account_id, statement_date, statement_balance')
        .eq('id', id)
        .eq('user_id', user_id)
        .single();

      if (!reconciliation) {
        return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
      }

      const diff = Number(reconciliation.difference) || 0;
      if (Math.abs(diff) > 0.01) {
        return NextResponse.json({ error: `Cannot complete: difference of $${diff.toFixed(2)} remains` }, { status: 400 });
      }

      // Mark all cleared transactions as reconciled
      await supabaseAdmin
        .from('bank_transactions')
        .update({ is_reconciled: 1 })
        .eq('reconciliation_id', id)
        .eq('user_id', user_id);

      // Complete the reconciliation
      await supabaseAdmin
        .from('reconciliations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          difference: 0,
        })
        .eq('id', id);

      // Update bank account last reconciled info
      await supabaseAdmin
        .from('bank_accounts')
        .update({
          last_reconciled_date: reconciliation.statement_date,
          last_reconciled_balance: reconciliation.statement_balance,
        })
        .eq('id', reconciliation.bank_account_id);

      return NextResponse.json({ success: true, data: { status: 'completed' } });
    }

    // Generic update
    const { data, error } = await supabaseAdmin
      .from('reconciliations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating reconciliation:', error);
    return NextResponse.json({ error: 'Failed to update reconciliation' }, { status: 500 });
  }
}

// DELETE /api/reconciliations?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    // Unlink transactions from this reconciliation
    await supabaseAdmin
      .from('bank_transactions')
      .update({ reconciliation_id: null, is_reconciled: 0 })
      .eq('reconciliation_id', id)
      .eq('user_id', userId);

    // Delete the reconciliation
    const { error } = await supabaseAdmin
      .from('reconciliations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reconciliation:', error);
    return NextResponse.json({ error: 'Failed to delete reconciliation' }, { status: 500 });
  }
}
