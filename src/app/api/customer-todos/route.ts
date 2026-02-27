import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/customer-todos?customer_id=xxx&user_id=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const customerId = searchParams.get('customer_id');
  const todoId = searchParams.get('id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (todoId) {
      const { data, error } = await supabaseAdmin
        .from('customer_todos')
        .select('*')
        .eq('id', todoId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin
      .from('customer_todos')
      .select('*')
      .eq('user_id', userId);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching customer todos:', error);
    return NextResponse.json({ error: 'Failed to fetch customer todos' }, { status: 500 });
  }
}

// POST /api/customer-todos
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, customer_id, title, description, due_date } = body;

    if (!user_id || !customer_id || !title) {
      return NextResponse.json({ error: 'user_id, customer_id, and title are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('customer_todos')
      .insert({
        user_id,
        customer_id,
        title,
        description: description || null,
        due_date: due_date || null,
        is_completed: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating customer todo:', error);
    return NextResponse.json({ error: 'Failed to create customer todo' }, { status: 500 });
  }
}

// PUT /api/customer-todos
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('customer_todos')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating customer todo:', error);
    return NextResponse.json({ error: 'Failed to update customer todo' }, { status: 500 });
  }
}

// DELETE /api/customer-todos?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('customer_todos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer todo:', error);
    return NextResponse.json({ error: 'Failed to delete customer todo' }, { status: 500 });
  }
}
