// Price Tracking Utilities
// Track item prices over time and detect changes

export interface PriceHistoryEntry {
  id: string;
  item_name_normalized: string;
  vendor: string;
  vendor_normalized: string;
  unit_price: number;
  quantity: number;
  unit_of_measure: string;
  purchase_date: string;
  expense_id: string;
  line_item_id: string;
}

export interface PriceTrend {
  item_name: string;
  item_name_normalized: string;
  current_price: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  price_change_30d: number;
  price_change_90d: number;
  purchase_count: number;
  last_purchase: string;
  vendors: string[];
}

export interface PriceAlert {
  id: string;
  item_name: string;
  vendor: string;
  old_price: number;
  new_price: number;
  change_amount: number;
  change_pct: number;
  purchase_date: string;
  severity: 'info' | 'warning' | 'alert';
}

// Calculate price trend from history
export function calculatePriceTrend(
  history: PriceHistoryEntry[],
  itemName: string
): PriceTrend | null {
  if (history.length === 0) return null;

  // Sort by date descending
  const sorted = [...history].sort(
    (a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
  );

  const prices = sorted.map(h => h.unit_price);
  const currentPrice = prices[0];
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Calculate 30-day change
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oldPrices30d = sorted.filter(
    h => new Date(h.purchase_date) <= thirtyDaysAgo
  );
  const price30dAgo = oldPrices30d.length > 0 ? oldPrices30d[0].unit_price : currentPrice;
  const priceChange30d = price30dAgo > 0
    ? ((currentPrice - price30dAgo) / price30dAgo) * 100
    : 0;

  // Calculate 90-day change
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const oldPrices90d = sorted.filter(
    h => new Date(h.purchase_date) <= ninetyDaysAgo
  );
  const price90dAgo = oldPrices90d.length > 0 ? oldPrices90d[0].unit_price : currentPrice;
  const priceChange90d = price90dAgo > 0
    ? ((currentPrice - price90dAgo) / price90dAgo) * 100
    : 0;

  // Get unique vendors
  const vendors = Array.from(new Set(sorted.map(h => h.vendor).filter(Boolean)));

  return {
    item_name: itemName,
    item_name_normalized: sorted[0].item_name_normalized,
    current_price: currentPrice,
    avg_price: avgPrice,
    min_price: minPrice,
    max_price: maxPrice,
    price_change_30d: priceChange30d,
    price_change_90d: priceChange90d,
    purchase_count: sorted.length,
    last_purchase: sorted[0].purchase_date,
    vendors,
  };
}

// Compare current price to previous purchases
export function compareToPrevious(
  currentPrice: number,
  history: PriceHistoryEntry[],
  sameVendorOnly: boolean = false,
  vendor?: string
): { previous: PriceHistoryEntry | null; change: number; changePct: number } {
  if (history.length === 0) {
    return { previous: null, change: 0, changePct: 0 };
  }

  // Filter by vendor if requested
  let filtered = history;
  if (sameVendorOnly && vendor) {
    const vendorNorm = vendor.toLowerCase().trim();
    filtered = history.filter(h =>
      h.vendor_normalized === vendorNorm || h.vendor.toLowerCase().includes(vendorNorm)
    );
  }

  if (filtered.length === 0) {
    return { previous: null, change: 0, changePct: 0 };
  }

  // Get most recent previous purchase
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
  );

  const previous = sorted[0];
  const change = currentPrice - previous.unit_price;
  const changePct = previous.unit_price > 0
    ? (change / previous.unit_price) * 100
    : 0;

  return { previous, change, changePct };
}

