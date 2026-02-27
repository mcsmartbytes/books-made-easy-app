// Analytics utilities for spending insights

export interface DateRange {
  start: Date;
  end: Date;
}

export interface CategorySpending {
  category_id: string;
  category_name: string;
  category_icon: string;
  total: number;
  count: number;
}

export interface SpendingVariance {
  category_id: string;
  category_name: string;
  category_icon: string;
  current_total: number;
  previous_total: number;
  change: number;
  change_percent: number;
  count_change: number;
}

export interface SpendingInsight {
  type: 'increase' | 'decrease' | 'new' | 'gone';
  category_name: string;
  category_icon: string;
  amount_change: number;
  percent_change: number;
  reason?: string;
}

export interface SpendingAnalysis {
  current_total: number;
  previous_total: number;
  total_change: number;
  total_change_percent: number;
  top_increases: SpendingInsight[];
  top_decreases: SpendingInsight[];
  summary: string;
}

// Get the date range for a given period
export function getDateRange(period: 'week' | 'month' | 'quarter' | 'year'): DateRange {
  const now = new Date();
  const start = new Date();

  switch (period) {
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'quarter':
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      start.setMonth(quarterStart, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start, end: now };
}

// Get the previous period's date range (for comparison)
export function getPreviousPeriodRange(period: 'week' | 'month' | 'quarter' | 'year'): DateRange {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (period) {
    case 'week':
      end.setDate(now.getDate() - 7);
      start.setDate(now.getDate() - 14);
      break;
    case 'month':
      end.setMonth(now.getMonth(), 0); // Last day of previous month
      start.setMonth(now.getMonth() - 1, 1); // First day of previous month
      break;
    case 'quarter':
      const currentQuarterStart = Math.floor(now.getMonth() / 3) * 3;
      end.setMonth(currentQuarterStart, 0); // Last day of previous quarter
      start.setMonth(currentQuarterStart - 3, 1); // First day of previous quarter
      break;
    case 'year':
      end.setFullYear(now.getFullYear() - 1, 11, 31);
      start.setFullYear(now.getFullYear() - 1, 0, 1);
      break;
  }

  return { start, end };
}

// Calculate variances between two periods
export function calculateVariances(
  current: CategorySpending[],
  previous: CategorySpending[]
): SpendingVariance[] {
  const previousMap = new Map(previous.map((p) => [p.category_id, p]));
  const variances: SpendingVariance[] = [];

  // Process current categories
  for (const curr of current) {
    const prev = previousMap.get(curr.category_id);
    const prevTotal = prev?.total || 0;
    const prevCount = prev?.count || 0;

    variances.push({
      category_id: curr.category_id,
      category_name: curr.category_name,
      category_icon: curr.category_icon,
      current_total: curr.total,
      previous_total: prevTotal,
      change: curr.total - prevTotal,
      change_percent: prevTotal > 0 ? ((curr.total - prevTotal) / prevTotal) * 100 : 100,
      count_change: curr.count - prevCount,
    });

    previousMap.delete(curr.category_id);
  }

  // Add categories that existed in previous but not in current
  Array.from(previousMap.values()).forEach((prev) => {
    variances.push({
      category_id: prev.category_id,
      category_name: prev.category_name,
      category_icon: prev.category_icon,
      current_total: 0,
      previous_total: prev.total,
      change: -prev.total,
      change_percent: -100,
      count_change: -prev.count,
    });
  });

  return variances;
}

// Generate natural language insight
export function generateInsight(variance: SpendingVariance): SpendingInsight {
  const isNew = variance.previous_total === 0 && variance.current_total > 0;
  const isGone = variance.current_total === 0 && variance.previous_total > 0;
  const isIncrease = variance.change > 0;

  let type: SpendingInsight['type'];
  if (isNew) type = 'new';
  else if (isGone) type = 'gone';
  else if (isIncrease) type = 'increase';
  else type = 'decrease';

  let reason: string | undefined;

  // Try to infer reasons
  if (variance.count_change > 2 && isIncrease) {
    reason = `${variance.count_change} more transactions`;
  } else if (variance.count_change < -2 && !isIncrease) {
    reason = `${Math.abs(variance.count_change)} fewer transactions`;
  } else if (isNew) {
    reason = 'New spending category this period';
  } else if (isGone) {
    reason = 'No spending in this category this period';
  }

  return {
    type,
    category_name: variance.category_name,
    category_icon: variance.category_icon,
    amount_change: Math.abs(variance.change),
    percent_change: Math.abs(variance.change_percent),
    reason,
  };
}

// Generate summary text
export function generateSummary(
  totalChange: number,
  totalChangePercent: number,
  topIncreases: SpendingInsight[],
  topDecreases: SpendingInsight[]
): string {
  const direction = totalChange >= 0 ? 'increased' : 'decreased';
  const absChange = Math.abs(totalChange);
  const absPercent = Math.abs(totalChangePercent);

  let summary = `Your spending ${direction} by $${absChange.toFixed(0)} (${absPercent.toFixed(0)}%) compared to last period`;

  if (topIncreases.length > 0 && totalChange > 0) {
    summary += ` because: ${topIncreases
      .slice(0, 3)
      .map((i) => `${i.category_icon} ${i.category_name} (+$${i.amount_change.toFixed(0)})`)
      .join(', ')}`;
  } else if (topDecreases.length > 0 && totalChange < 0) {
    summary += ` mainly from: ${topDecreases
      .slice(0, 3)
      .map((d) => `${d.category_icon} ${d.category_name} (-$${d.amount_change.toFixed(0)})`)
      .join(', ')}`;
  }

  return summary;
}

// Main analysis function
export function analyzeSpending(
  currentSpending: CategorySpending[],
  previousSpending: CategorySpending[]
): SpendingAnalysis {
  const currentTotal = currentSpending.reduce((sum, c) => sum + c.total, 0);
  const previousTotal = previousSpending.reduce((sum, p) => sum + p.total, 0);
  const totalChange = currentTotal - previousTotal;
  const totalChangePercent = previousTotal > 0 ? (totalChange / previousTotal) * 100 : 0;

  const variances = calculateVariances(currentSpending, previousSpending);
  const insights = variances.map(generateInsight);

  const topIncreases = insights
    .filter((i) => i.type === 'increase' || i.type === 'new')
    .sort((a, b) => b.amount_change - a.amount_change)
    .slice(0, 5);

  const topDecreases = insights
    .filter((i) => i.type === 'decrease' || i.type === 'gone')
    .sort((a, b) => b.amount_change - a.amount_change)
    .slice(0, 5);

  const summary = generateSummary(totalChange, totalChangePercent, topIncreases, topDecreases);

  return {
    current_total: currentTotal,
    previous_total: previousTotal,
    total_change: totalChange,
    total_change_percent: totalChangePercent,
    top_increases: topIncreases,
    top_decreases: topDecreases,
    summary,
  };
}
