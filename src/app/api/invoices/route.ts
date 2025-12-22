import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

// GET /api/invoices - List all invoices
// GET /api/invoices?id=xxx - Get single invoice with items
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const invoiceId = searchParams.get('id');
  const status = searchParams.get('status');
  const customerId = searchParams.get('customer_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (invoiceId) {
      // Get single invoice with items and customer
      const { data, error } = await supabaseAdmin
        .from('invoices')
        .select('*, customers(id, name, email, company), invoice_items(*)')
        .eq('id', invoiceId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // Build query for listing
    let query = supabaseAdmin
      .from('invoices')
      .select('*, customers(id, name, email, company)')
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query.order('issue_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

// POST /api/invoices - Create invoice with items
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, customer_id, invoice_number, due_date, items, tax_rate, notes, terms } = body;

    if (!user_id || !invoice_number || !due_date) {
      return NextResponse.json({ error: 'user_id, invoice_number, and due_date are required' }, { status: 400 });
    }

    // Calculate totals
    const subtotal = (items || []).reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);
    const taxAmount = subtotal * ((tax_rate || 0) / 100);
    const total = subtotal + taxAmount;

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        user_id,
        customer_id,
        invoice_number,
        due_date,
        subtotal,
        tax_rate: tax_rate || 0,
        tax_amount: taxAmount,
        total,
        notes,
        terms,
        status: 'draft',
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Create invoice items
    if (items && items.length > 0) {
      const invoiceItems = items.map((item: any, index: number) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: (item.quantity || 1) * (item.rate || 0),
        account_id: item.account_id,
        sort_order: index,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('invoice_items')
        .insert(invoiceItems);

      if (itemsError) throw itemsError;
    }

    // Return invoice with items
    const { data: fullInvoice } = await supabaseAdmin
      .from('invoices')
      .select('*, customers(id, name, email, company), invoice_items(*)')
      .eq('id', invoice.id)
      .single();

    return NextResponse.json({ success: true, data: fullInvoice }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Invoice number already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}

// PUT /api/invoices - Update invoice
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
      const taxAmount = subtotal * ((updates.tax_rate || 0) / 100);
      updates.subtotal = subtotal;
      updates.tax_amount = taxAmount;
      updates.total = subtotal + taxAmount;
    }

    // Update invoice
    const { data: _invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Update items if provided
    if (items) {
      // Delete existing items
      await supabaseAdmin
        .from('invoice_items')
        .delete()
        .eq('invoice_id', id);

      // Insert new items
      if (items.length > 0) {
        const invoiceItems = items.map((item: any, index: number) => ({
          invoice_id: id,
          description: item.description,
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          amount: (item.quantity || 1) * (item.rate || 0),
          account_id: item.account_id,
          sort_order: index,
        }));

        await supabaseAdmin
          .from('invoice_items')
          .insert(invoiceItems);
      }
    }

    // Return updated invoice with items
    const { data: fullInvoice } = await supabaseAdmin
      .from('invoices')
      .select('*, customers(id, name, email, company), invoice_items(*)')
      .eq('id', id)
      .single();

    return NextResponse.json({ success: true, data: fullInvoice });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

// DELETE /api/invoices?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    // Delete invoice (cascade will delete items)
    const { error } = await supabaseAdmin
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
