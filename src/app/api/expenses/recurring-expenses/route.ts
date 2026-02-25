import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET - fetch all recurring expenses for a user
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('recurring_expenses')
      .select('*, categories(name, icon, color)')
      .eq('user_id', userId)
      .order('next_due_date', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - create a new recurring expense
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const {
      user_id,
      amount,
      description,
      category_id,
      vendor,
      payment_method,
      is_business,
      notes,
      frequency,
      start_date,
    } = body;

    if (!user_id || !amount || !description || !frequency || !start_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate next due date based on start date
    const nextDueDate = new Date(start_date);

    const { data, error } = await supabaseAdmin
      .from('recurring_expenses')
      .insert({
        user_id,
        amount: parseFloat(amount),
        description,
        category_id: category_id || null,
        vendor: vendor || null,
        payment_method: payment_method || 'credit',
        is_business: is_business ?? true,
        notes: notes || null,
        frequency,
        start_date,
        next_due_date: nextDueDate.toISOString().split('T')[0],
        is_active: true,
      })
      .select('*, categories(name, icon, color)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT - update a recurring expense
export async function PUT(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Recurring expense ID is required' },
        { status: 400 }
      );
    }

    // If amount is provided, ensure it's a number
    if (updates.amount) {
      updates.amount = parseFloat(updates.amount);
    }

    const { data, error } = await supabaseAdmin
      .from('recurring_expenses')
      .update(updates)
      .eq('id', id)
      .select('*, categories(name, icon, color)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - delete a recurring expense
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Recurring expense ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('recurring_expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
