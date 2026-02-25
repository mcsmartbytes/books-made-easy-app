import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';
import {
  YearEndSummary,
  QuarterlySummary,
  ScheduleCLineSummary,
  CategorySummary,
  VendorSummary,
  generateYearEndCSV,
  getQuarter,
  getQuarterLabel,
} from '@/lib/exports';

export const dynamic = 'force-dynamic';

// GET - generate year-end summary
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const format = searchParams.get('format') || 'json'; // 'json' or 'csv'

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Fetch all expenses for the year
    const { data: expenses, error: expError } = await supabaseAdmin
      .from('expenses')
      .select(`
        id, date, amount, is_business, vendor,
        categories(name, icon, deduction_percentage, schedule_c_line)
      `)
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (expError) throw expError;

    // Fetch mileage for the year
    const { data: mileage, error: mileError } = await supabaseAdmin
      .from('mileage')
      .select('id, date, distance, rate, amount')
      .eq('user_id', userId)
      .eq('is_business', true)
      .gte('date', startDate)
      .lte('date', endDate);

    if (mileError) throw mileError;

    // Calculate totals
    let totalExpenses = 0;
    let totalBusinessExpenses = 0;
    let totalPersonalExpenses = 0;
    let totalDeductible = 0;

    // Initialize quarterly data
    const quarterlyData: Record<number, QuarterlySummary> = {};
    for (let q = 1; q <= 4; q++) {
      quarterlyData[q] = {
        quarter: q,
        label: getQuarterLabel(q),
        total: 0,
        business: 0,
        personal: 0,
        expense_count: 0,
      };
    }

    // Initialize Schedule C data
    const scheduleCData: Record<string, ScheduleCLineSummary> = {};

    // Initialize category data
    const categoryData: Record<string, CategorySummary> = {};

    // Initialize vendor data
    const vendorData: Record<string, VendorSummary> = {};

    // Process expenses
    const expenseList = (expenses || []) as any[];
    for (const expense of expenseList) {
      const amount = parseFloat(expense.amount);
      const date = new Date(expense.date);
      const quarter = getQuarter(date);
      const cat = expense.categories as unknown as {
        name: string;
        icon: string;
        deduction_percentage: number;
        schedule_c_line: string;
      } | null;
      const deductionPct = cat?.deduction_percentage || 0;
      const deductibleAmt = (amount * deductionPct) / 100;
      const catName = cat?.name || 'Uncategorized';
      const catIcon = cat?.icon || '📦';
      const scLine = cat?.schedule_c_line || 'Other';
      const vendorName = expense.vendor || 'Unknown';

      totalExpenses += amount;

      if (expense.is_business) {
        totalBusinessExpenses += amount;
        totalDeductible += deductibleAmt;
      } else {
        totalPersonalExpenses += amount;
      }

      // Quarterly
      quarterlyData[quarter].total += amount;
      quarterlyData[quarter].expense_count += 1;
      if (expense.is_business) {
        quarterlyData[quarter].business += amount;
      } else {
        quarterlyData[quarter].personal += amount;
      }

      // Schedule C (only business expenses)
      if (expense.is_business) {
        if (!scheduleCData[scLine]) {
          scheduleCData[scLine] = {
            line: scLine,
            line_name: scLine,
            total: 0,
            deductible: 0,
            expense_count: 0,
          };
        }
        scheduleCData[scLine].total += amount;
        scheduleCData[scLine].deductible += deductibleAmt;
        scheduleCData[scLine].expense_count += 1;
      }

      // Categories
      if (!categoryData[catName]) {
        categoryData[catName] = {
          name: catName,
          icon: catIcon,
          total: 0,
          count: 0,
          percentage: 0,
        };
      }
      categoryData[catName].total += amount;
      categoryData[catName].count += 1;

      // Vendors
      if (!vendorData[vendorName]) {
        vendorData[vendorName] = {
          name: vendorName,
          total: 0,
          count: 0,
        };
      }
      vendorData[vendorName].total += amount;
      vendorData[vendorName].count += 1;
    }

    // Calculate category percentages
    for (const cat of Object.values(categoryData)) {
      cat.percentage = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
    }

    // Mileage totals
    const mileageList = (mileage || []) as any[];
    const mileageTotalMiles = mileageList.reduce((sum, m) => sum + parseFloat(m.distance), 0);
    const mileageTotalDeduction = mileageList.reduce((sum, m) => sum + parseFloat(m.amount), 0);

    // Add mileage to deductible total
    totalDeductible += mileageTotalDeduction;

    // Build summary
    const summary: YearEndSummary = {
      year,
      total_expenses: totalExpenses,
      total_business_expenses: totalBusinessExpenses,
      total_personal_expenses: totalPersonalExpenses,
      total_deductible: totalDeductible,
      estimated_tax_savings: totalDeductible * 0.24,
      mileage_total_miles: mileageTotalMiles,
      mileage_total_deduction: mileageTotalDeduction,
      by_quarter: Object.values(quarterlyData),
      by_schedule_c_line: Object.values(scheduleCData).sort((a, b) => b.total - a.total),
      top_categories: Object.values(categoryData)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      top_vendors: Object.values(vendorData)
        .filter((v) => v.name !== 'Unknown')
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
    };

    // Return CSV if requested
    if (format === 'csv') {
      const csv = generateYearEndCSV(summary);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="year-end-summary-${year}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('Error generating year-end summary:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
