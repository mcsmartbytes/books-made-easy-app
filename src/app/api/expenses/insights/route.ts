import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface Insight {
  id: string;
  type: 'spending_increase' | 'spending_decrease' | 'budget_warning' | 'savings_opportunity' | 'tax_tip' | 'pattern' | 'achievement';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
  data?: Record<string, any>;
}

// GET /api/insights?user_id=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const insights: Insight[] = [];

    // Get current and previous month dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Fetch expenses with categories
    const { data: _currentExpenses } = await supabaseAdmin
      .from('expenses')
      .select('amount, category_id, is_business, date, categories(name, deduction_percentage)')
      .eq('user_id', userId)
      .gte('date', currentMonthStart.toISOString().split('T')[0]);

    const { data: _previousExpenses } = await supabaseAdmin
      .from('expenses')
      .select('amount, category_id, is_business, date, categories(name, deduction_percentage)')
      .eq('user_id', userId)
      .gte('date', previousMonthStart.toISOString().split('T')[0])
      .lte('date', previousMonthEnd.toISOString().split('T')[0]);

    // Fetch budgets
    const { data: _budgets } = await supabaseAdmin
      .from('budgets')
      .select('*')
      .eq('user_id', userId);

    // Fetch mileage (current month)
    const { data: _mileageData } = await supabaseAdmin
      .from('mileage')
      .select('distance, is_business, date')
      .eq('user_id', userId)
      .gte('date', currentMonthStart.toISOString().split('T')[0]);

    // Fetch year-to-date mileage
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const { data: _ytdMileageData } = await supabaseAdmin
      .from('mileage')
      .select('distance, is_business, amount')
      .eq('user_id', userId)
      .eq('is_business', true)
      .gte('date', yearStart);

    // Cast arrays for type safety
    const currentExpensesList = (_currentExpenses || []) as any[];
    const previousExpensesList = (_previousExpenses || []) as any[];
    const budgetsList = (_budgets || []) as any[];
    const mileageList = (_mileageData || []) as any[];
    const ytdMileageList = (_ytdMileageData || []) as any[];

    // Calculate totals
    const currentTotal = currentExpensesList.reduce((sum, e) => sum + Number(e.amount), 0);
    const previousTotal = previousExpensesList.reduce((sum, e) => sum + Number(e.amount), 0);
    const currentBusiness = currentExpensesList.filter(e => e.is_business).reduce((sum, e) => sum + Number(e.amount), 0);
    const _previousBusiness = previousExpensesList.filter(e => e.is_business).reduce((sum, e) => sum + Number(e.amount), 0);

    // Calculate by category
    const currentByCategory = new Map<string, { amount: number; name: string }>();
    const previousByCategory = new Map<string, { amount: number; name: string }>();

    currentExpensesList.forEach(e => {
      const catName = (e.categories as any)?.name || 'Uncategorized';
      const existing = currentByCategory.get(catName) || { amount: 0, name: catName };
      existing.amount += Number(e.amount);
      currentByCategory.set(catName, existing);
    });

    previousExpensesList.forEach(e => {
      const catName = (e.categories as any)?.name || 'Uncategorized';
      const existing = previousByCategory.get(catName) || { amount: 0, name: catName };
      existing.amount += Number(e.amount);
      previousByCategory.set(catName, existing);
    });

    // Generate insights

    // 1. Overall spending change
    if (previousTotal > 0) {
      const changePercent = ((currentTotal - previousTotal) / previousTotal) * 100;
      if (changePercent > 20) {
        insights.push({
          id: 'spending_increase_overall',
          type: 'spending_increase',
          priority: 'high',
          title: 'Spending Up This Month',
          message: `You've spent ${changePercent.toFixed(0)}% more than last month ($${currentTotal.toFixed(2)} vs $${previousTotal.toFixed(2)}).`,
          action: {
            label: 'Review Expenses',
            href: '/expenses',
          },
          data: { changePercent, currentTotal, previousTotal },
        });
      } else if (changePercent < -15) {
        insights.push({
          id: 'spending_decrease_overall',
          type: 'spending_decrease',
          priority: 'low',
          title: 'Great Job Saving!',
          message: `You've spent ${Math.abs(changePercent).toFixed(0)}% less than last month. Keep it up!`,
          data: { changePercent, currentTotal, previousTotal },
        });
      }
    }

    // 2. Category-specific insights
    currentByCategory.forEach((current, catName) => {
      const previous = previousByCategory.get(catName);
      if (previous && previous.amount > 50) {
        const changePercent = ((current.amount - previous.amount) / previous.amount) * 100;
        if (changePercent > 30) {
          insights.push({
            id: `category_increase_${catName.toLowerCase().replace(/\s+/g, '_')}`,
            type: 'spending_increase',
            priority: changePercent > 50 ? 'high' : 'medium',
            title: `${catName} Spending Up`,
            message: `You've spent ${changePercent.toFixed(0)}% more on ${catName} this month ($${current.amount.toFixed(2)} vs $${previous.amount.toFixed(2)} last month).`,
            action: {
              label: 'Set Budget',
              href: '/budgets',
            },
            data: { category: catName, changePercent, current: current.amount, previous: previous.amount },
          });
        }
      }
    });

    // 3. Budget warnings
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const monthProgress = dayOfMonth / daysInMonth;

    budgetsList.forEach(budget => {
      const categoryExpenses = currentExpensesList
        .filter(e => {
          const catName = (e.categories as any)?.name;
          return catName === budget.category;
        })
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const budgetUsed = categoryExpenses / budget.amount;

      if (budgetUsed > 0.9) {
        insights.push({
          id: `budget_warning_${budget.category.toLowerCase().replace(/\s+/g, '_')}`,
          type: 'budget_warning',
          priority: budgetUsed >= 1 ? 'high' : 'medium',
          title: budgetUsed >= 1 ? `${budget.category} Over Budget!` : `${budget.category} Budget Alert`,
          message: budgetUsed >= 1
            ? `You've exceeded your ${budget.category} budget by $${(categoryExpenses - budget.amount).toFixed(2)}.`
            : `You've used ${(budgetUsed * 100).toFixed(0)}% of your ${budget.category} budget with ${daysInMonth - dayOfMonth} days left.`,
          action: {
            label: 'View Budget',
            href: '/budgets',
          },
          data: { category: budget.category, used: categoryExpenses, limit: budget.amount, percentage: budgetUsed * 100 },
        });
      } else if (budgetUsed > monthProgress + 0.15 && budgetUsed > 0.5) {
        insights.push({
          id: `budget_pace_${budget.category.toLowerCase().replace(/\s+/g, '_')}`,
          type: 'budget_warning',
          priority: 'medium',
          title: `${budget.category} Spending Pace`,
          message: `At this rate, you'll exceed your ${budget.category} budget by month end. Consider slowing down.`,
          action: {
            label: 'View Budget',
            href: '/budgets',
          },
        });
      }
    });

    // 4. Tax deduction insights
    const businessExpenses = currentExpensesList.filter(e => e.is_business);
    const deductibleAmount = businessExpenses.reduce((sum, e) => {
      const deductionPct = (e.categories as any)?.deduction_percentage || 0;
      return sum + (Number(e.amount) * deductionPct / 100);
    }, 0);

    const businessMileage = mileageList
      .filter(m => m.is_business)
      .reduce((sum, m) => sum + Number(m.distance), 0);
    const mileageDeduction = businessMileage * 0.67; // 2024 IRS rate

    const totalDeductions = deductibleAmount + mileageDeduction;

    if (totalDeductions > 100) {
      insights.push({
        id: 'tax_deductions_summary',
        type: 'tax_tip',
        priority: 'low',
        title: 'Tax Deductions This Month',
        message: `You've tracked $${totalDeductions.toFixed(2)} in potential tax deductions this month ($${deductibleAmount.toFixed(2)} expenses + $${mileageDeduction.toFixed(2)} mileage).`,
        action: {
          label: 'View Tax Report',
          href: '/reports',
        },
        data: { expenseDeductions: deductibleAmount, mileageDeduction, total: totalDeductions },
      });
    }

    // 5. Uncategorized expenses
    const uncategorizedCount = currentExpensesList.filter(e => !e.category_id).length;
    if (uncategorizedCount > 3) {
      insights.push({
        id: 'uncategorized_expenses',
        type: 'pattern',
        priority: 'medium',
        title: 'Uncategorized Expenses',
        message: `You have ${uncategorizedCount} uncategorized expenses this month. Categorizing them helps with budgeting and tax tracking.`,
        action: {
          label: 'Categorize Now',
          href: '/expenses',
        },
      });
    }

    // 6. Personal vs Business ratio insight
    if (currentTotal > 0) {
      const businessRatio = currentBusiness / currentTotal;
      if (businessRatio < 0.3 && currentBusiness > 0) {
        insights.push({
          id: 'business_ratio',
          type: 'tax_tip',
          priority: 'low',
          title: 'Maximize Business Tracking',
          message: `Only ${(businessRatio * 100).toFixed(0)}% of your expenses are marked as business. Make sure you're capturing all deductible expenses!`,
          action: {
            label: 'Review Expenses',
            href: '/expenses',
          },
        });
      }
    }

    // 7. Mileage tracking reminder
    if (businessMileage === 0 && currentBusiness > 500) {
      insights.push({
        id: 'mileage_reminder',
        type: 'savings_opportunity',
        priority: 'medium',
        title: 'Track Your Mileage',
        message: 'You have business expenses but no mileage logged this month. Business driving is tax deductible at $0.67/mile!',
        action: {
          label: 'Log Mileage',
          href: '/mileage',
        },
      });
    }

    // 8. Mileage deduction highlight - show when user has tracked meaningful mileage
    if (mileageDeduction >= 10) {
      const tripCount = mileageList.filter(m => m.is_business).length;
      insights.push({
        id: 'mileage_deduction_highlight',
        type: 'tax_tip',
        priority: mileageDeduction >= 100 ? 'medium' : 'low',
        title: 'Driving = Tax Savings',
        message: `You added $${mileageDeduction.toFixed(2)} in deductions just by driving! (${businessMileage.toFixed(1)} miles across ${tripCount} trip${tripCount !== 1 ? 's' : ''})`,
        action: {
          label: 'View Mileage',
          href: '/mileage',
        },
        data: { mileageDeduction, businessMileage, tripCount },
      });
    }

    // 9. Year-to-date mileage achievement
    const ytdMiles = ytdMileageList.reduce((sum, m) => sum + Number(m.distance), 0);
    const ytdMileageDeduction = ytdMileageList.reduce((sum, m) => sum + Number(m.amount), 0);
    if (ytdMileageDeduction >= 500) {
      insights.push({
        id: 'ytd_mileage_achievement',
        type: 'achievement',
        priority: 'low',
        title: `${now.getFullYear()} Mileage Tracker`,
        message: `You've driven ${ytdMiles.toFixed(0)} business miles this year = $${ytdMileageDeduction.toFixed(2)} in tax deductions!`,
        action: {
          label: 'View Tax Report',
          href: '/reports',
        },
        data: { ytdMiles, ytdMileageDeduction },
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      success: true,
      insights: insights.slice(0, 6), // Limit to top 6 insights
      summary: {
        currentMonthTotal: currentTotal,
        previousMonthTotal: previousTotal,
        businessExpenses: currentBusiness,
        personalExpenses: currentTotal - currentBusiness,
        totalDeductions: totalDeductions,
        businessMileage,
      },
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
