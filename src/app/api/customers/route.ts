import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

// GET /api/customers - List all customers
// GET /api/customers?id=xxx - Get single customer
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const customerId = searchParams.get('id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (customerId) {
      // Get single customer
      const { data, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // List all customers
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

// POST /api/customers - Create customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, name, email, phone, company, address, city, state, zip, country, notes } = body;

    if (!user_id || !name) {
      return NextResponse.json({ error: 'user_id and name are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert({
        user_id,
        name,
        email,
        phone,
        company,
        address,
        city,
        state,
        zip,
        country: country || 'United States',
        notes,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

// PUT /api/customers - Update customer
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

// DELETE /api/customers?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    // Soft delete - set is_active to false
    const { error } = await supabaseAdmin
      .from('customers')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
