import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Pattern matching logic (server-side)
function matchesPattern(
  vendor: string,
  pattern: string,
  matchType: 'exact' | 'contains' | 'starts_with'
): boolean {
  const normalizedVendor = vendor.toLowerCase().trim();
  const normalizedPattern = pattern.toLowerCase().trim();

  switch (matchType) {
    case 'exact':
      return normalizedVendor === normalizedPattern;
    case 'starts_with':
      return normalizedVendor.startsWith(normalizedPattern);
    case 'contains':
    default:
      return normalizedVendor.includes(normalizedPattern);
  }
}

// POST - find matching rule for a vendor
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { user_id, vendor } = body;

    if (!user_id || !vendor) {
      return NextResponse.json(
        { success: false, error: 'User ID and vendor are required' },
        { status: 400 }
      );
    }

    // Fetch all active rules for the user
    const { data: rules, error } = await supabaseAdmin
      .from('merchant_rules')
      .select('*, categories(id, name, icon, color)')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('match_count', { ascending: false });

    if (error) throw error;

    const rulesList = (rules || []) as any[];
    if (rulesList.length === 0) {
      return NextResponse.json({
        success: true,
        match: null,
        message: 'No rules found for user',
      });
    }

    // Find first matching rule
    for (const rule of rulesList) {
      if (matchesPattern(vendor, rule.merchant_pattern, rule.match_type)) {
        // Increment match count in background (don't wait)
        supabaseAdmin
          .from('merchant_rules')
          .update({ match_count: rule.match_count + 1 })
          .eq('id', rule.id)
          .then(() => {});

        return NextResponse.json({
          success: true,
          match: {
            rule_id: rule.id,
            category_id: rule.category_id,
            category_name: rule.categories?.name || null,
            category_icon: rule.categories?.icon || null,
            category_color: rule.categories?.color || null,
            is_business: rule.is_business,
            vendor_display_name: rule.vendor_display_name,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      match: null,
      message: 'No matching rule found',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET - check if rule exists for pattern
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const pattern = searchParams.get('pattern');

    if (!userId || !pattern) {
      return NextResponse.json(
        { success: false, error: 'User ID and pattern are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('merchant_rules')
      .select('id')
      .eq('user_id', userId)
      .ilike('merchant_pattern', pattern)
      .limit(1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      exists: data && data.length > 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
