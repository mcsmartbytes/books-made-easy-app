import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/late-fee-settings?user_id=xxx
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('late_fee_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({
      success: true,
      data: null,
    });
  }
}

// POST /api/late-fee-settings — upsert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, enabled, fee_type, fee_amount, grace_period_days, auto_apply, max_fees_per_invoice } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const row = {
      user_id,
      enabled: enabled ? 1 : 0,
      fee_type: fee_type ?? 'percentage',
      fee_amount: fee_amount ?? 1.5,
      grace_period_days: grace_period_days ?? 5,
      auto_apply: auto_apply ? 1 : 0,
      max_fees_per_invoice: max_fees_per_invoice ?? 3,
    };

    const { data, error } = await supabaseAdmin
      .from('late_fee_settings')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error saving late fee settings:', error);
    return NextResponse.json({ error: 'Failed to save late fee settings' }, { status: 500 });
  }
}