// Generate price alerts for significant changes
export function generatePriceAlerts(
  currentItems: { item_name: string; unit_price: number; vendor: string; purchase_date: string }[],
  history: Map<string, PriceHistoryEntry[]>,
  threshold: number = 5 // 5% threshold for alerts
): PriceAlert[] {
  const alerts: PriceAlert[] = [];

  for (const item of currentItems) {
    const itemHistory = history.get(item.item_name.toLowerCase().trim()) || [];

    if (itemHistory.length === 0) continue;

    const comparison = compareToPrevious(item.unit_price, itemHistory, false);

    if (comparison.previous && Math.abs(comparison.changePct) >= threshold) {
      const severity = Math.abs(comparison.changePct) >= 20
        ? 'alert'
        : Math.abs(comparison.changePct) >= 10
          ? 'warning'
          : 'info';

      alerts.push({
        id: `${item.item_name}-${item.purchase_date}`,
        item_name: item.item_name,
        vendor: item.vendor,
        old_price: comparison.previous.unit_price,
        new_price: item.unit_price,
        change_amount: comparison.change,
        change_pct: comparison.changePct,
        purchase_date: item.purchase_date,
        severity,
      });
    }
  }

  // Sort by absolute change percentage (highest first)
  return alerts.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
}

// Find items with biggest price increases
export function findBiggestIncreases(
  trends: PriceTrend[],
  period: '30d' | '90d' = '30d',
  limit: number = 10
): PriceTrend[] {
  const changeKey = period === '30d' ? 'price_change_30d' : 'price_change_90d';

  return [...trends]
    .filter(t => t[changeKey] > 0)
    .sort((a, b) => b[changeKey] - a[changeKey])
    .slice(0, limit);
}

// Find items with biggest price decreases (savings opportunities)
export function findBiggestDecreases(
  trends: PriceTrend[],
  period: '30d' | '90d' = '30d',
  limit: number = 10
): PriceTrend[] {
  const changeKey = period === '30d' ? 'price_change_30d' : 'price_change_90d';

  return [...trends]
    .filter(t => t[changeKey] < 0)
    .sort((a, b) => a[changeKey] - b[changeKey])
    .slice(0, limit);
}

// Find frequently purchased items
export function findFrequentItems(
  trends: PriceTrend[],
  minPurchases: number = 3,
  limit: number = 10
): PriceTrend[] {
  return [...trends]
    .filter(t => t.purchase_count >= minPurchases)
    .sort((a, b) => b.purchase_count - a.purchase_count)
    .slice(0, limit);
}

// Calculate total spent on an item over time
export function calculateTotalSpent(history: PriceHistoryEntry[]): number {
  return history.reduce((sum, h) => sum + (h.unit_price * h.quantity), 0);
}

// Find best price for an item (lowest price and where)
export function findBestPrice(
  history: PriceHistoryEntry[]
): { price: number; vendor: string; date: string } | null {
  if (history.length === 0) return null;

  const sorted = [...history].sort((a, b) => a.unit_price - b.unit_price);
  const best = sorted[0];

  return {
    price: best.unit_price,
    vendor: best.vendor,
    date: best.purchase_date,
  };
}

// Format price change for display
export function formatPriceChange(change: number, pct: number): string {
  const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
  const _color = pct > 0 ? 'text-red-500' : pct < 0 ? 'text-green-500' : 'text-gray-500';
  const absChange = Math.abs(change);
  const absPct = Math.abs(pct);

  return `${arrow} $${absChange.toFixed(2)} (${absPct.toFixed(1)}%)`;
}

// ============================================
// Vendor Comparison Types and Functions
// ============================================

export interface VendorPriceData {
  vendor: string;
  vendor_normalized: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  purchase_count: number;
  last_purchase: string;
  total_spent: number;
}

export interface ItemVendorComparison {
  item_name: string;
  item_name_normalized: string;
  vendors: VendorPriceData[];
  best_vendor: VendorPriceData | null;
  worst_vendor: VendorPriceData | null;
  price_spread: number; // Difference between highest and lowest avg price
  price_spread_pct: number; // Percentage difference
  total_purchases: number;
}

export interface SavingsOpportunity {
  item_name: string;
  item_name_normalized: string;
  total_spent: number;
  optimal_spend: number; // If always bought at best price
  overpaid_amount: number;
  overpaid_pct: number;
  best_vendor: string;
  best_price: number;
  worst_vendor: string;
  worst_price: number;
  recommendation: string;
}

export interface VendorRanking {
  vendor: string;
  vendor_normalized: string;
  items_with_best_price: number;
  items_with_worst_price: number;
  total_items_tracked: number;
  avg_price_rank: number; // 1 = best prices on average
  potential_savings_if_switched: number;
  total_purchases: number;
}

