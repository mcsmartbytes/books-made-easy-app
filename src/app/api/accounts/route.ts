import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

// GET /api/accounts - List all accounts (chart of accounts)
// GET /api/accounts?type=expense - Filter by type
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const accountId = searchParams.get('id');
  const accountType = searchParams.get('type');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (accountId) {
      const { data, error } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (accountType) {
      query = query.eq('type', accountType);
    }

    const { data, error } = await query.order('code');

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

// POST /api/accounts - Create account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, code, name, type, subtype, description } = body;

    if (!user_id || !code || !name || !type) {
      return NextResponse.json({ error: 'user_id, code, name, and type are required' }, { status: 400 });
    }

    const validTypes = ['asset', 'liability', 'equity', 'income', 'expense'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('accounts')
      .insert({
        user_id,
        code,
        name,
        type,
        subtype,
        description,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating account:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

// PUT /api/accounts - Update account
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

// DELETE /api/accounts?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    // Soft delete
    const { error } = await supabaseAdmin
      .from('accounts')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}

