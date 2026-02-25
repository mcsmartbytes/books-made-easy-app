import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';
import {
  detectSubscriptions,
  detectPriceChanges,
  calculateMonthlyCost,
  findDuplicates,
} from '@/lib/subscriptionDetection';

export const dynamic = 'force-dynamic';

// POST - Run subscription detection on user's expenses
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { user_id, lookback_months = 12 } = body;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Calculate lookback date
    const lookbackDate = new Date();
    lookbackDate.setMonth(lookbackDate.getMonth() - lookback_months);
    const lookbackStr = lookbackDate.toISOString().split('T')[0];

    // Fetch expenses with vendor info
    const { data: expenses, error: expError } = await supabaseAdmin
      .from('expenses')
      .select(`
        id,
        vendor,
        amount,
        date,
        category_id,
        categories(name)
      `)
      .eq('user_id', user_id)
      .not('vendor', 'is', null)
      .gte('date', lookbackStr)
      .order('date', { ascending: true });

    if (expError) throw expError;

    if (!expenses || expenses.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          detected: 0,
          subscriptions: [],
          duplicates: [],
          total_monthly: 0,
        },
      });
    }

    // Transform expenses for detection
    const expensesForDetection = expenses.map((e: any) => ({
      id: e.id,
      vendor: e.vendor,
      amount: parseFloat(e.amount),
      date: e.date,
      category_id: e.category_id,
      category_name: e.categories?.name,
    }));

    // Run detection
    const detectedSubs = detectSubscriptions(expensesForDetection);

    // Fetch existing subscriptions to preserve user confirmations
    const { data: existingSubs } = await supabaseAdmin
      .from('detected_subscriptions')
      .select('vendor_normalized, is_confirmed, is_dismissed')
      .eq('user_id', user_id);

    const existingMap = new Map(
      (existingSubs || []).map(s => [s.vendor_normalized, s])
    );

    // Upsert detected subscriptions
    const upsertResults: any[] = [];

    for (const sub of detectedSubs) {
      const existing = existingMap.get(sub.vendor_normalized);

      // Skip if user dismissed this vendor
      if (existing?.is_dismissed) continue;

      const { data: upserted, error: upsertError } = await supabaseAdmin
        .from('detected_subscriptions')
        .upsert(
          {
            user_id,
            vendor: sub.vendor,
            vendor_normalized: sub.vendor_normalized,
            avg_amount: sub.avg_amount,
            min_amount: sub.min_amount,
            max_amount: sub.max_amount,
            frequency: sub.frequency,
            confidence: sub.confidence,
            first_seen: sub.first_seen,
            last_seen: sub.last_seen,
            next_expected: sub.next_expected,
            occurrence_count: sub.occurrence_count,
            category_id: sub.category_id,
            category_name: sub.category_name,
            is_confirmed: existing?.is_confirmed || false,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,vendor_normalized',
          }
        )
        .select()
        .single();

      if (!upsertError && upserted) {
        const upsertedRecord = upserted as any;
        upsertResults.push(upsertedRecord);

        // Track price changes
        const priceChanges = detectPriceChanges(sub);

        for (const change of priceChanges) {
          // Find the expense ID for this date
          const expenseMatch = sub.expense_ids[sub.dates.indexOf(change.detected_date)];

          await supabaseAdmin.from('subscription_price_history').upsert(
            {
              subscription_id: upsertedRecord.id,
              user_id,
              amount: change.new_amount,
              detected_date: change.detected_date,
              expense_id: expenseMatch || null,
              price_change: change.change,
              price_change_pct: change.change_pct,
            },
            {
              onConflict: 'subscription_id,detected_date',
              ignoreDuplicates: true,
            }
          );
        }
      }
    }

    // Find duplicates
    const duplicates = findDuplicates(detectedSubs, []);

    // Calculate total monthly cost
    const totalMonthly = detectedSubs.reduce(
      (sum, sub) => sum + calculateMonthlyCost(sub),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        detected: upsertResults.length,
        subscriptions: upsertResults,
        duplicates,
        total_monthly: totalMonthly,
      },
    });
  } catch (error: any) {
    console.error('Error detecting subscriptions:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET - Get detection summary without saving
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const lookbackMonths = parseInt(searchParams.get('lookback_months') || '12');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Calculate lookback date
    const lookbackDate = new Date();
    lookbackDate.setMonth(lookbackDate.getMonth() - lookbackMonths);
    const lookbackStr = lookbackDate.toISOString().split('T')[0];

    // Fetch expenses
    const { data: expenses, error } = await supabaseAdmin
      .from('expenses')
      .select('id, vendor, amount, date, category_id, categories(name)')
      .eq('user_id', userId)
      .not('vendor', 'is', null)
      .gte('date', lookbackStr)
      .order('date', { ascending: true });

    if (error) throw error;

    if (!expenses || expenses.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          detected: 0,
          preview: [],
          total_monthly: 0,
        },
      });
    }

    // Transform and detect
    const expensesForDetection = expenses.map((e: any) => ({
      id: e.id,
      vendor: e.vendor,
      amount: parseFloat(e.amount),
      date: e.date,
      category_id: e.category_id,
      category_name: e.categories?.name,
    }));

    const detectedSubs = detectSubscriptions(expensesForDetection);

    // Calculate total monthly
    const totalMonthly = detectedSubs.reduce(
      (sum, sub) => sum + calculateMonthlyCost(sub),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        detected: detectedSubs.length,
        preview: detectedSubs.slice(0, 10), // Preview first 10
        total_monthly: totalMonthly,
        duplicates: findDuplicates(detectedSubs, []),
      },
    });
  } catch (error: any) {
    console.error('Error previewing subscriptions:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
