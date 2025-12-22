import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

// GET /api/bills - List all bills
// GET /api/bills?id=xxx - Get single bill with items
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const billId = searchParams.get('id');
  const status = searchParams.get('status');
  const vendorId = searchParams.get('vendor_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (billId) {
      // Get single bill with items and vendor
      const { data, error } = await supabaseAdmin
        .from('bills')
        .select('*, vendors(id, name, email, company), bill_items(*)')
        .eq('id', billId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // Build query for listing
    let query = supabaseAdmin
      .from('bills')
      .select('*, vendors(id, name, email, company)')
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query.order('bill_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}

// POST /api/bills - Create bill with items
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, vendor_id, bill_number, bill_date, due_date, items, category, description, notes } = body;

    if (!user_id || !due_date) {
      return NextResponse.json({ error: 'user_id and due_date are required' }, { status: 400 });
    }

    // Calculate totals
    const subtotal = (items || []).reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);
    const taxAmount = (items || []).reduce((sum: number, item: any) => sum + (item.tax_amount || 0), 0);
    const total = subtotal + taxAmount;

    // Create bill
    const { data: bill, error: billError } = await supabaseAdmin
      .from('bills')
      .insert({
        user_id,
        vendor_id,
        bill_number,
        bill_date: bill_date || new Date().toISOString().split('T')[0],
        due_date,
        category,
        subtotal,
        tax_amount: taxAmount,
        total,
        description,
        notes,
        status: 'unpaid',
      })
      .select()
      .single();

    if (billError) throw billError;

    // Create bill items
    if (items && items.length > 0) {
      const billItems = items.map((item: any, index: number) => ({
        bill_id: bill.id,
        description: item.description,
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: (item.quantity || 1) * (item.rate || 0),
        account_id: item.account_id,
        sort_order: index,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('bill_items')
        .insert(billItems);

      if (itemsError) throw itemsError;
    }

    // Return bill with items
    const { data: fullBill } = await supabaseAdmin
      .from('bills')
      .select('*, vendors(id, name, email, company), bill_items(*)')
      .eq('id', bill.id)
      .single();

    return NextResponse.json({ success: true, data: fullBill }, { status: 201 });
  } catch (error) {
    console.error('Error creating bill:', error);
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
  }
}

// PUT /api/bills - Update bill
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, items, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    // Recalculate totals if items provided
    if (items) {
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);
      const taxAmount = items.reduce((sum: number, item: any) => sum + (item.tax_amount || 0), 0);
      updates.subtotal = subtotal;
      updates.tax_amount = taxAmount;
      updates.total = subtotal + taxAmount;
    }

    // Update bill
    const { data: _bill, error: billError } = await supabaseAdmin
      .from('bills')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (billError) throw billError;

    // Update items if provided
    if (items) {
      // Delete existing items
      await supabaseAdmin
        .from('bill_items')
        .delete()
        .eq('bill_id', id);

      // Insert new items
      if (items.length > 0) {
        const billItems = items.map((item: any, index: number) => ({
          bill_id: id,
          description: item.description,
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          amount: (item.quantity || 1) * (item.rate || 0),
          account_id: item.account_id,
          sort_order: index,
        }));

        await supabaseAdmin
          .from('bill_items')
          .insert(billItems);
      }
    }

    // Return updated bill with items
    const { data: fullBill } = await supabaseAdmin
      .from('bills')
      .select('*, vendors(id, name, email, company), bill_items(*)')
      .eq('id', id)
      .single();

    return NextResponse.json({ success: true, data: fullBill });
  } catch (error) {
    console.error('Error updating bill:', error);
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 });
  }
}

// DELETE /api/bills?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    // Delete bill (cascade will delete items)
    const { error } = await supabaseAdmin
      .from('bills')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bill:', error);
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 });
  }
}
