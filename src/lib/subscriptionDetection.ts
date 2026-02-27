// Subscription Detection Algorithm
// Analyzes expense patterns to detect recurring charges

export interface ExpenseForDetection {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  category_id?: string;
  category_name?: string;
}

export interface DetectedSubscription {
  vendor: string;
  vendor_normalized: string;
  avg_amount: number;
  min_amount: number;
  max_amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | 'irregular';
  confidence: number;
  first_seen: string;
  last_seen: string;
  next_expected: string;
  occurrence_count: number;
  category_id?: string;
  category_name?: string;
  expense_ids: string[];
  amounts: number[];
  dates: string[];
}

export interface SubscriptionCandidate {
  vendor: string;
  expenses: ExpenseForDetection[];
}

// Normalize vendor name for matching
export function normalizeVendor(vendor: string): string {
  return vendor
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

// Calculate the average interval between dates in days
export function calculateAverageInterval(dates: Date[]): number {
  if (dates.length < 2) return 0;

  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  let totalDays = 0;

  for (let i = 1; i < sortedDates.length; i++) {
    const diff = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
    totalDays += diff / (1000 * 60 * 60 * 24);
  }

  return totalDays / (sortedDates.length - 1);
}

// Calculate variance in intervals (lower = more regular)
export function calculateIntervalVariance(dates: Date[]): number {
  if (dates.length < 3) return 0;

  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];

  for (let i = 1; i < sortedDates.length; i++) {
    const diff = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
    intervals.push(diff / (1000 * 60 * 60 * 24));
  }

  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;

  return Math.sqrt(variance) / avg; // Coefficient of variation
}

// Determine frequency from average interval
export function determineFrequency(avgDays: number): DetectedSubscription['frequency'] {
  if (avgDays <= 9) return 'weekly'; // 7 days +/- 2
  if (avgDays <= 18) return 'biweekly'; // 14 days +/- 4
  if (avgDays <= 45) return 'monthly'; // 30 days +/- 15
  if (avgDays <= 120) return 'quarterly'; // 90 days +/- 30
  if (avgDays <= 400) return 'annually'; // 365 days +/- 35
  return 'irregular';
}

// Calculate next expected date
export function calculateNextExpected(lastDate: Date, frequency: DetectedSubscription['frequency']): Date {
  const next = new Date(lastDate);

  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'annually':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1); // Default to monthly
  }

  return next;
}

// Calculate confidence score based on regularity
export function calculateConfidence(
  occurrences: number,
  intervalVariance: number,
  amountVariance: number
): number {
  let confidence = 0;

  // More occurrences = higher confidence
  if (occurrences >= 12) confidence += 0.4;
  else if (occurrences >= 6) confidence += 0.3;
  else if (occurrences >= 3) confidence += 0.2;
  else confidence += 0.1;

  // Lower interval variance = higher confidence
  if (intervalVariance < 0.1) confidence += 0.35;
  else if (intervalVariance < 0.2) confidence += 0.25;
  else if (intervalVariance < 0.3) confidence += 0.15;
  else confidence += 0.05;

  // Lower amount variance = higher confidence
  if (amountVariance < 0.05) confidence += 0.25;
  else if (amountVariance < 0.1) confidence += 0.2;
  else if (amountVariance < 0.15) confidence += 0.1;
  else confidence += 0.05;

  return Math.min(confidence, 1);
}

// Calculate amount variance (coefficient of variation)
export function calculateAmountVariance(amounts: number[]): number {
  if (amounts.length < 2) return 0;

  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  if (avg === 0) return 0;

  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / amounts.length;
  return Math.sqrt(variance) / avg;
}

// Group expenses by normalized vendor
export function groupByVendor(expenses: ExpenseForDetection[]): SubscriptionCandidate[] {
  const groups = new Map<string, ExpenseForDetection[]>();

  for (const expense of expenses) {
    if (!expense.vendor) continue;

    const normalized = normalizeVendor(expense.vendor);
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)!.push(expense);
  }

  return Array.from(groups.entries())
    .filter(([_, exps]) => exps.length >= 2) // At least 2 occurrences
    .map(([vendor, expenses]) => ({ vendor, expenses }));
}

