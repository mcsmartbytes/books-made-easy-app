import { NextRequest, NextResponse } from 'next/server';
import { execSql } from '@/lib/turso';

export const dynamic = 'force-dynamic';

interface CostCodeVariance {
  cost_code_id: string;
  code: string;
  division: string;
  name: string;
  budget: number;
  actual: number;
  variance: number;
  variance_pct: number;
  percent_complete: number;
  trend: 'under' | 'on_track' | 'over' | 'critical';
  bill_count: number;
  expense_count: number;
  remaining: number;
}

// GET /api/reports/cost-code-variance?user_id=xxx&job_id=xxx
// Returns budget vs actual vs variance per cost code for a job (or all jobs)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const jobId = searchParams.get('job_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    // Get budgets (per cost code, optionally per job)
    let budgetSql = `
      SELECT ccb.cost_code_id, ccb.job_id,
             cc.code, cc.division, cc.name, cc.description,
             ccb.budget_amount
      FROM cost_code_budgets ccb
      JOIN cost_codes cc ON cc.id = ccb.cost_code_id
      WHERE ccb.user_id = ?
    `;
    const budgetArgs: (string | number)[] = [userId];

    if (jobId) {
      budgetSql += ' AND ccb.job_id = ?';
      budgetArgs.push(jobId);
    }

    const budgets = await execSql(budgetSql, budgetArgs);

    if (budgets.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          total_budget: 0,
          total_actual: 0,
          total_variance: 0,
          codes_over_budget: 0,
          codes_on_track: 0,
          codes_under_budget: 0,
          overall_trend: 'on_track',
        },
      });
    }

    // Get actual costs from bills tagged with cost codes
    let billSql = `
      SELECT b.cost_code_id, SUM(b.total) as total_cost, COUNT(*) as cnt
      FROM bills b
      WHERE b.user_id = ? AND b.cost_code_id IS NOT NULL AND b.status != 'cancelled'
    `;
    const billArgs: (string | number)[] = [userId];

    if (jobId) {
      billSql += ' AND b.job_id = ?';
      billArgs.push(jobId);
    }

    billSql += ' GROUP BY b.cost_code_id';
    const billActuals = await execSql(billSql, billArgs);

    // Get actual costs from bill items tagged with cost codes
    let billItemSql = `
      SELECT bi.cost_code_id, SUM(bi.amount) as total_cost, COUNT(*) as cnt
      FROM bill_items bi
      JOIN bills b ON b.id = bi.bill_id
      WHERE b.user_id = ? AND bi.cost_code_id IS NOT NULL AND b.status != 'cancelled'
    `;
    const billItemArgs: (string | number)[] = [userId];

    if (jobId) {
      billItemSql += ' AND b.job_id = ?';
      billItemArgs.push(jobId);
    }

    billItemSql += ' GROUP BY bi.cost_code_id';
    const billItemActuals = await execSql(billItemSql, billItemArgs);

    // Get actual costs from expenses tagged with cost codes
    let expSql = `
      SELECT e.cost_code_id, SUM(e.amount) as total_cost, COUNT(*) as cnt
      FROM expenses e
      WHERE e.user_id = ? AND e.cost_code_id IS NOT NULL
    `;
    const expArgs: (string | number)[] = [userId];

    if (jobId) {
      expSql += ' AND e.job_id = ?';
      expArgs.push(jobId);
    }

    expSql += ' GROUP BY e.cost_code_id';
    const expenseActuals = await execSql(expSql, expArgs);

    // Build lookup maps for actuals
    const billMap: Record<string, { total: number; count: number }> = {};
    for (const row of billActuals as any[]) {
      billMap[row.cost_code_id] = { total: Number(row.total_cost) || 0, count: Number(row.cnt) || 0 };
    }

    // Merge bill item actuals into bill map
    for (const row of billItemActuals as any[]) {
      if (billMap[row.cost_code_id]) {
        billMap[row.cost_code_id].total += Number(row.total_cost) || 0;
        billMap[row.cost_code_id].count += Number(row.cnt) || 0;
      } else {
        billMap[row.cost_code_id] = { total: Number(row.total_cost) || 0, count: Number(row.cnt) || 0 };
      }
    }

    const expMap: Record<string, { total: number; count: number }> = {};
    for (const row of expenseActuals as any[]) {
      expMap[row.cost_code_id] = { total: Number(row.total_cost) || 0, count: Number(row.cnt) || 0 };
    }

    // Aggregate budgets per cost code (sum across jobs if no job filter)
    const codeAgg: Record<string, { budget: number; code: string; division: string; name: string; description: string }> = {};
    for (const b of budgets as any[]) {
      const ccId = b.cost_code_id;
      if (!codeAgg[ccId]) {
        codeAgg[ccId] = {
          budget: 0,
          code: b.code,
          division: b.division,
          name: b.name,
          description: b.description,
        };
      }
      codeAgg[ccId].budget += Number(b.budget_amount) || 0;
    }

    // Calculate variance per cost code
    const variances: CostCodeVariance[] = Object.entries(codeAgg).map(([ccId, info]) => {
      const budget = info.budget;
      const billActual = billMap[ccId]?.total || 0;
      const expActual = expMap[ccId]?.total || 0;
      const actual = billActual + expActual;
      const variance = budget - actual; // positive = under budget
      const variancePct = budget > 0 ? (variance / budget) * 100 : 0;
      const percentComplete = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
      const remaining = Math.max(budget - actual, 0);

      let trend: CostCodeVariance['trend'] = 'on_track';
      if (actual > budget) {
        trend = 'critical';
      } else if (budget > 0 && actual > budget * 0.9) {
        trend = 'over';
      } else if (budget > 0 && actual < budget * 0.5) {
        trend = 'under';
      }

      return {
        cost_code_id: ccId,
        code: info.code,
        division: info.division,
        name: info.name,
        budget: Math.round(budget * 100) / 100,
        actual: Math.round(actual * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        variance_pct: Math.round(variancePct * 100) / 100,
        percent_complete: Math.round(percentComplete * 100) / 100,
        trend,
        bill_count: (billMap[ccId]?.count || 0),
        expense_count: (expMap[ccId]?.count || 0),
        remaining: Math.round(remaining * 100) / 100,
      };
    });

    // Sort by code
    variances.sort((a, b) => a.code.localeCompare(b.code));

    // Summary
    const totalBudget = variances.reduce((s, v) => s + v.budget, 0);
    const totalActual = variances.reduce((s, v) => s + v.actual, 0);
    const totalVariance = totalBudget - totalActual;
    const codesOver = variances.filter(v => v.trend === 'critical' || v.trend === 'over').length;
    const codesOnTrack = variances.filter(v => v.trend === 'on_track').length;
    const codesUnder = variances.filter(v => v.trend === 'under').length;

    let overallTrend: string = 'on_track';
    if (totalActual > totalBudget) overallTrend = 'critical';
    else if (totalBudget > 0 && totalActual > totalBudget * 0.9) overallTrend = 'over';
    else if (totalBudget > 0 && totalActual < totalBudget * 0.5) overallTrend = 'under';

    return NextResponse.json({
      success: true,
      data: variances,
      summary: {
        total_budget: Math.round(totalBudget * 100) / 100,
        total_actual: Math.round(totalActual * 100) / 100,
        total_variance: Math.round(totalVariance * 100) / 100,
        total_variance_pct: totalBudget > 0 ? Math.round((totalVariance / totalBudget) * 10000) / 100 : 0,
        codes_over_budget: codesOver,
        codes_on_track: codesOnTrack,
        codes_under_budget: codesUnder,
        overall_trend: overallTrend,
      },
    });
  } catch (error) {
    console.error('Error generating cost code variance report:', error);
    return NextResponse.json({ error: 'Failed to generate cost code variance report' }, { status: 500 });
  }
}
