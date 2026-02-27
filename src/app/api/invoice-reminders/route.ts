import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/invoice-reminders?user_id=xxx&invoice_id=xxx
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  const invoiceId = request.nextUrl.searchParams.get('invoice_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    let query = supabaseAdmin
      .from('invoice_reminders')
      .select('*')
      .eq('user_id', userId);

    if (invoiceId) {
      query = query.eq('invoice_id', invoiceId);
    }

    const { data, error } = await query.order('sent_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching invoice reminders:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice reminders' }, { status: 500 });
  }
}

// POST /api/invoice-reminders — log a reminder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, invoice_id, reminder_type, message } = body;

    if (!user_id || !invoice_id) {
      return NextResponse.json({ error: 'user_id and invoice_id are required' }, { status: 400 });
    }

    const row = {
      user_id,
      invoice_id,
      reminder_type: reminder_type || 'manual',
      message: message || null,
      sent_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('invoice_reminders')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice reminder:', error);
    return NextResponse.json({ error: 'Failed to create invoice reminder' }, { status: 500 });
  }
}

// DELETE /api/invoice-reminders?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const userId = request.nextUrl.searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('invoice_reminders')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice reminder:', error);
    return NextResponse.json({ error: 'Failed to delete invoice reminder' }, { status: 500 });
  }
}
