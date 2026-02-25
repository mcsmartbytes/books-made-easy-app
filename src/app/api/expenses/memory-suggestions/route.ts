import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';
import {
  processItemMemories,
  processVendorMemories,
  getMemorySuggestionsForItems,
  normalizeItemName,
  normalizeVendorName,
  ItemMemory,
  VendorMemory,
  MemorySuggestion,
} from '@/lib/moneyMemory';

export const dynamic = 'force-dynamic';

// GET /api/memory-suggestions?user_id=xxx&items=milk,bread&vendor=Whole+Foods
// Returns memory suggestions for specific items
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const itemsParam = searchParams.get('items'); // comma-separated item names
  const vendor = searchParams.get('vendor');
  const mode = searchParams.get('mode') || 'suggestions'; // 'suggestions' | 'all' | 'item' | 'vendor'
  const itemName = searchParams.get('item_name'); // for single item lookup

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Fetch price history for user
    const { data: priceHistory, error } = await supabaseAdmin
      .from('item_price_history')
      .select('item_name, item_name_normalized, unit_price, vendor, vendor_normalized, purchase_date, quantity, unit_of_measure')
      .eq('user_id', userId)
      .order('purchase_date', { ascending: false })
      .limit(1000); // Limit for performance

    if (error) {
      console.error('Error fetching price history:', error);
      return NextResponse.json({ error: 'Failed to fetch price history' }, { status: 500 });
    }

    const priceHistoryList = (priceHistory || []) as any[];
    if (priceHistoryList.length === 0) {
      return NextResponse.json({
        success: true,
        memories: [],
        suggestions: [],
        message: 'No purchase history found',
      });
    }

    // Process into memories
    const itemMemories = processItemMemories(priceHistoryList);
    const vendorMemories = processVendorMemories(priceHistoryList);

    // Handle different modes
    if (mode === 'all') {
      // Return all memories
      return NextResponse.json({
        success: true,
        itemMemories: Object.fromEntries(itemMemories),
        vendorMemories: Object.fromEntries(vendorMemories),
        totalItems: itemMemories.size,
        totalVendors: vendorMemories.size,
      });
    }

    if (mode === 'item' && itemName) {
      // Return memory for a specific item
      const normalized = normalizeItemName(itemName);
      const memory = itemMemories.get(normalized);

      if (!memory) {
        return NextResponse.json({
          success: true,
          memory: null,
          message: `No history found for "${itemName}"`,
        });
      }

      return NextResponse.json({
        success: true,
        memory,
      });
    }

    if (mode === 'vendor' && vendor) {
      // Return memory for a specific vendor
      const normalized = normalizeVendorName(vendor);
      const memory = vendorMemories.get(normalized);

      if (!memory) {
        return NextResponse.json({
          success: true,
          memory: null,
          message: `No history found for vendor "${vendor}"`,
        });
      }

      return NextResponse.json({
        success: true,
        memory,
      });
    }

    // Default: suggestions mode
    // Parse items if provided
    const items: Array<{ itemName: string; unitPrice: number; vendor?: string }> = [];

    if (itemsParam) {
      const itemNames = itemsParam.split(',').map(s => s.trim()).filter(Boolean);
      itemNames.forEach(name => {
        items.push({ itemName: name, unitPrice: 0, vendor: vendor || undefined });
      });
    }

    // Get vendor memory if vendor specified
    let vendorMemory: VendorMemory | undefined;
    if (vendor) {
      const normalized = normalizeVendorName(vendor);
      vendorMemory = vendorMemories.get(normalized);
    }

    // Build response with relevant memories
    const relevantMemories: Record<string, ItemMemory> = {};
    const suggestions: MemorySuggestion[] = [];

    if (items.length > 0) {
      items.forEach(item => {
        const normalized = normalizeItemName(item.itemName);
        const memory = itemMemories.get(normalized);
        if (memory) {
          relevantMemories[normalized] = memory;
        }
      });

      // Get suggestions only if we have price info
      const suggestionsResult = getMemorySuggestionsForItems(items, itemMemories, vendorMemory);
      suggestions.push(...suggestionsResult);
    }

    return NextResponse.json({
      success: true,
      memories: relevantMemories,
      vendorMemory: vendorMemory || null,
      suggestions,
      stats: {
        totalItemsTracked: itemMemories.size,
        totalVendorsTracked: vendorMemories.size,
        matchedItems: Object.keys(relevantMemories).length,
      },
    });
  } catch (error) {
    console.error('Error processing memory suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to process memory suggestions' },
      { status: 500 }
    );
  }
}

