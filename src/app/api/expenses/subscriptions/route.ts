import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET - Fetch all subscriptions for a user
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const includePrice = searchParams.get('include_price_history') === 'true';

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Fetch subscriptions
    const { data: subscriptions, error } = await supabaseAdmin
      .from('detected_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .order('confidence', { ascending: false });

    if (error) throw error;

    // Optionally fetch price history
    if (includePrice && subscriptions && subscriptions.length > 0) {
      const subIds = subscriptions.map(s => s.id);
      const { data: priceHistory } = await supabaseAdmin
        .from('subscription_price_history')
        .select('*')
        .in('subscription_id', subIds)
        .order('detected_date', { ascending: true });

      // Attach price history to subscriptions
      const subsWithHistory = subscriptions.map(sub => ({
        ...sub,
        price_history: (priceHistory || []).filter(p => p.subscription_id === sub.id),
      }));

      return NextResponse.json({ success: true, data: subsWithHistory });
    }

    return NextResponse.json({ success: true, data: subscriptions || [] });
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create or update a subscription
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { user_id, vendor, ...subscriptionData } = body;

    if (!user_id || !vendor) {
      return NextResponse.json(
        { success: false, error: 'User ID and vendor are required' },
        { status: 400 }
      );
    }

    const vendor_normalized = vendor.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');

    // Upsert subscription
    const { data, error } = await supabaseAdmin
      .from('detected_subscriptions')
      .upsert(
        {
          user_id,
          vendor,
          vendor_normalized,
          ...subscriptionData,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,vendor_normalized',
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error saving subscription:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update subscription (confirm, dismiss, etc.)
export async function PUT(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('detected_subscriptions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove a subscription
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('detected_subscriptions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
