import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/invoice-late-fees?user_id=xxx&invoice_id=xxx
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  const invoiceId = request.nextUrl.searchParams.get('invoice_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    let query = supabaseAdmin
      .from('invoice_late_fees')
      .select('*')
      .eq('user_id', userId);

    if (invoiceId) {
      query = query.eq('invoice_id', invoiceId);
    }

    const { data, error } = await query.order('applied_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching invoice late fees:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice late fees' }, { status: 500 });
  }
}

// POST /api/invoice-late-fees — apply a late fee to an invoice
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, invoice_id, applied_type } = body;

    if (!user_id || !invoice_id) {
      return NextResponse.json({ error: 'user_id and invoice_id are required' }, { status: 400 });
    }

    // 1. Get the user's late fee settings
    const { data: settings } = await supabaseAdmin
      .from('late_fee_settings')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (!settings) {
      return NextResponse.json({ error: 'Late fee settings not configured. Go to Settings > Invoicing first.' }, { status: 400 });
    }

    if (!settings.enabled) {
      return NextResponse.json({ error: 'Late fees are not enabled in settings.' }, { status: 400 });
    }

    // 2. Get the invoice
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('user_id', user_id)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // 3. Check max fees
    const { data: existingFees } = await supabaseAdmin
      .from('invoice_late_fees')
      .select('*')
      .eq('invoice_id', invoice_id)
      .eq('reversed', 0);

    const activeFeeCount = (existingFees || []).length;
    const maxFees = (settings as Record<string, unknown>).max_fees_per_invoice as number;
    if (activeFeeCount >= maxFees) {
      return NextResponse.json({ error: `Maximum late fees (${maxFees}) already applied to this invoice.` }, { status: 400 });
    }

    // 4. Calculate the fee
    const feeType = (settings as Record<string, unknown>).fee_type as string;
    const feeAmount = (settings as Record<string, unknown>).fee_amount as number;
    const invoiceTotal = (invoice as Record<string, unknown>).total as number;

    let calculatedFee: number;
    if (feeType === 'percentage') {
      calculatedFee = Math.round(invoiceTotal * (feeAmount / 100) * 100) / 100;
    } else {
      calculatedFee = feeAmount;
    }

    const newTotal = Math.round((invoiceTotal + calculatedFee) * 100) / 100;

    // 5. Update invoice total
    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update({ total: newTotal })
      .eq('id', invoice_id);

    if (updateError) throw updateError;

    // 6. Create late fee record
    const feeRow = {
      user_id,
      invoice_id,
      fee_type: feeType,
      fee_amount: feeAmount,
      calculated_fee: calculatedFee,
      invoice_total_before: invoiceTotal,
      invoice_total_after: newTotal,
      applied_type: applied_type || 'manual',
      reversed: 0,
      applied_at: new Date().toISOString(),
    };

    const { data: feeData, error: feeError } = await supabaseAdmin
      .from('invoice_late_fees')
      .insert(feeRow)
      .select()
      .single();

    if (feeError) throw feeError;

    return NextResponse.json({
      success: true,
      data: feeData,
      calculated_fee: calculatedFee,
      new_total: newTotal,
    }, { status: 201 });
  } catch (error) {
    console.error('Error applying late fee:', error);
    return NextResponse.json({ error: 'Failed to apply late fee' }, { status: 500 });
  }
}

// DELETE /api/invoice-late-fees?id=xxx&user_id=xxx — reverse a late fee
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const userId = request.nextUrl.searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    // Get the fee record
    const { data: fee } = await supabaseAdmin
      .from('invoice_late_fees')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!fee) {
      return NextResponse.json({ error: 'Late fee not found' }, { status: 404 });
    }

    const feeRecord = fee as Record<string, unknown>;
    if (feeRecord.reversed) {
      return NextResponse.json({ error: 'Late fee already reversed' }, { status: 400 });
    }

    // Get current invoice total and subtract the fee
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', feeRecord.invoice_id)
      .single();

    if (invoice) {
      const currentTotal = (invoice as Record<string, unknown>).total as number;
      const calculatedFee = feeRecord.calculated_fee as number;
      const restoredTotal = Math.round((currentTotal - calculatedFee) * 100) / 100;

      await supabaseAdmin
        .from('invoices')
        .update({ total: restoredTotal })
        .eq('id', feeRecord.invoice_id);
    }

    // Mark fee as reversed
    await supabaseAdmin
      .from('invoice_late_fees')
      .update({ reversed: 1 })
      .eq('id', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reversing late fee:', error);
    return NextResponse.json({ error: 'Failed to reverse late fee' }, { status: 500 });
  }
}
