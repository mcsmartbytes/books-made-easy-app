// Forecasting utilities for predictive alerts

export interface DailySpending {
  date: string;
  total: number;
  count: number;
}

export interface RecurringExpense {
  id: string;
  amount: number;
  description: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
  next_due_date: string;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  profile: 'business' | 'personal';
  alert_threshold: number;
}

export interface ForecastResult {
  projected_total: number;
  days_remaining: number;
  avg_daily_spend: number;
  current_spent: number;
  upcoming_recurring: RecurringExpense[];
  recurring_remaining: number;
}

export interface PredictiveAlert {
  id: string;
  type: 'tight_month' | 'on_track' | 'budget_warning' | 'upcoming_bill' | 'spending_spike';
  severity: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  data?: Record<string, any>;
}

// Get days remaining in current month
export function getDaysRemainingInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

// Get days elapsed in current month
export function getDaysElapsedInMonth(): number {
  const now = new Date();
  return now.getDate();
}

// Calculate average daily spending from historical data
export function calculateAverageDailySpend(expenses: DailySpending[]): number {
  if (expenses.length === 0) return 0;

  const totalSpent = expenses.reduce((sum, d) => sum + d.total, 0);
  return totalSpent / expenses.length;
}

// Filter recurring expenses due within a date range
export function getUpcomingRecurring(
  recurring: RecurringExpense[],
  daysAhead: number = 30
): RecurringExpense[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);

  return recurring.filter((r) => {
    const dueDate = new Date(r.next_due_date);
    return dueDate <= cutoff && dueDate >= new Date();
  });
}

// Calculate remaining recurring expenses for current month
export function calculateRemainingRecurring(recurring: RecurringExpense[]): number {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return recurring
    .filter((r) => {
      const dueDate = new Date(r.next_due_date);
      return dueDate >= now && dueDate <= endOfMonth;
    })
    .reduce((sum, r) => sum + r.amount, 0);
}

// Generate forecast for the month
export function generateMonthlyForecast(
  currentSpent: number,
  avgDailySpend: number,
  recurringRemaining: number
): ForecastResult {
  const daysRemaining = getDaysRemainingInMonth();
  const projectedVariable = avgDailySpend * daysRemaining;
  const projectedTotal = currentSpent + projectedVariable + recurringRemaining;

  return {
    projected_total: projectedTotal,
    days_remaining: daysRemaining,
    avg_daily_spend: avgDailySpend,
    current_spent: currentSpent,
    upcoming_recurring: [],
    recurring_remaining: recurringRemaining,
  };
}

// Generate predictive alerts
export function generateAlerts(
  forecast: ForecastResult,
  budgets: Budget[],
  currentByCategory: Record<string, number>,
  previousMonthTotal: number
): PredictiveAlert[] {
  const alerts: PredictiveAlert[] = [];

  // Check for tight month
  const totalMonthlyBudget = budgets
    .filter((b) => b.period === 'monthly')
    .reduce((sum, b) => sum + b.amount, 0);

  if (totalMonthlyBudget > 0 && forecast.projected_total > totalMonthlyBudget) {
    const overAmount = forecast.projected_total - totalMonthlyBudget;
    alerts.push({
      id: 'tight_month',
      type: 'tight_month',
      severity: 'warning',
      title: 'Tight Month Ahead',
      message: `If you keep spending like this, you'll be $${overAmount.toFixed(0)} over budget by month end.`,
      data: {
        projected: forecast.projected_total,
        budget: totalMonthlyBudget,
        over: overAmount,
      },
    });
  }

  // Check if on track for savings
  if (previousMonthTotal > 0 && forecast.projected_total < previousMonthTotal * 0.9) {
    const savings = previousMonthTotal - forecast.projected_total;
    alerts.push({
      id: 'on_track',
      type: 'on_track',
      severity: 'success',
      title: 'Great Progress!',
      message: `You're on track to spend $${savings.toFixed(0)} less than last month.`,
      data: {
        projected: forecast.projected_total,
        previousMonth: previousMonthTotal,
        savings,
      },
    });
  }

  // Check individual budget warnings
  for (const budget of budgets) {
    if (budget.period !== 'monthly') continue;

    const spent = currentByCategory[budget.category] || 0;
    const threshold = budget.amount * budget.alert_threshold;
    const daysElapsed = getDaysElapsedInMonth();
    const totalDays = daysElapsed + forecast.days_remaining;
    const projectedCategory = (spent / daysElapsed) * totalDays;

    if (spent >= threshold && spent < budget.amount) {
      alerts.push({
        id: `budget_warning_${budget.id}`,
        type: 'budget_warning',
        severity: 'warning',
        title: `${budget.category} Budget Alert`,
        message: `You've spent ${Math.round((spent / budget.amount) * 100)}% of your ${budget.category} budget with ${forecast.days_remaining} days left.`,
        data: {
          category: budget.category,
          spent,
          budget: budget.amount,
          remaining: budget.amount - spent,
        },
      });
    } else if (projectedCategory > budget.amount && spent < budget.amount) {
      alerts.push({
        id: `budget_projection_${budget.id}`,
        type: 'budget_warning',
        severity: 'info',
        title: `${budget.category} Trending Over`,
        message: `At this rate, you'll exceed your ${budget.category} budget by $${(projectedCategory - budget.amount).toFixed(0)}.`,
        data: {
          category: budget.category,
          projected: projectedCategory,
          budget: budget.amount,
        },
      });
    }
  }

  // Check for upcoming bills
  if (forecast.upcoming_recurring && forecast.upcoming_recurring.length > 0) {
    const nextBill = forecast.upcoming_recurring[0];
    const daysUntil = Math.ceil(
      (new Date(nextBill.next_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntil <= 7) {
      alerts.push({
        id: `upcoming_bill_${nextBill.id}`,
        type: 'upcoming_bill',
        severity: 'info',
        title: 'Upcoming Bill',
        message: `${nextBill.description} ($${nextBill.amount.toFixed(0)}) is due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}.`,
        data: {
          expense: nextBill,
          daysUntil,
        },
      });
    }
  }

  // Check for spending spike (current daily average much higher than historical)
  const daysElapsed = getDaysElapsedInMonth();
  if (daysElapsed >= 7) {
    const currentDailyAvg = forecast.current_spent / daysElapsed;
    if (forecast.avg_daily_spend > 0 && currentDailyAvg > forecast.avg_daily_spend * 1.5) {
      alerts.push({
        id: 'spending_spike',
        type: 'spending_spike',
        severity: 'warning',
        title: 'Spending Spike Detected',
        message: `Your daily spending this month is ${Math.round((currentDailyAvg / forecast.avg_daily_spend - 1) * 100)}% higher than your average.`,
        data: {
          currentAvg: currentDailyAvg,
          historicalAvg: forecast.avg_daily_spend,
        },
      });
    }
  }

  return alerts;
}