// Get prices for an item grouped by vendor
export function getVendorPricesForItem(
  history: PriceHistoryEntry[]
): VendorPriceData[] {
  if (history.length === 0) return [];

  // Group by vendor_normalized
  const vendorMap = new Map<string, PriceHistoryEntry[]>();

  for (const entry of history) {
    const key = entry.vendor_normalized || entry.vendor.toLowerCase().trim();
    if (!vendorMap.has(key)) {
      vendorMap.set(key, []);
    }
    vendorMap.get(key)!.push(entry);
  }

  const vendorData: VendorPriceData[] = [];

  Array.from(vendorMap.entries()).forEach(([vendorNorm, entries]) => {
    const prices = entries.map(e => e.unit_price);
    const sorted = [...entries].sort(
      (a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
    );

    vendorData.push({
      vendor: sorted[0].vendor, // Use most recent vendor name
      vendor_normalized: vendorNorm,
      avg_price: prices.reduce((a, b) => a + b, 0) / prices.length,
      min_price: Math.min(...prices),
      max_price: Math.max(...prices),
      purchase_count: entries.length,
      last_purchase: sorted[0].purchase_date,
      total_spent: entries.reduce((sum, e) => sum + (e.unit_price * e.quantity), 0),
    });
  });

  // Sort by avg_price ascending (best prices first)
  return vendorData.sort((a, b) => a.avg_price - b.avg_price);
}

// Compare vendors for a specific item
export function compareVendorsForItem(
  history: PriceHistoryEntry[],
  itemName: string
): ItemVendorComparison | null {
  if (history.length === 0) return null;

  const vendors = getVendorPricesForItem(history);

  if (vendors.length === 0) return null;

  const bestVendor = vendors[0]; // Already sorted by avg_price ascending
  const worstVendor = vendors[vendors.length - 1];

  const priceSpread = vendors.length > 1
    ? worstVendor.avg_price - bestVendor.avg_price
    : 0;

  const priceSpreadPct = bestVendor.avg_price > 0 && vendors.length > 1
    ? (priceSpread / bestVendor.avg_price) * 100
    : 0;

  return {
    item_name: itemName,
    item_name_normalized: history[0].item_name_normalized,
    vendors,
    best_vendor: vendors.length > 0 ? bestVendor : null,
    worst_vendor: vendors.length > 1 ? worstVendor : null,
    price_spread: priceSpread,
    price_spread_pct: priceSpreadPct,
    total_purchases: history.length,
  };
}

// Calculate savings opportunity for an item
export function calculateSavingsOpportunity(
  history: PriceHistoryEntry[],
  itemName: string
): SavingsOpportunity | null {
  if (history.length < 2) return null;

  const vendors = getVendorPricesForItem(history);

  if (vendors.length < 2) return null;

  const bestVendor = vendors[0];
  const worstVendor = vendors[vendors.length - 1];

  // Calculate total actually spent
  const totalSpent = history.reduce((sum, e) => sum + (e.unit_price * e.quantity), 0);

  // Calculate what would have been spent if always bought at best vendor's avg price
  const totalQuantity = history.reduce((sum, e) => sum + e.quantity, 0);
  const optimalSpend = bestVendor.avg_price * totalQuantity;

  const overpaidAmount = totalSpent - optimalSpend;
  const overpaidPct = optimalSpend > 0 ? (overpaidAmount / optimalSpend) * 100 : 0;

  // Only return if there's meaningful savings
  if (overpaidAmount < 0.50) return null;

  // Calculate how much cheaper at best vendor
  const priceDiffPct = ((worstVendor.avg_price - bestVendor.avg_price) / worstVendor.avg_price) * 100;

  // Create impactful recommendation message
  let recommendation: string;
  if (overpaidAmount >= 10) {
    recommendation = `You've overpaid $${overpaidAmount.toFixed(2)} on this item. ${bestVendor.vendor} is ${priceDiffPct.toFixed(0)}% cheaper!`;
  } else if (priceDiffPct >= 15) {
    recommendation = `This item is ${priceDiffPct.toFixed(0)}% cheaper at ${bestVendor.vendor}`;
  } else if (priceDiffPct >= 10) {
    recommendation = `Save ${priceDiffPct.toFixed(0)}% by shopping at ${bestVendor.vendor} instead of ${worstVendor.vendor}`;
  } else {
    recommendation = `${bestVendor.vendor} has slightly better prices ($${(worstVendor.avg_price - bestVendor.avg_price).toFixed(2)} less)`;
  }

  return {
    item_name: itemName,
    item_name_normalized: history[0].item_name_normalized,
    total_spent: totalSpent,
    optimal_spend: optimalSpend,
    overpaid_amount: overpaidAmount,
    overpaid_pct: overpaidPct,
    best_vendor: bestVendor.vendor,
    best_price: bestVendor.avg_price,
    worst_vendor: worstVendor.vendor,
    worst_price: worstVendor.avg_price,
    recommendation,
  };
}

// Calculate vendor rankings across all items
export function calculateVendorRankings(
  comparisons: ItemVendorComparison[]
): VendorRanking[] {
  if (comparisons.length === 0) return [];

  // Track stats per vendor
  const vendorStats = new Map<string, {
    vendor: string;
    vendor_normalized: string;
    best_count: number;
    worst_count: number;
    total_items: number;
    price_ranks: number[];
    total_purchases: number;
    potential_savings: number;
  }>();

  for (const comparison of comparisons) {
    if (comparison.vendors.length === 0) continue;

    // For each vendor in this comparison, track their rank
    comparison.vendors.forEach((v, index) => {
      const key = v.vendor_normalized;

      if (!vendorStats.has(key)) {
        vendorStats.set(key, {
          vendor: v.vendor,
          vendor_normalized: key,
          best_count: 0,
          worst_count: 0,
          total_items: 0,
          price_ranks: [],
          total_purchases: 0,
          potential_savings: 0,
        });
      }

      const stats = vendorStats.get(key)!;
      stats.total_items++;
      stats.price_ranks.push(index + 1); // 1-based rank
      stats.total_purchases += v.purchase_count;

      // Track best/worst
      if (index === 0) {
        stats.best_count++;
      }
      if (index === comparison.vendors.length - 1 && comparison.vendors.length > 1) {
        stats.worst_count++;
        // Calculate potential savings if switched to best vendor
        const bestPrice = comparison.best_vendor?.avg_price || v.avg_price;
        stats.potential_savings += (v.avg_price - bestPrice) * v.purchase_count;
      }
    });
  }

  // Convert to array and calculate avg rank
  const rankings: VendorRanking[] = [];

  Array.from(vendorStats.values()).forEach((stats) => {
    const avgRank = stats.price_ranks.length > 0
      ? stats.price_ranks.reduce((a, b) => a + b, 0) / stats.price_ranks.length
      : 0;

    rankings.push({
      vendor: stats.vendor,
      vendor_normalized: stats.vendor_normalized,
      items_with_best_price: stats.best_count,
      items_with_worst_price: stats.worst_count,
      total_items_tracked: stats.total_items,
      avg_price_rank: avgRank,
      potential_savings_if_switched: stats.potential_savings,
      total_purchases: stats.total_purchases,
    });
  });

  // Sort by avg_price_rank (lower is better)
  return rankings.sort((a, b) => a.avg_price_rank - b.avg_price_rank);
}

// Calculate total savings summary
export function calculateSavingsSummary(
  opportunities: SavingsOpportunity[]
): {
  total_overpaid_ytd: number;
  potential_annual_savings: number;
  top_opportunities: SavingsOpportunity[];
} {
  const totalOverpaid = opportunities.reduce((sum, o) => sum + o.overpaid_amount, 0);

  // Estimate annual savings based on current overpaid amount
  // Assuming data represents typical spending patterns
  const potentialAnnualSavings = totalOverpaid;

  // Top opportunities sorted by overpaid amount
  const topOpportunities = [...opportunities]
    .sort((a, b) => b.overpaid_amount - a.overpaid_amount)
    .slice(0, 5);

  return {
    total_overpaid_ytd: totalOverpaid,
    potential_annual_savings: potentialAnnualSavings,
    top_opportunities: topOpportunities,
  };
}
