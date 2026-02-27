import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/bank-accounts - List all bank accounts
// GET /api/bank-accounts?id=xxx - Get single bank account
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const accountId = searchParams.get('id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (accountId) {
      const { data, error } = await supabaseAdmin
        .from('bank_accounts')
        .select('*, accounts(id, name, code, type)')
        .eq('id', accountId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    const { data, error } = await supabaseAdmin
      .from('bank_accounts')
      .select('*, accounts(id, name, code, type)')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch bank accounts' }, { status: 500 });
  }
}

// POST /api/bank-accounts - Create bank account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, name, institution, account_type, account_number_last4, routing_number_last4, current_balance, account_id } = body;

    if (!user_id || !name) {
      return NextResponse.json({ error: 'user_id and name are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('bank_accounts')
      .insert({
        user_id,
        name,
        institution: institution || null,
        account_type: account_type || 'checking',
        account_number_last4: account_number_last4 || null,
        routing_number_last4: routing_number_last4 || null,
        current_balance: current_balance || 0,
        available_balance: current_balance || 0,
        account_id: account_id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: 'Failed to create bank account' }, { status: 500 });
  }
}

// PUT /api/bank-accounts - Update bank account
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('bank_accounts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating bank account:', error);
    return NextResponse.json({ error: 'Failed to update bank account' }, { status: 500 });
  }
}

// DELETE /api/bank-accounts?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('bank_accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    return NextResponse.json({ error: 'Failed to delete bank account' }, { status: 500 });
  }
}
