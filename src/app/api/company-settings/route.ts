import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

// GET /api/company-settings - Get company settings
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('company_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return NextResponse.json({ success: true, data: data || null });
  } catch (error) {
    console.error('Error fetching company settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST /api/company-settings - Create or update settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, ...settings } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Check if settings exist
    const { data: existing } = await supabaseAdmin
      .from('company_settings')
      .select('id')
      .eq('user_id', user_id)
      .single();

    let data;
    let error;

    if (existing) {
      // Update existing
      const result = await supabaseAdmin
        .from('company_settings')
        .update(settings)
        .eq('user_id', user_id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Create new
      const result = await supabaseAdmin
        .from('company_settings')
        .insert({ user_id, ...settings })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error saving company settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

// PUT /api/company-settings - Update settings (alias for POST)
export async function PUT(request: NextRequest) {
  return POST(request);
}
