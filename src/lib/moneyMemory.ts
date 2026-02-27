// Money Memory System - Help users remember past spending decisions

export interface ItemMemory {
  itemName: string;
  itemNameNormalized: string;
  lastPurchase: {
    price: number;
    vendor: string;
    date: string;
    quantity: number;
    unitOfMeasure: string | null;
  } | null;
  cheapest: {
    price: number;
    vendor: string;
    date: string;
  } | null;
  mostExpensive: {
    price: number;
    vendor: string;
    date: string;
  } | null;
  averagePrice: number;
  totalPurchases: number;
  potentialSavings: number; // Compared to cheapest
  priceVariance: number; // Standard deviation percentage
  allVendors: Array<{
    vendor: string;
    avgPrice: number;
    purchaseCount: number;
    lastDate: string;
  }>;
}

export interface VendorMemory {
  vendor: string;
  vendorNormalized: string;
  totalVisits: number;
  avgSpendPerVisit: number;
  lastVisit: string;
  commonItems: string[];
  priceComparison: 'cheaper' | 'average' | 'expensive';
  percentVsAverage: number; // +15 means 15% more expensive than user's average
}

export interface MemorySuggestion {
  type: 'price_alert' | 'vendor_suggestion' | 'savings_tip' | 'spending_pattern';
  priority: 'high' | 'medium' | 'low';
  message: string;
  details: {
    itemName?: string;
    currentPrice?: number;
    comparisonPrice?: number;
    savings?: number;
    suggestedVendor?: string;
  };
}

// Normalize item names for matching
export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(organic|fresh|premium|regular|large|small|medium|pack|pkg|ct|oz|lb|kg|g|ml|l)\b/gi, '')
    .trim();
}

// Normalize vendor names for matching
export function normalizeVendorName(vendor: string): string {
  return vendor
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(inc|llc|corp|store|market|shop|grocery)\b/gi, '')
    .trim();
}

// Format price for display
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