// Main detection function
export function detectSubscriptions(expenses: ExpenseForDetection[]): DetectedSubscription[] {
  const candidates = groupByVendor(expenses);
  const subscriptions: DetectedSubscription[] = [];

  for (const candidate of candidates) {
    const { vendor, expenses: vendorExpenses } = candidate;

    // Sort by date
    const sorted = [...vendorExpenses].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const dates = sorted.map(e => new Date(e.date));
    const amounts = sorted.map(e => e.amount);

    // Calculate metrics
    const avgInterval = calculateAverageInterval(dates);
    const intervalVariance = calculateIntervalVariance(dates);
    const amountVariance = calculateAmountVariance(amounts);

    // Skip if too irregular (variance > 50%)
    if (intervalVariance > 0.5 && sorted.length < 6) continue;

    const frequency = determineFrequency(avgInterval);
    const confidence = calculateConfidence(sorted.length, intervalVariance, amountVariance);

    // Only include if confidence is reasonable
    if (confidence < 0.3 && sorted.length < 4) continue;

    const lastDate = dates[dates.length - 1];
    const nextExpected = calculateNextExpected(lastDate, frequency);

    // Get most common category
    const categoryCount = new Map<string, { id: string; name: string; count: number }>();
    for (const exp of sorted) {
      if (exp.category_id) {
        const key = exp.category_id;
        if (!categoryCount.has(key)) {
          categoryCount.set(key, { id: exp.category_id, name: exp.category_name || '', count: 0 });
        }
        categoryCount.get(key)!.count++;
      }
    }

    let topCategory: { id: string; name: string } | undefined;
    let maxCount = 0;
    Array.from(categoryCount.values()).forEach((cat) => {
      if (cat.count > maxCount) {
        maxCount = cat.count;
        topCategory = { id: cat.id, name: cat.name };
      }
    });

    subscriptions.push({
      vendor: sorted[0].vendor, // Original vendor name
      vendor_normalized: vendor,
      avg_amount: amounts.reduce((a, b) => a + b, 0) / amounts.length,
      min_amount: Math.min(...amounts),
      max_amount: Math.max(...amounts),
      frequency,
      confidence,
      first_seen: sorted[0].date,
      last_seen: sorted[sorted.length - 1].date,
      next_expected: nextExpected.toISOString().split('T')[0],
      occurrence_count: sorted.length,
      category_id: topCategory?.id,
      category_name: topCategory?.name,
      expense_ids: sorted.map(e => e.id),
      amounts,
      dates: sorted.map(e => e.date),
    });
  }

  // Sort by confidence (highest first)
  return subscriptions.sort((a, b) => b.confidence - a.confidence);
}

// Detect price increases
export interface PriceChange {
  subscription_id: string;
  vendor: string;
  old_amount: number;
  new_amount: number;
  change: number;
  change_pct: number;
  detected_date: string;
}

export function detectPriceChanges(
  subscription: DetectedSubscription,
  threshold: number = 0.05 // 5% change threshold
): PriceChange[] {
  const changes: PriceChange[] = [];

  for (let i = 1; i < subscription.amounts.length; i++) {
    const oldAmount = subscription.amounts[i - 1];
    const newAmount = subscription.amounts[i];
    const change = newAmount - oldAmount;
    const changePct = oldAmount > 0 ? change / oldAmount : 0;

    if (Math.abs(changePct) >= threshold) {
      changes.push({
        subscription_id: '', // Will be filled by API
        vendor: subscription.vendor,
        old_amount: oldAmount,
        new_amount: newAmount,
        change,
        change_pct: changePct * 100,
        detected_date: subscription.dates[i],
      });
    }
  }

  return changes;
}

// Calculate monthly cost equivalent
export function calculateMonthlyCost(subscription: DetectedSubscription): number {
  switch (subscription.frequency) {
    case 'weekly':
      return subscription.avg_amount * 4.33;
    case 'biweekly':
      return subscription.avg_amount * 2.17;
    case 'monthly':
      return subscription.avg_amount;
    case 'quarterly':
      return subscription.avg_amount / 3;
    case 'annually':
      return subscription.avg_amount / 12;
    default:
      return subscription.avg_amount;
  }
}

// Find duplicate/similar subscriptions
export interface DuplicateGroup {
  category: string;
  subscriptions: DetectedSubscription[];
  total_monthly: number;
}

export function findDuplicates(
  subscriptions: DetectedSubscription[],
  categories: { name: string; keywords: string[] }[]
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];

  // Common subscription categories to detect duplicates
  const defaultCategories = [
    { name: 'Streaming Video', keywords: ['netflix', 'hulu', 'disney', 'hbo', 'prime video', 'peacock', 'paramount', 'apple tv'] },
    { name: 'Music Streaming', keywords: ['spotify', 'apple music', 'youtube music', 'amazon music', 'tidal', 'pandora'] },
    { name: 'Cloud Storage', keywords: ['dropbox', 'google drive', 'icloud', 'onedrive', 'box'] },
    { name: 'News/Reading', keywords: ['nytimes', 'wsj', 'washington post', 'medium', 'substack', 'kindle unlimited'] },
    { name: 'Fitness', keywords: ['gym', 'fitness', 'peloton', 'planet fitness', 'la fitness', 'equinox'] },
  ];

  const allCategories = [...defaultCategories, ...categories];

  for (const category of allCategories) {
    const matching = subscriptions.filter(sub => {
      const vendorLower = sub.vendor_normalized;
      return category.keywords.some(kw => vendorLower.includes(kw));
    });

    if (matching.length > 1) {
      groups.push({
        category: category.name,
        subscriptions: matching,
        total_monthly: matching.reduce((sum, sub) => sum + calculateMonthlyCost(sub), 0),
      });
    }
  }

  return groups;
}
