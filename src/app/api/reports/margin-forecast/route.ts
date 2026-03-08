import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';
import { calculateCostToComplete, calculateMarginForecast, type CostDataPoint, type ForecastInput } from '@/lib/jobForecasting';

export const dynamic = 'force-dynamic';

// GET /api/reports/margin-forecast?user_id=xxx
// Cross-job margin forecast report — shows projected margins for all active jobs
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    // Fetch all active jobs
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select('id, job_number, name, status, estimated_revenue, estimated_cost, actual_cost, start_date, end_date, customers(id, name, company)')
      .eq('user_id', userId)
      .in('status', ['active', 'in_progress', 'pending']);

    if (jobsError) {
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    const allJobs = jobs || [];

    if (allJobs.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          total_contract_value: 0,
          total_estimated_cost: 0,
          total_actual_cost: 0,
          total_projected_cost: 0,
          total_projected_profit: 0,
          weighted_projected_margin: 0,
          weighted_original_margin: 0,
          portfolio_margin_erosion: 0,
          jobs_healthy: 0,
          jobs_warning: 0,
          jobs_critical: 0,
          avg_confidence: 'low',
        },
      });
    }

    // Fetch all invoices, bills, expenses for these jobs in bulk
    const jobIds = allJobs.map((j: any) => j.id);

    const [invoicesRes, billsRes, expensesRes] = await Promise.all([
      supabaseAdmin
        .from('invoices')
        .select('id, job_id, status, total, amount_paid')
        .in('job_id', jobIds),
      supabaseAdmin
        .from('bills')
        .select('id, job_id, status, total, amount_paid, bill_date')
        .in('job_id', jobIds),
      supabaseAdmin
        .from('expenses')
        .select('id, job_id, amount, date')
        .in('job_id', jobIds),
    ]);

    const allInvoices = invoicesRes.data || [];
    const allBills = billsRes.data || [];
    const allExpenses = expensesRes.data || [];

    // Group by job
    const invoicesByJob: Record<string, any[]> = {};
    const billsByJob: Record<string, any[]> = {};
    const expensesByJob: Record<string, any[]> = {};

    for (const inv of allInvoices as any[]) {
      const jid = String(inv.job_id);
      if (!invoicesByJob[jid]) invoicesByJob[jid] = [];
      invoicesByJob[jid].push(inv);
    }
    for (const bill of allBills as any[]) {
      const jid = String(bill.job_id);
      if (!billsByJob[jid]) billsByJob[jid] = [];
      billsByJob[jid].push(bill);
    }
    for (const exp of allExpenses as any[]) {
      const jid = String(exp.job_id);
      if (!expensesByJob[jid]) expensesByJob[jid] = [];
      expensesByJob[jid].push(exp);
    }

    // Calculate forecast per job
    const jobForecasts = allJobs.map((job: any) => {
      const contractValue = Number(job.estimated_revenue) || 0;
      const estimatedCost = Number(job.estimated_cost) || 0;

      const jobInvoices = (invoicesByJob[job.id] || []).filter((i: any) => i.status !== 'cancelled');
      const jobBills = (billsByJob[job.id] || []).filter((b: any) => b.status !== 'cancelled');
      const jobExpenses = expensesByJob[job.id] || [];

      const committedCosts = jobBills.reduce((s: number, b: any) => s + (Number(b.total) || 0), 0);
      const expenseCosts = jobExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      const totalActualCost = Math.max(committedCosts + expenseCosts, Number(job.actual_cost) || 0);

      const billingsToDate = jobInvoices.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);

      const pctComplete = estimatedCost > 0
        ? Math.min((totalActualCost / estimatedCost) * 100, 100)
        : 0;

      // Build cost history
      const costHistory: CostDataPoint[] = [
        ...jobExpenses.map((e: any) => ({ date: String(e.date), amount: Number(e.amount) || 0 })),
        ...jobBills.map((b: any) => ({ date: String(b.bill_date), amount: Number(b.total) || 0 })),
      ].filter(d => d.date && d.amount > 0).sort((a, b) => a.date.localeCompare(b.date));

      const forecastInput: ForecastInput = {
        contractValue,
        estimatedCost,
        actualCost: totalActualCost,
        percentComplete: pctComplete,
        costHistory,
      };

      const ctc = calculateCostToComplete(forecastInput);
      const marginForecast = calculateMarginForecast(forecastInput, ctc);

      // Margin health
      const originalMargin = contractValue > 0
        ? ((contractValue - estimatedCost) / contractValue) * 100
        : 0;

      let marginHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (marginForecast.projected_margin < 5 || (originalMargin > 0 && marginForecast.projected_margin < originalMargin * 0.5)) {
        marginHealth = 'critical';
      } else if (originalMargin > 0 && marginForecast.projected_margin < originalMargin * 0.8) {
        marginHealth = 'warning';
      }

      return {
        job_id: job.id,
        job_number: job.job_number,
        job_name: job.name,
        status: job.status,
        customer: job.customers
          ? { name: (job.customers as any).name, company: (job.customers as any).company }
          : null,
        contract_value: contractValue,
        estimated_cost: estimatedCost,
        actual_cost: round(totalActualCost),
        billings_to_date: round(billingsToDate),
        percent_complete: round(pctComplete),
        cpi: ctc.cpi,
        original_margin: marginForecast.original_margin,
        current_margin_pct: marginForecast.current_margin_pct,
        projected_margin: marginForecast.projected_margin,
        projected_profit: marginForecast.projected_profit,
        projected_total_cost: ctc.recommended_eac,
        margin_erosion: marginForecast.margin_erosion,
        margin_health: marginHealth,
        confidence: marginForecast.confidence,
        confidence_reason: marginForecast.confidence_reason,
        method_used: ctc.method_used,
        burn_rate_trend: ctc.burn_rate_trend,
        vac: ctc.vac_recommended,
      };
    });

    // Sort: critical first, then warning, then healthy
    const healthOrder = { critical: 0, warning: 1, healthy: 2 };
    jobForecasts.sort((a, b) => healthOrder[a.margin_health] - healthOrder[b.margin_health]);

    // Portfolio summary
    const totalContractValue = jobForecasts.reduce((s, j) => s + j.contract_value, 0);
    const totalEstimatedCost = jobForecasts.reduce((s, j) => s + j.estimated_cost, 0);
    const totalActualCost = jobForecasts.reduce((s, j) => s + j.actual_cost, 0);
    const totalProjectedCost = jobForecasts.reduce((s, j) => s + j.projected_total_cost, 0);
    const totalProjectedProfit = totalContractValue - totalProjectedCost;

    const weightedProjectedMargin = totalContractValue > 0
      ? (totalProjectedProfit / totalContractValue) * 100
      : 0;

    const totalOriginalProfit = totalContractValue - totalEstimatedCost;
    const weightedOriginalMargin = totalContractValue > 0
      ? (totalOriginalProfit / totalContractValue) * 100
      : 0;

    const portfolioErosion = weightedProjectedMargin - weightedOriginalMargin;

    const jobsHealthy = jobForecasts.filter(j => j.margin_health === 'healthy').length;
    const jobsWarning = jobForecasts.filter(j => j.margin_health === 'warning').length;
    const jobsCritical = jobForecasts.filter(j => j.margin_health === 'critical').length;

    // Average confidence
    const confScores = { high: 3, medium: 2, low: 1 };
    const avgConfScore = jobForecasts.length > 0
      ? jobForecasts.reduce((s, j) => s + confScores[j.confidence], 0) / jobForecasts.length
      : 1;
    const avgConfidence = avgConfScore >= 2.5 ? 'high' : avgConfScore >= 1.5 ? 'medium' : 'low';

    return NextResponse.json({
      success: true,
      data: jobForecasts,
      summary: {
        total_contract_value: round(totalContractValue),
        total_estimated_cost: round(totalEstimatedCost),
        total_actual_cost: round(totalActualCost),
        total_projected_cost: round(totalProjectedCost),
        total_projected_profit: round(totalProjectedProfit),
        weighted_projected_margin: round(weightedProjectedMargin),
        weighted_original_margin: round(weightedOriginalMargin),
        portfolio_margin_erosion: round(portfolioErosion),
        jobs_healthy: jobsHealthy,
        jobs_warning: jobsWarning,
        jobs_critical: jobsCritical,
        avg_confidence: avgConfidence,
      },
    });
  } catch (error) {
    console.error('Error generating margin forecast report:', error);
    return NextResponse.json({ error: 'Failed to generate margin forecast report' }, { status: 500 });
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
