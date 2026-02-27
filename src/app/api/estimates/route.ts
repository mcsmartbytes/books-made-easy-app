import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/estimates - List estimates
// GET /api/estimates?id=xxx - Get single estimate with items
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const estimateId = searchParams.get('id');
  const customerId = searchParams.get('customer_id');
  const status = searchParams.get('status');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (estimateId) {
      const { data, error } = await supabaseAdmin
        .from('estimates')
        .select('*, customers(id, name, email, company), estimate_items(*)')
        .eq('id', estimateId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin
      .from('estimates')
      .select('*, customers(id, name, email, company)')
      .eq('user_id', userId);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('issue_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching estimates:', error);
    return NextResponse.json({ error: 'Failed to fetch estimates' }, { status: 500 });
  }
}

// POST /api/estimates - Create estimate with items
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id, customer_id, estimate_number, issue_date, expiry_date,
      items, tax_rate, notes, terms, _upsert, _onConflict, ...rest
    } = body;

    if (!user_id || !customer_id || !estimate_number || !issue_date || !expiry_date) {
      return NextResponse.json(
        { error: 'user_id, customer_id, estimate_number, issue_date, and expiry_date are required' },
        { status: 400 },
      );
    }

    // Calculate totals
    const subtotal = (items || []).reduce((sum: number, item: { quantity?: number; rate?: number }) =>
      sum + ((item.quantity || 1) * (item.rate || 0)), 0);
    const taxAmount = subtotal * ((tax_rate || 0) / 100);
    const total = subtotal + taxAmount;

    const insertData = {
      user_id,
      customer_id,
      estimate_number,
      issue_date,
      expiry_date,
      subtotal,
      tax_amount: taxAmount,
      total,
      notes: notes || null,
      terms: terms || null,
      status: 'draft',
      ...rest,
    };

    // Handle upsert
    if (_upsert && _onConflict) {
      const { data: estimate, error } = await supabaseAdmin
        .from('estimates')
        .upsert(insertData, { onConflict: _onConflict })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data: estimate }, { status: 201 });
    }

    const { data: estimate, error: estimateError } = await supabaseAdmin
      .from('estimates')
      .insert(insertData)
      .select()
      .single();

    if (estimateError) throw estimateError;
    if (!estimate) throw new Error('Failed to create estimate');

    // Create estimate items
    if (items && items.length > 0) {
      const estimateItems = items.map((item: { description: string; quantity?: number; rate?: number; product_service_id?: string }, index: number) => ({
        estimate_id: (estimate as Record<string, unknown>).id,
        description: item.description,
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: (item.quantity || 1) * (item.rate || 0),
        product_service_id: item.product_service_id || null,
        sort_order: index,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('estimate_items')
        .insert(estimateItems);

      if (itemsError) throw itemsError;
    }

    // Return estimate with items
    const { data: fullEstimate } = await supabaseAdmin
      .from('estimates')
      .select('*, customers(id, name, email, company), estimate_items(*)')
      .eq('id', (estimate as Record<string, unknown>).id)
      .single();

    return NextResponse.json({ success: true, data: fullEstimate }, { status: 201 });
  } catch (error) {
    console.error('Error creating estimate:', error);
    return NextResponse.json({ error: 'Failed to create estimate' }, { status: 500 });
  }
}

// PUT /api/estimates - Update estimate
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, items, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    // Recalculate totals if items provided
    if (items) {
      const subtotal = items.reduce((sum: number, item: { quantity?: number; rate?: number }) =>
        sum + ((item.quantity || 1) * (item.rate || 0)), 0);
      const taxRate = updates.tax_rate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      updates.subtotal = subtotal;
      updates.tax_amount = taxAmount;
      updates.total = subtotal + taxAmount;
    }

    const { error: updateError } = await supabaseAdmin
      .from('estimates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id);

    if (updateError) throw updateError;

    // Update items if provided
    if (items) {
      await supabaseAdmin
        .from('estimate_items')
        .delete()
        .eq('estimate_id', id);

      if (items.length > 0) {
        const estimateItems = items.map((item: { description: string; quantity?: number; rate?: number; product_service_id?: string }, index: number) => ({
          estimate_id: id,
          description: item.description,
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          amount: (item.quantity || 1) * (item.rate || 0),
          product_service_id: item.product_service_id || null,
          sort_order: index,
        }));

        await supabaseAdmin
          .from('estimate_items')
          .insert(estimateItems);
      }
    }

    const { data: fullEstimate } = await supabaseAdmin
      .from('estimates')
      .select('*, customers(id, name, email, company), estimate_items(*)')
      .eq('id', id)
      .single();

    return NextResponse.json({ success: true, data: fullEstimate });
  } catch (error) {
    console.error('Error updating estimate:', error);
    return NextResponse.json({ error: 'Failed to update estimate' }, { status: 500 });
  }
}

// DELETE /api/estimates?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('estimates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting estimate:', error);
    return NextResponse.json({ error: 'Failed to delete estimate' }, { status: 500 });
  }
}