// POST /api/memory-suggestions
// Get suggestions for items with prices (more detailed)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, items, vendor } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch price history
    const { data: priceHistory, error } = await supabaseAdmin
      .from('item_price_history')
      .select('item_name, item_name_normalized, unit_price, vendor, vendor_normalized, purchase_date, quantity, unit_of_measure')
      .eq('user_id', user_id)
      .order('purchase_date', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching price history:', error);
      return NextResponse.json({ error: 'Failed to fetch price history' }, { status: 500 });
    }

    const priceHistoryList2 = (priceHistory || []) as any[];
    if (priceHistoryList2.length === 0) {
      return NextResponse.json({
        success: true,
        memories: {},
        suggestions: [],
        totalPotentialSavings: 0,
      });
    }

    // Process memories
    const itemMemories = processItemMemories(priceHistoryList2);
    const vendorMemories = processVendorMemories(priceHistoryList2);

    // Get vendor memory
    let vendorMemory: VendorMemory | undefined;
    if (vendor) {
      const normalized = normalizeVendorName(vendor);
      vendorMemory = vendorMemories.get(normalized);
    }

    // Build detailed response
    const itemDetails: Record<string, {
      memory: ItemMemory | null;
      priceChange: { percentage: number; direction: string } | null;
      savingsOpportunity: number;
    }> = {};

    let totalPotentialSavings = 0;

    items.forEach((item: { itemName: string; unitPrice: number }) => {
      const normalized = normalizeItemName(item.itemName);
      const memory = itemMemories.get(normalized);

      let priceChange: { percentage: number; direction: string } | null = null;
      let savingsOpportunity = 0;

      if (memory) {
        // Calculate price change vs last purchase
        if (memory.lastPurchase && item.unitPrice > 0) {
          const lastPrice = memory.lastPurchase.price;
          const change = ((item.unitPrice - lastPrice) / lastPrice) * 100;
          priceChange = {
            percentage: change,
            direction: change > 1 ? 'up' : change < -1 ? 'down' : 'same',
          };
        }

        // Calculate savings opportunity vs cheapest
        if (memory.cheapest && item.unitPrice > 0) {
          savingsOpportunity = Math.max(0, item.unitPrice - memory.cheapest.price);
          totalPotentialSavings += savingsOpportunity;
        }
      }

      itemDetails[item.itemName] = {
        memory: memory || null,
        priceChange,
        savingsOpportunity,
      };
    });

    // Get suggestions
    const suggestions = getMemorySuggestionsForItems(
      items.map((i: { itemName: string; unitPrice: number }) => ({
        ...i,
        vendor,
      })),
      itemMemories,
      vendorMemory
    );

    return NextResponse.json({
      success: true,
      items: itemDetails,
      vendorMemory: vendorMemory || null,
      suggestions,
      totalPotentialSavings,
      summary: {
        itemsWithHistory: Object.values(itemDetails).filter(d => d.memory !== null).length,
        totalItems: items.length,
        priceIncreases: Object.values(itemDetails).filter(d => d.priceChange?.direction === 'up').length,
        priceDecreases: Object.values(itemDetails).filter(d => d.priceChange?.direction === 'down').length,
      },
    });
  } catch (error) {
    console.error('Error processing memory suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to process memory suggestions' },
      { status: 500 }
    );
  }
}
