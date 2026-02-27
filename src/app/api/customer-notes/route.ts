import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/customer-notes?customer_id=xxx&user_id=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const customerId = searchParams.get('customer_id');
  const noteId = searchParams.get('id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (noteId) {
      const { data, error } = await supabaseAdmin
        .from('customer_notes')
        .select('*')
        .eq('id', noteId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin
      .from('customer_notes')
      .select('*')
      .eq('user_id', userId);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching customer notes:', error);
    return NextResponse.json({ error: 'Failed to fetch customer notes' }, { status: 500 });
  }
}

// POST /api/customer-notes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, customer_id, content } = body;

    if (!user_id || !customer_id || !content) {
      return NextResponse.json({ error: 'user_id, customer_id, and content are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('customer_notes')
      .insert({ user_id, customer_id, content })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating customer note:', error);
    return NextResponse.json({ error: 'Failed to create customer note' }, { status: 500 });
  }
}

// PUT /api/customer-notes
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, content } = body;

    if (!id || !user_id || !content) {
      return NextResponse.json({ error: 'id, user_id, and content are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('customer_notes')
      .update({ content })
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating customer note:', error);
    return NextResponse.json({ error: 'Failed to update customer note' }, { status: 500 });
  }
}

// DELETE /api/customer-notes?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('customer_notes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer note:', error);
    return NextResponse.json({ error: 'Failed to delete customer note' }, { status: 500 });
  }
}
