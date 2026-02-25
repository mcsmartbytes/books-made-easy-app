import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';
import {
  getDaysRemainingInMonth,
  getDaysElapsedInMonth,
  calculateRemainingRecurring,
  generateMonthlyForecast,
  generateAlerts,
  DailySpending,
  RecurringExpense,
  Budget,
} from '@/lib/forecasting';

export const dynamic = 'force-dynamic';

// GET - generate forecast and predictive alerts for a user
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Fetch current month expenses
    const { data: currentExpenses, error: currentError } = await supabaseAdmin
      .from('expenses')
      .select('amount, date, category_id, categories(name)')
      .eq('user_id', userId)
      .gte('date', startOfMonth.toISOString().split('T')[0]);

    if (currentError) throw currentError;

    // Calculate current spent and by category
    const expenses = (currentExpenses || []) as any[];
    const currentSpent = expenses.reduce(
      (sum, e) => sum + parseFloat(e.amount),
      0
    );

    const currentByCategory: Record<string, number> = {};
    for (const expense of expenses) {
      const cat = expense.categories as { name: string } | null;
      const catName = cat?.name || 'Uncategorized';
      currentByCategory[catName] = (currentByCategory[catName] || 0) + parseFloat(expense.amount);
    }

    // Fetch last 3 months for average calculation
    const { data: historicalExpenses, error: histError } = await supabaseAdmin
      .from('expenses')
      .select('amount, date')
      .eq('user_id', userId)
      .gte('date', threeMonthsAgo.toISOString().split('T')[0])
      .lt('date', startOfMonth.toISOString().split('T')[0]);

    if (histError) throw histError;

    // Group historical by day
    const dailySpending: Record<string, DailySpending> = {};
    const historicalList = (historicalExpenses || []) as any[];
    for (const expense of historicalList) {
      const date = expense.date as string;
      if (!dailySpending[date]) {
        dailySpending[date] = { date, total: 0, count: 0 };
      }
      dailySpending[date].total += parseFloat(expense.amount);
      dailySpending[date].count += 1;
    }

    const dailyData = Object.values(dailySpending);
    const avgDailySpend =
      dailyData.length > 0
        ? dailyData.reduce((sum, d) => sum + d.total, 0) / dailyData.length
        : currentSpent / Math.max(getDaysElapsedInMonth(), 1);

    // Fetch last month total for comparison
    const { data: lastMonthExpenses } = await supabaseAdmin
      .from('expenses')
      .select('amount')
      .eq('user_id', userId)
      .gte('date', lastMonthStart.toISOString().split('T')[0])
      .lte('date', lastMonthEnd.toISOString().split('T')[0]);

    const lastMonthList = (lastMonthExpenses || []) as any[];
    const previousMonthTotal = lastMonthList.reduce(
      (sum, e) => sum + parseFloat(e.amount),
      0
    );

    // Fetch recurring expenses
    const { data: recurring, error: recurError } = await supabaseAdmin
      .from('recurring_expenses')
      .select('id, amount, description, frequency, next_due_date')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (recurError) throw recurError;

    const recurringRemaining = calculateRemainingRecurring(
      (recurring || []) as unknown as RecurringExpense[]
    );

    // Fetch budgets
    const { data: budgets, error: budgetError } = await supabaseAdmin
      .from('budgets')
      .select('id, category, amount, period, profile, alert_threshold')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (budgetError) throw budgetError;

    // Generate forecast
    const forecast = generateMonthlyForecast(currentSpent, avgDailySpend, recurringRemaining);

    // Add upcoming recurring to forecast
    const upcomingRecurring = (recurring || [])
      .filter((r: any) => {
        const dueDate = new Date(r.next_due_date);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return dueDate >= now && dueDate <= endOfMonth;
      })
      .sort((a: any, b: any) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime());

    forecast.upcoming_recurring = upcomingRecurring as unknown as RecurringExpense[];

    // Generate alerts
    const alerts = generateAlerts(
      forecast,
      (budgets || []) as unknown as Budget[],
      currentByCategory,
      previousMonthTotal
    );

    return NextResponse.json({
      success: true,
      data: {
        forecast: {
          projected_total: forecast.projected_total,
          current_spent: currentSpent,
          days_remaining: getDaysRemainingInMonth(),
          avg_daily_spend: avgDailySpend,
          recurring_remaining: recurringRemaining,
          upcoming_recurring: upcomingRecurring.slice(0, 5),
        },
        alerts,
        comparison: {
          previous_month_total: previousMonthTotal,
          projected_vs_previous: forecast.projected_total - previousMonthTotal,
        },
      },
    });
  } catch (error: any) {
    console.error('Error generating forecast:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
