// Job-level Cost-to-Complete and Margin Forecasting Engine

export interface CostDataPoint {
  date: string;
  amount: number;
}

export interface ForecastInput {
  contractValue: number;
  estimatedCost: number;
  actualCost: number;
  percentComplete: number; // 0-100
  costHistory: CostDataPoint[]; // dated cost entries for trend analysis
}

export interface CostToCompleteResult {
  // Method 1: Budget-based (simple)
  budget_etc: number; // Estimated Cost - Actual Cost
  budget_eac: number; // Actual Cost + budget_etc

  // Method 2: Performance-based (CPI adjusted)
  cpi: number; // Cost Performance Index = % complete / (actual / estimated)
  performance_etc: number; // Remaining work / CPI
  performance_eac: number; // Actual + performance_etc

  // Method 3: Trend-based (burn rate adjusted)
  trend_etc: number;
  trend_eac: number;
  burn_rate_trend: 'accelerating' | 'steady' | 'decelerating';

  // Best estimate (weighted blend)
  recommended_etc: number;
  recommended_eac: number;
  method_used: string;

  // Variance at completion
  vac_budget: number; // Budget EAC vs estimated
  vac_performance: number;
  vac_trend: number;
  vac_recommended: number;
}

export interface MarginForecast {
  // Current state
  current_margin: number;
  current_margin_pct: number;

  // Projected at completion
  projected_profit_budget: number;
  projected_margin_budget: number;
  projected_profit_performance: number;
  projected_margin_performance: number;
  projected_profit_trend: number;
  projected_margin_trend: number;

  // Recommended (best estimate)
  projected_profit: number;
  projected_margin: number;

  // vs Original estimate
  original_margin: number;
  margin_erosion: number; // negative = eroding

  // Confidence
  confidence: 'high' | 'medium' | 'low';
  confidence_reason: string;
}

export function calculateCostToComplete(input: ForecastInput): CostToCompleteResult {
  const { contractValue, estimatedCost, actualCost, percentComplete, costHistory } = input;

  const remainingWork = Math.max(100 - percentComplete, 0) / 100;
  const remainingBudget = Math.max(estimatedCost - actualCost, 0);

  // --- Method 1: Budget-based (simple) ---
  const budgetEtc = remainingBudget;
  const budgetEac = actualCost + budgetEtc;

  // --- Method 2: Performance-based (CPI) ---
  // CPI = Earned Value / Actual Cost
  // Earned Value = % Complete * Estimated Cost
  const earnedValue = (percentComplete / 100) * estimatedCost;
  const cpi = actualCost > 0 ? earnedValue / actualCost : 1;

  // ETC = Remaining Budget / CPI
  const performanceEtc = cpi > 0 ? remainingBudget / cpi : remainingBudget;
  const performanceEac = actualCost + performanceEtc;

  // --- Method 3: Trend-based (recent burn rate) ---
  let trendEtc = remainingBudget;
  let trendEac = budgetEac;
  let burnRateTrend: CostToCompleteResult['burn_rate_trend'] = 'steady';

  if (costHistory.length >= 4) {
    // Split history into halves to detect acceleration
    const sorted = [...costHistory].sort((a, b) => a.date.localeCompare(b.date));
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    const firstTotal = firstHalf.reduce((s, d) => s + d.amount, 0);
    const secondTotal = secondHalf.reduce((s, d) => s + d.amount, 0);

    const firstDays = getDaySpan(firstHalf);
    const secondDays = getDaySpan(secondHalf);

    const firstRate = firstDays > 0 ? firstTotal / firstDays : 0;
    const secondRate = secondDays > 0 ? secondTotal / secondDays : 0;

    if (secondRate > firstRate * 1.15) {
      burnRateTrend = 'accelerating';
    } else if (secondRate < firstRate * 0.85) {
      burnRateTrend = 'decelerating';
    }

    // Use recent rate for projection
    const recentDailyRate = secondRate > 0 ? secondRate : firstRate;

    if (recentDailyRate > 0 && percentComplete > 0) {
      // Project remaining cost based on recent burn rate and remaining % of work
      const totalDays = getDaySpan(sorted);
      const daysPerPercent = totalDays / percentComplete;
      const remainingDays = daysPerPercent * (100 - percentComplete);
      trendEtc = Math.max(recentDailyRate * remainingDays, 0);
      trendEac = actualCost + trendEtc;
    }
  }

  // --- Recommended (weighted blend) ---
  let recommendedEtc: number;
  let methodUsed: string;

  if (percentComplete < 15) {
    // Early stage: trust the budget
    recommendedEtc = budgetEtc;
    methodUsed = 'Budget (early stage — insufficient data for trends)';
  } else if (percentComplete < 40) {
    // Mid-early: blend budget and performance
    recommendedEtc = budgetEtc * 0.6 + performanceEtc * 0.4;
    methodUsed = 'Blended (60% budget, 40% performance)';
  } else if (costHistory.length >= 4) {
    // Mid-late with trend data: weight toward trend
    recommendedEtc = performanceEtc * 0.4 + trendEtc * 0.6;
    methodUsed = 'Blended (40% performance, 60% trend)';
  } else {
    // Mid-late without trend: performance-based
    recommendedEtc = performanceEtc;
    methodUsed = 'Performance (CPI-based)';
  }

  const recommendedEac = actualCost + recommendedEtc;

  return {
    budget_etc: round(budgetEtc),
    budget_eac: round(budgetEac),
    cpi: round(cpi),
    performance_etc: round(performanceEtc),
    performance_eac: round(performanceEac),
    trend_etc: round(trendEtc),
    trend_eac: round(trendEac),
    burn_rate_trend: burnRateTrend,
    recommended_etc: round(recommendedEtc),
    recommended_eac: round(recommendedEac),
    method_used: methodUsed,
    vac_budget: round(estimatedCost - budgetEac),
    vac_performance: round(estimatedCost - performanceEac),
    vac_trend: round(estimatedCost - trendEac),
    vac_recommended: round(estimatedCost - recommendedEac),
  };
}