// Format date for display
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Calculate price change percentage
export function calculatePriceChange(currentPrice: number, previousPrice: number): {
  percentage: number;
  direction: 'up' | 'down' | 'same';
  formatted: string;
} {
  if (previousPrice === 0) {
    return { percentage: 0, direction: 'same', formatted: 'N/A' };
  }

  const change = ((currentPrice - previousPrice) / previousPrice) * 100;
  const direction = change > 1 ? 'up' : change < -1 ? 'down' : 'same';
  const formatted = `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;

  return { percentage: change, direction, formatted };
}

// Generate memory message for an item
export function generateItemMemoryMessage(memory: ItemMemory, currentPrice?: number): string {
  if (!memory.lastPurchase) {
    return `First time buying ${memory.itemName}`;
  }

  const lastPrice = memory.lastPurchase.price;
  const lastVendor = memory.lastPurchase.vendor;
  const lastDate = formatDate(memory.lastPurchase.date);

  if (currentPrice !== undefined) {
    const change = calculatePriceChange(currentPrice, lastPrice);
    if (change.direction === 'up') {
      return `${change.formatted} vs ${formatPrice(lastPrice)} at ${lastVendor} (${lastDate})`;
    } else if (change.direction === 'down') {
      return `${change.formatted} vs ${formatPrice(lastPrice)} at ${lastVendor} (${lastDate})`;
    }
  }

  return `Last: ${formatPrice(lastPrice)} at ${lastVendor} (${lastDate})`;
}

// Generate savings suggestion
export function generateSavingsSuggestion(memory: ItemMemory, currentPrice?: number, currentVendor?: string): MemorySuggestion | null {
  if (!memory.cheapest || memory.totalPurchases < 2) {
    return null;
  }

  const priceToCompare = currentPrice ?? memory.lastPurchase?.price ?? 0;
  const cheapestPrice = memory.cheapest.price;
  const savings = priceToCompare - cheapestPrice;

  // Don't suggest if we're already at the cheapest vendor
  if (currentVendor && normalizeVendorName(currentVendor) === normalizeVendorName(memory.cheapest.vendor)) {
    return null;
  }

  // Only suggest if savings is significant (>5%)
  const savingsPercent = (savings / priceToCompare) * 100;
  if (savingsPercent < 5) {
    return null;
  }

  return {
    type: 'savings_tip',
    priority: savingsPercent > 15 ? 'high' : savingsPercent > 10 ? 'medium' : 'low',
    message: `You could save ${formatPrice(savings)} buying at ${memory.cheapest.vendor}`,
    details: {
      itemName: memory.itemName,
      currentPrice: priceToCompare,
      comparisonPrice: cheapestPrice,
      savings,
      suggestedVendor: memory.cheapest.vendor,
    },
  };
}

// Generate vendor comparison suggestion
export function generateVendorSuggestion(vendorMemory: VendorMemory): MemorySuggestion | null {
  if (vendorMemory.totalVisits < 3) {
    return null;
  }

  if (vendorMemory.priceComparison === 'expensive' && vendorMemory.percentVsAverage > 10) {
    return {
      type: 'vendor_suggestion',
      priority: vendorMemory.percentVsAverage > 20 ? 'high' : 'medium',
      message: `${vendorMemory.vendor} is typically ${vendorMemory.percentVsAverage.toFixed(0)}% more expensive than your average`,
      details: {},
    };
  }

  if (vendorMemory.priceComparison === 'cheaper' && vendorMemory.percentVsAverage < -10) {
    return {
      type: 'vendor_suggestion',
      priority: 'low',
      message: `${vendorMemory.vendor} is typically ${Math.abs(vendorMemory.percentVsAverage).toFixed(0)}% cheaper than your average`,
      details: {},
    };
  }

  return null;
}

// Process price history data into item memories
export function processItemMemories(
  priceHistory: Array<{
    item_name: string;
    item_name_normalized: string;
    unit_price: number;
    vendor: string;
    purchase_date: string;
    quantity: number;
    unit_of_measure: string | null;
  }>
): Map<string, ItemMemory> {
  const memories = new Map<string, ItemMemory>();

  // Group by normalized item name
  const itemGroups = new Map<string, typeof priceHistory>();
  priceHistory.forEach(item => {
    const normalized = item.item_name_normalized || normalizeItemName(item.item_name);
    if (!itemGroups.has(normalized)) {
      itemGroups.set(normalized, []);
    }
    itemGroups.get(normalized)!.push(item);
  });

  // Process each group
  itemGroups.forEach((items, normalizedName) => {
    // Sort by date descending
    items.sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());

    const latest = items[0];
    const prices = items.map(i => i.unit_price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    // Find cheapest and most expensive
    let cheapest = items[0];
    let mostExpensive = items[0];
    items.forEach(item => {
      if (item.unit_price < cheapest.unit_price) cheapest = item;
      if (item.unit_price > mostExpensive.unit_price) mostExpensive = item;
    });

    // Calculate price variance
    const variance = prices.length > 1
      ? Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length)
      : 0;
    const variancePercent = avgPrice > 0 ? (variance / avgPrice) * 100 : 0;

    // Group by vendor
    const vendorGroups = new Map<string, typeof items>();
    items.forEach(item => {
      const vendorNorm = normalizeVendorName(item.vendor);
      if (!vendorGroups.has(vendorNorm)) {
        vendorGroups.set(vendorNorm, []);
      }
      vendorGroups.get(vendorNorm)!.push(item);
    });

    const allVendors = Array.from(vendorGroups.entries()).map(([_vendorNorm, vendorItems]) => {
      const vendorPrices = vendorItems.map(i => i.unit_price);
      return {
        vendor: vendorItems[0].vendor, // Use original vendor name
        avgPrice: vendorPrices.reduce((a, b) => a + b, 0) / vendorPrices.length,
        purchaseCount: vendorItems.length,
        lastDate: vendorItems[0].purchase_date,
      };
    }).sort((a, b) => a.avgPrice - b.avgPrice);

    const memory: ItemMemory = {
      itemName: latest.item_name,
      itemNameNormalized: normalizedName,
      lastPurchase: {
        price: latest.unit_price,
        vendor: latest.vendor,
        date: latest.purchase_date,
        quantity: latest.quantity,
        unitOfMeasure: latest.unit_of_measure,
      },
      cheapest: {
        price: cheapest.unit_price,
        vendor: cheapest.vendor,
        date: cheapest.purchase_date,
      },
      mostExpensive: {
        price: mostExpensive.unit_price,
        vendor: mostExpensive.vendor,
        date: mostExpensive.purchase_date,
      },
      averagePrice: avgPrice,
      totalPurchases: items.length,
      potentialSavings: latest.unit_price - cheapest.unit_price,
      priceVariance: variancePercent,
      allVendors,
    };

    memories.set(normalizedName, memory);
  });

  return memories;
}

// Process price history into vendor memories
export function processVendorMemories(
  priceHistory: Array<{
    vendor: string;
    unit_price: number;
    quantity: number;
    purchase_date: string;
    item_name: string;
  }>
): Map<string, VendorMemory> {
  const memories = new Map<string, VendorMemory>();

  // Calculate overall average price per item
  const allPrices = priceHistory.map(p => p.unit_price);
  const overallAvg = allPrices.length > 0
    ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length
    : 0;

  // Group by vendor
  const vendorGroups = new Map<string, typeof priceHistory>();
  priceHistory.forEach(item => {
    const vendorNorm = normalizeVendorName(item.vendor);
    if (!vendorGroups.has(vendorNorm)) {
      vendorGroups.set(vendorNorm, []);
    }
    vendorGroups.get(vendorNorm)!.push(item);
  });

  // Process each vendor
  vendorGroups.forEach((items, vendorNorm) => {
    items.sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());

    const vendorPrices = items.map(i => i.unit_price);
    const vendorAvg = vendorPrices.reduce((a, b) => a + b, 0) / vendorPrices.length;

    // Calculate percent vs overall average
    const percentVsAvg = overallAvg > 0 ? ((vendorAvg - overallAvg) / overallAvg) * 100 : 0;

    // Get common items
    const itemCounts = new Map<string, number>();
    items.forEach(i => {
      const itemNorm = normalizeItemName(i.item_name);
      itemCounts.set(itemNorm, (itemCounts.get(itemNorm) || 0) + 1);
    });
    const commonItems = Array.from(itemCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const memory: VendorMemory = {
      vendor: items[0].vendor,
      vendorNormalized: vendorNorm,
      totalVisits: items.length,
      avgSpendPerVisit: vendorAvg,
      lastVisit: items[0].purchase_date,
      commonItems,
      priceComparison: percentVsAvg > 5 ? 'expensive' : percentVsAvg < -5 ? 'cheaper' : 'average',
      percentVsAverage: percentVsAvg,
    };

    memories.set(vendorNorm, memory);
  });

  return memories;
}

// Get memory suggestions for a list of items
export function getMemorySuggestionsForItems(
  items: Array<{ itemName: string; unitPrice: number; vendor?: string }>,
  itemMemories: Map<string, ItemMemory>,
  vendorMemory?: VendorMemory
): MemorySuggestion[] {
  const suggestions: MemorySuggestion[] = [];

  items.forEach(item => {
    const normalized = normalizeItemName(item.itemName);
    const memory = itemMemories.get(normalized);

    if (memory) {
      // Check for savings suggestions
      const savingsTip = generateSavingsSuggestion(memory, item.unitPrice, item.vendor);
      if (savingsTip) {
        suggestions.push(savingsTip);
      }

      // Check for significant price increase
      if (memory.lastPurchase) {
        const change = calculatePriceChange(item.unitPrice, memory.lastPurchase.price);
        if (change.direction === 'up' && change.percentage > 10) {
          suggestions.push({
            type: 'price_alert',
            priority: change.percentage > 25 ? 'high' : 'medium',
            message: `${item.itemName} is ${change.formatted} more than last time (${formatPrice(memory.lastPurchase.price)})`,
            details: {
              itemName: item.itemName,
              currentPrice: item.unitPrice,
              comparisonPrice: memory.lastPurchase.price,
            },
          });
        }
      }
    }
  });

  // Add vendor suggestion if applicable
  if (vendorMemory) {
    const vendorTip = generateVendorSuggestion(vendorMemory);
    if (vendorTip) {
      suggestions.push(vendorTip);
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return suggestions;
}
