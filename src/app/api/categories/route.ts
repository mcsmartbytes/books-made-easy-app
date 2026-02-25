import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/categories - List all categories
// GET /api/categories?type=expense - Filter by type
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const categoryId = searchParams.get('id');
  const categoryType = searchParams.get('type');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (categoryId) {
      const { data, error } = await supabaseAdmin
        .from('categories')
        .select('*')
        .eq('id', categoryId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (categoryType) {
      query = query.eq('type', categoryType);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// POST /api/categories - Create category (single or batch)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle batch insert (array)
    if (Array.isArray(body)) {
      const categories = body.map(cat => ({
        user_id: cat.user_id,
        name: cat.name,
        type: cat.type,
        icon: cat.icon || null,
        color: cat.color || null,
        tax_deductible: cat.tax_deductible ? 1 : 0,
        irs_category: cat.irs_category || null,
        description: cat.description || null,
        is_active: cat.is_active !== undefined ? (cat.is_active ? 1 : 0) : 1,
      }));

      const { data, error } = await supabaseAdmin
        .from('categories')
        .insert(categories);

      if (error) throw error;
      return NextResponse.json({ success: true, data }, { status: 201 });
    }

    // Single insert
    const { user_id, name, type, icon, color, tax_deductible, irs_category, description } = body;

    if (!user_id || !name || !type) {
      return NextResponse.json({ error: 'user_id, name, and type are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        user_id,
        name,
        type,
        icon: icon || null,
        color: color || null,
        tax_deductible: tax_deductible ? 1 : 0,
        irs_category: irs_category || null,
        description: description || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

// PUT /api/categories - Update category
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/categories?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('categories')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
