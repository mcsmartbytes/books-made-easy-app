// Line Items Processing Utilities

export interface LineItem {
  id?: string;
  item_name: string;
  item_name_normalized?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  unit_of_measure?: string;
  is_taxable?: boolean;
  sort_order?: number;
  // Category support for item-level learning
  category_id?: string | null;
  is_business?: boolean;
}

export interface OCRLineItem {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  unit?: string;
}

export interface PriceComparison {
  item_name: string;
  current_price: number;
  previous_price: number;
  price_change: number;
  price_change_pct: number;
  previous_date: string;
  previous_vendor?: string;
}

// Normalize item name for matching
export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

// Normalize vendor name
export function normalizeVendor(vendor: string): string {
  return vendor
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

// Convert OCR line items to database format
export function convertOCRLineItems(
  ocrItems: OCRLineItem[],
  _expenseId: string,
  _userId: string
): LineItem[] {
  return ocrItems.map((item, index) => ({
    item_name: item.name,
    item_name_normalized: normalizeItemName(item.name),
    quantity: item.quantity || 1,
    unit_price: item.unit_price || 0,
    line_total: item.line_total || item.unit_price * (item.quantity || 1),
    unit_of_measure: item.unit || 'each',
    is_taxable: true,
    sort_order: index,
  }));
}

// Calculate line total from quantity and unit price
export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

// Validate line items total matches expense amount (within tolerance)
export function validateLineItemsTotal(
  lineItems: LineItem[],
  expenseTotal: number,
  tolerance: number = 0.10 // 10 cents
): { valid: boolean; itemsTotal: number; difference: number } {
  const itemsTotal = lineItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const difference = Math.abs(itemsTotal - expenseTotal);
  return {
    valid: difference <= tolerance,
    itemsTotal,
    difference,
  };
}

// Parse common unit abbreviations
export function parseUnit(unitStr: string): string {
  const unitMap: Record<string, string> = {
    'ea': 'each',
    'pc': 'each',
    'pcs': 'each',
    'lb': 'lb',
    'lbs': 'lb',
    'oz': 'oz',
    'gal': 'gal',
    'gallon': 'gal',
    'gallons': 'gal',
    'kg': 'kg',
    'g': 'g',
    'gram': 'g',
    'grams': 'g',
    'l': 'L',
    'liter': 'L',
    'liters': 'L',
    'ml': 'mL',
    'ct': 'count',
    'count': 'count',
    'pack': 'pack',
    'pk': 'pack',
    'box': 'box',
    'case': 'case',
    'dz': 'dozen',
    'dozen': 'dozen',
  };

  const normalized = unitStr.toLowerCase().trim();
  return unitMap[normalized] || normalized || 'each';
}

// Group line items by normalized name for aggregation
export function groupLineItemsByName(
  items: LineItem[]
): Map<string, LineItem[]> {
  const groups = new Map<string, LineItem[]>();

  for (const item of items) {
    const key = item.item_name_normalized || normalizeItemName(item.item_name);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  return groups;
}

// Calculate average price for an item across purchases
export function calculateAveragePrice(
  priceHistory: { unit_price: number; quantity: number }[]
): number {
  if (priceHistory.length === 0) return 0;

  // Weight by quantity
  const totalValue = priceHistory.reduce(
    (sum, p) => sum + p.unit_price * p.quantity,
    0
  );
  const totalQuantity = priceHistory.reduce((sum, p) => sum + p.quantity, 0);

  return totalQuantity > 0 ? totalValue / totalQuantity : 0;
}

// Detect significant price changes
export function detectPriceChange(
  currentPrice: number,
  previousPrice: number,
  threshold: number = 0.05 // 5%
): { changed: boolean; pct: number; direction: 'up' | 'down' | 'same' } {
  if (previousPrice === 0) {
    return { changed: false, pct: 0, direction: 'same' };
  }

  const change = (currentPrice - previousPrice) / previousPrice;
  const absChange = Math.abs(change);

  return {
    changed: absChange >= threshold,
    pct: change * 100,
    direction: change > threshold ? 'up' : change < -threshold ? 'down' : 'same',
  };
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

// Format quantity with unit
export function formatQuantity(quantity: number, unit?: string): string {
  const formattedQty = quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(3);
  return unit ? `${formattedQty} ${unit}` : formattedQty;
}

// Common grocery/retail item patterns for better matching
export const COMMON_ITEM_PATTERNS = [
  // Dairy
  { pattern: /milk.*gallon/i, category: 'dairy', normalized: 'milk gallon' },
  { pattern: /milk.*half.*gallon/i, category: 'dairy', normalized: 'milk half gallon' },
  { pattern: /eggs?.*dozen/i, category: 'dairy', normalized: 'eggs dozen' },

  // Fuel
  { pattern: /gas.*regular/i, category: 'fuel', normalized: 'gasoline regular' },
  { pattern: /gas.*premium/i, category: 'fuel', normalized: 'gasoline premium' },
  { pattern: /diesel/i, category: 'fuel', normalized: 'diesel' },

  // Common groceries
  { pattern: /bread.*white/i, category: 'bakery', normalized: 'bread white' },
  { pattern: /bread.*wheat/i, category: 'bakery', normalized: 'bread wheat' },
  { pattern: /banana/i, category: 'produce', normalized: 'bananas' },
  { pattern: /apple/i, category: 'produce', normalized: 'apples' },
];

// Try to match and normalize an item name using common patterns
export function matchCommonItem(
  itemName: string
): { matched: boolean; normalized?: string; category?: string } {
  for (const pattern of COMMON_ITEM_PATTERNS) {
    if (pattern.pattern.test(itemName)) {
      return {
        matched: true,
        normalized: pattern.normalized,
        category: pattern.category,
      };
    }
  }
  return { matched: false };
}
