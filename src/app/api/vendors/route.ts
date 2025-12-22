import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

// GET /api/vendors - List all vendors
// GET /api/vendors?id=xxx - Get single vendor
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const vendorId = searchParams.get('id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (vendorId) {
      // Get single vendor with bills
      const { data, error } = await supabaseAdmin
        .from('vendors')
        .select('*, bills(*)')
        .eq('id', vendorId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // List all vendors
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

// POST /api/vendors - Create vendor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, name, email, phone, company, address, city, state, zip, country, tax_id, notes } = body;

    if (!user_id || !name) {
      return NextResponse.json({ error: 'user_id and name are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
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
        tax_id,
        notes,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 });
  }
}

// PUT /api/vendors - Update vendor
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating vendor:', error);
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
  }
}

// DELETE /api/vendors?id=xxx&user_id=xxx
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
      .from('vendors')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 });
  }
}
