import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';
import {
  calculatePriceTrend,
  findBiggestIncreases,
  findBiggestDecreases,
  findFrequentItems,
  PriceTrend,
  compareVendorsForItem,
  calculateSavingsOpportunity,
  calculateVendorRankings,
  calculateSavingsSummary,
  ItemVendorComparison,
  SavingsOpportunity,
} from '@/lib/priceTracking';

export const dynamic = 'force-dynamic';

// GET - Fetch price history and trends
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const itemName = searchParams.get('item_name');
    const vendor = searchParams.get('vendor');
    const mode = searchParams.get('mode') || 'history'; // 'history', 'trends', 'alerts'
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabaseAdmin
      .from('item_price_history')
      .select('*')
      .eq('user_id', userId)
      .order('purchase_date', { ascending: false })
      .limit(limit);

    if (itemName) {
      query = query.ilike('item_name_normalized', `%${itemName.toLowerCase()}%`);
    }

    if (vendor) {
      query = query.ilike('vendor_normalized', `%${vendor.toLowerCase()}%`);
    }

    const { data: history, error } = await query;

    if (error) throw error;

    const historyList = (history || []) as any[];

    if (mode === 'history') {
      return NextResponse.json({ success: true, data: historyList });
    }

    // Calculate trends
    if (mode === 'trends') {
      // Group by item name
      const grouped = new Map<string, any[]>();
      for (const item of historyList) {
        const key = item.item_name_normalized;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(item);
      }

      // Calculate trend for each item
      const trends: PriceTrend[] = [];
      Array.from(grouped.entries()).forEach(([itemName, items]) => {
        const trend = calculatePriceTrend(items, itemName);
        if (trend) {
          trends.push(trend);
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          trends,
          biggest_increases: findBiggestIncreases(trends, '30d', 5),
          biggest_decreases: findBiggestDecreases(trends, '30d', 5),
          frequent_items: findFrequentItems(trends, 3, 10),
        },
      });
    }

    // Price alerts
    if (mode === 'alerts') {
      // Get recent purchases (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentHistory } = await supabaseAdmin
        .from('item_price_history')
        .select('*')
        .eq('user_id', userId)
        .gte('purchase_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('purchase_date', { ascending: false });

      const recentHistoryList = (recentHistory || []) as any[];

      // Group all history by item
      const grouped = new Map<string, any[]>();
      for (const item of historyList) {
        const key = item.item_name_normalized;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(item);
      }

      // Find items with significant price changes
      const alerts: any[] = [];
      for (const item of recentHistoryList) {
        const itemHistory = grouped.get(item.item_name_normalized) || [];
        if (itemHistory.length < 2) continue;

        // Get previous price (excluding current)
        const previousItems = itemHistory.filter(
          h => new Date(h.purchase_date) < new Date(item.purchase_date)
        );
        if (previousItems.length === 0) continue;

        const prevPrice = previousItems[0].unit_price;
        const currPrice = item.unit_price;
        const changePct = prevPrice > 0 ? ((currPrice - prevPrice) / prevPrice) * 100 : 0;

        if (Math.abs(changePct) >= 5) {
          alerts.push({
            item_name: item.item_name_normalized,
            vendor: item.vendor,
            current_price: currPrice,
            previous_price: prevPrice,
            change_pct: changePct,
            purchase_date: item.purchase_date,
            severity: Math.abs(changePct) >= 20 ? 'alert' : Math.abs(changePct) >= 10 ? 'warning' : 'info',
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: alerts.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct)),
      });
    }

    // Vendor comparison mode
    if (mode === 'vendor-comparison') {
      // Get all history for comprehensive vendor comparison
      const { data: allHistory, error: historyError } = await supabaseAdmin
        .from('item_price_history')
        .select('*')
        .eq('user_id', userId)
        .order('purchase_date', { ascending: false });

      if (historyError) throw historyError;

      const allHistoryList = (allHistory || []) as any[];

      // Group by item name
      const grouped = new Map<string, any[]>();
      for (const item of allHistoryList) {
        const key = item.item_name_normalized;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(item);
      }

      // Build comparisons and savings opportunities for each item
      const comparisons: ItemVendorComparison[] = [];
      const opportunities: SavingsOpportunity[] = [];

      Array.from(grouped.entries()).forEach(([itemNameNorm, items]) => {
        // Only compare items purchased from multiple vendors
        const uniqueVendors = new Set(items.map(i => i.vendor_normalized));

        if (uniqueVendors.size >= 2) {
          // Get a display name from most recent purchase
          const sorted = [...items].sort(
            (a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
          );
          const displayName = sorted[0].item_name_normalized || itemNameNorm;

          const comparison = compareVendorsForItem(items, displayName);
          if (comparison) {
            comparisons.push(comparison);
          }

          const opportunity = calculateSavingsOpportunity(items, displayName);
          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      });

      // Calculate vendor rankings
      const vendorRankings = calculateVendorRankings(comparisons);

      // Calculate savings summary
      const savingsSummary = calculateSavingsSummary(opportunities);

      return NextResponse.json({
        success: true,
        data: {
          items: comparisons.sort((a, b) => b.price_spread_pct - a.price_spread_pct),
          savings_summary: savingsSummary,
          vendor_rankings: vendorRankings,
        },
      });
    }

    return NextResponse.json({ success: true, data: history || [] });
  } catch (error: any) {
    console.error('Error fetching price history:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Add price history entry (usually done automatically via line-items)
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const { user_id, item_name, vendor, unit_price, quantity, unit_of_measure, purchase_date, expense_id, line_item_id } = body;

    if (!user_id || !item_name || !unit_price || !purchase_date) {
      return NextResponse.json(
        { success: false, error: 'user_id, item_name, unit_price, and purchase_date are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('item_price_history')
      .insert({
        user_id,
        item_name_normalized: item_name.toLowerCase().trim(),
        vendor,
        vendor_normalized: vendor ? vendor.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '') : null,
        unit_price,
        quantity: quantity || 1,
        unit_of_measure: unit_of_measure || 'each',
        purchase_date,
        expense_id,
        line_item_id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error adding price history:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove price history entry
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('item_price_history')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting price history:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
