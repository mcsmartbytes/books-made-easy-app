import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/reminder-settings?user_id=xxx
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('reminder_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch {
    // No settings yet — return defaults
    return NextResponse.json({
      success: true,
      data: null,
    });
  }
}

// POST /api/reminder-settings — upsert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, enabled, grace_period_days, frequency_days, max_reminders, default_message } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const row = {
      user_id,
      enabled: enabled ? 1 : 0,
      grace_period_days: grace_period_days ?? 3,
      frequency_days: frequency_days ?? 7,
      max_reminders: max_reminders ?? 3,
      default_message: default_message ?? '',
    };

    const { data, error } = await supabaseAdmin
      .from('reminder_settings')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error saving reminder settings:', error);
    return NextResponse.json({ error: 'Failed to save reminder settings' }, { status: 500 });
  }
}