export function calculateMarginForecast(
  input: ForecastInput,
  ctc: CostToCompleteResult
): MarginForecast {
  const { contractValue, estimatedCost, actualCost, percentComplete } = input;

  // Current state
  const revenueRecognized = (percentComplete / 100) * contractValue;
  const currentMargin = revenueRecognized - actualCost;
  const currentMarginPct = revenueRecognized > 0 ? (currentMargin / revenueRecognized) * 100 : 0;

  // Original estimate
  const originalProfit = contractValue - estimatedCost;
  const originalMargin = contractValue > 0 ? (originalProfit / contractValue) * 100 : 0;

  // Projected margins at completion (revenue = full contract value)
  const projProfitBudget = contractValue - ctc.budget_eac;
  const projMarginBudget = contractValue > 0 ? (projProfitBudget / contractValue) * 100 : 0;

  const projProfitPerf = contractValue - ctc.performance_eac;
  const projMarginPerf = contractValue > 0 ? (projProfitPerf / contractValue) * 100 : 0;

  const projProfitTrend = contractValue - ctc.trend_eac;
  const projMarginTrend = contractValue > 0 ? (projProfitTrend / contractValue) * 100 : 0;

  const projProfit = contractValue - ctc.recommended_eac;
  const projMargin = contractValue > 0 ? (projProfit / contractValue) * 100 : 0;

  const marginErosion = projMargin - originalMargin;

  // Confidence based on data quality
  let confidence: MarginForecast['confidence'] = 'medium';
  let confidenceReason = 'Based on available cost data';

  if (percentComplete < 15) {
    confidence = 'low';
    confidenceReason = 'Less than 15% complete — forecast is speculative';
  } else if (percentComplete >= 50 && input.costHistory.length >= 6) {
    confidence = 'high';
    confidenceReason = 'Over 50% complete with strong cost history';
  } else if (percentComplete >= 30 && input.costHistory.length >= 4) {
    confidence = 'medium';
    confidenceReason = 'Moderate completion with reasonable cost data';
  } else {
    confidence = 'low';
    confidenceReason = 'Limited cost history — improve by tagging bills/expenses to jobs';
  }

  return {
    current_margin: round(currentMargin),
    current_margin_pct: round(currentMarginPct),
    projected_profit_budget: round(projProfitBudget),
    projected_margin_budget: round(projMarginBudget),
    projected_profit_performance: round(projProfitPerf),
    projected_margin_performance: round(projMarginPerf),
    projected_profit_trend: round(projProfitTrend),
    projected_margin_trend: round(projMarginTrend),
    projected_profit: round(projProfit),
    projected_margin: round(projMargin),
    original_margin: round(originalMargin),
    margin_erosion: round(marginErosion),
    confidence,
    confidence_reason: confidenceReason,
  };
}

function getDaySpan(points: CostDataPoint[]): number {
  if (points.length < 2) return 1;
  const first = new Date(points[0].date).getTime();
  const last = new Date(points[points.length - 1].date).getTime();
  return Math.max((last - first) / (1000 * 60 * 60 * 24), 1);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
