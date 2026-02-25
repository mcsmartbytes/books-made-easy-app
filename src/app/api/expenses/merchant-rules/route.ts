import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET - fetch all merchant rules for a user
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
      .from('merchant_rules')
      .select('*, categories(id, name, icon, color)')
      .eq('user_id', userId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - create a new merchant rule
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const {
      user_id,
      merchant_pattern,
      match_type,
      category_id,
      is_business,
      vendor_display_name,
      priority,
      auto_created,
    } = body;

    if (!user_id || !merchant_pattern) {
      return NextResponse.json(
        { success: false, error: 'User ID and merchant pattern are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('merchant_rules')
      .insert({
        user_id,
        merchant_pattern: merchant_pattern.trim(),
        match_type: match_type || 'contains',
        category_id: category_id || null,
        is_business: is_business ?? true,
        vendor_display_name: vendor_display_name || null,
        priority: priority || 0,
        auto_created: auto_created || false,
      })
      .select('*, categories(id, name, icon, color)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    // Handle duplicate rule error
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, error: 'A rule for this merchant pattern already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT - update a merchant rule
export async function PUT(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    // Clean up updates
    if (updates.merchant_pattern) {
      updates.merchant_pattern = updates.merchant_pattern.trim();
    }

    const { data, error } = await supabaseAdmin
      .from('merchant_rules')
      .update(updates)
      .eq('id', id)
      .select('*, categories(id, name, icon, color)')
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

// DELETE - delete a merchant rule
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('merchant_rules')
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
