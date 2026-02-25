import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';
import { normalizeItemName, normalizeVendor } from '@/lib/lineItems';

export const dynamic = 'force-dynamic';

// GET - Fetch line items for an expense or user
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const expenseId = searchParams.get('expense_id');
    const userId = searchParams.get('user_id');

    if (!expenseId && !userId) {
      return NextResponse.json(
        { success: false, error: 'expense_id or user_id is required' },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from('receipt_line_items')
      .select('*')
      .order('sort_order', { ascending: true });

    if (expenseId) {
      query = query.eq('expense_id', expenseId);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Error fetching line items:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Save line items for an expense
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { expense_id, user_id, line_items, vendor, purchase_date } = body;

    if (!expense_id || !user_id || !line_items) {
      return NextResponse.json(
        { success: false, error: 'expense_id, user_id, and line_items are required' },
        { status: 400 }
      );
    }

    // Delete existing line items for this expense
    await supabaseAdmin
      .from('receipt_line_items')
      .delete()
      .eq('expense_id', expense_id);

    // Insert new line items
    const itemsToInsert = line_items.map((item: any, index: number) => ({
      expense_id,
      user_id,
      item_name: item.name || item.item_name,
      item_name_normalized: normalizeItemName(item.name || item.item_name),
      quantity: parseFloat(item.quantity) || 1,
      unit_price: parseFloat(item.unit_price) || 0,
      line_total: parseFloat(item.line_total) || (parseFloat(item.quantity || 1) * parseFloat(item.unit_price || 0)),
      unit_of_measure: item.unit || item.unit_of_measure || 'each',
      is_taxable: item.is_taxable !== false,
      sort_order: index,
    }));

    const { data: insertedItems, error: insertError } = await supabaseAdmin
      .from('receipt_line_items')
      .insert(itemsToInsert)
      .select();

    if (insertError) throw insertError;

    // Also record in price history for tracking
    if (vendor && purchase_date) {
      const priceHistoryItems = (insertedItems || []).map((item: any) => ({
        user_id,
        item_name_normalized: item.item_name_normalized,
        vendor,
        vendor_normalized: normalizeVendor(vendor),
        unit_price: item.unit_price,
        quantity: item.quantity,
        unit_of_measure: item.unit_of_measure,
        purchase_date,
        expense_id,
        line_item_id: item.id,
      }));

      await supabaseAdmin
        .from('item_price_history')
        .insert(priceHistoryItems);
    }

    return NextResponse.json({ success: true, data: insertedItems });
  } catch (error: any) {
    console.error('Error saving line items:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a single line item
export async function PUT(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Line item ID is required' },
        { status: 400 }
      );
    }

    // Normalize item name if provided
    if (updates.item_name) {
      updates.item_name_normalized = normalizeItemName(updates.item_name);
    }

    const { data, error } = await supabaseAdmin
      .from('receipt_line_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error updating line item:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove a line item
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Line item ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('receipt_line_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting line item:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
