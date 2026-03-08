import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';
import { calculateCostToComplete, calculateMarginForecast, type CostDataPoint, type ForecastInput } from '@/lib/jobForecasting';

export const dynamic = 'force-dynamic';

interface ConstructionAlert {
  id: string;
  type: 'cost_overrun' | 'retainage_accumulation' | 'change_order_exposure' | 'underbilling' |
        'cash_flow_shortfall' | 'margin_erosion' | 'ctc_exceeds_budget' | 'schedule_risk' |
        'overbilling_liability' | 'collection_risk';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  job_id: string;
  job_number: string;
  job_name: string;
  metric_value?: number;
  threshold_value?: number;
}

// GET /api/alerts/construction?user_id=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    // Fetch all active jobs with related data
    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('id, job_number, name, status, estimated_revenue, estimated_cost, actual_cost, start_date, end_date, retainage_percent')
      .eq('user_id', userId)
      .in('status', ['active', 'in_progress', 'pending']);

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ success: true, data: [], summary: { total: 0, critical: 0, warning: 0, info: 0 } });
    }

    const jobIds = (jobs as any[]).map((j: any) => j.id);

    // Fetch all financial data in parallel
    const [invoicesRes, billsRes, expensesRes, changeOrdersRes] = await Promise.all([
      supabaseAdmin
        .from('invoices')
        .select('id, job_id, total, amount_paid, status, issue_date, retainage_amount, retainage_released')
        .in('job_id', jobIds)
        .neq('status', 'cancelled'),
      supabaseAdmin
        .from('bills')
        .select('id, job_id, total, amount_paid, status, bill_date, retainage_amount, retainage_released')
        .in('job_id', jobIds)
        .neq('status', 'cancelled'),
      supabaseAdmin
        .from('expenses')
        .select('id, job_id, amount, date')
        .in('job_id', jobIds),
      supabaseAdmin
        .from('change_orders')
        .select('id, job_id, status, revenue_impact, cost_impact')
        .in('job_id', jobIds),
    ]);

    const allInvoices = (invoicesRes.data || []) as any[];
    const allBills = (billsRes.data || []) as any[];
    const allExpenses = (expensesRes.data || []) as any[];
    const allCOs = (changeOrdersRes.data || []) as any[];

    const alerts: ConstructionAlert[] = [];

    for (const job of jobs as any[]) {
      const contractValue = Number(job.estimated_revenue) || 0;
      const estimatedCost = Number(job.estimated_cost) || 0;

      // Get job-specific data
      const jobInvoices = allInvoices.filter((i: any) => i.job_id === job.id);
      const jobBills = allBills.filter((b: any) => b.job_id === job.id);
      const jobExpenses = allExpenses.filter((e: any) => e.job_id === job.id);
      const jobCOs = allCOs.filter((co: any) => co.job_id === job.id);

      // Approved CO impacts
      const approvedCOs = jobCOs.filter((co: any) => co.status === 'approved');
      const pendingCOs = jobCOs.filter((co: any) => co.status === 'pending');
      const coRevenue = approvedCOs.reduce((s: number, co: any) => s + (Number(co.revenue_impact) || 0), 0);
      const coCost = approvedCOs.reduce((s: number, co: any) => s + (Number(co.cost_impact) || 0), 0);
      const revisedContract = contractValue + coRevenue;
      const revisedEstCost = estimatedCost + coCost;

      // Costs
      const committedCosts = jobBills.reduce((s: number, b: any) => s + (Number(b.total) || 0), 0);
      const expenseCosts = jobExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      const totalActualCost = Math.max(committedCosts + expenseCosts, Number(job.actual_cost) || 0);

      // Billings
      const billingsToDate = jobInvoices.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
      const paymentsReceived = jobInvoices.reduce((s: number, i: any) => s + (Number(i.amount_paid) || 0), 0);
      const outstandingAR = billingsToDate - paymentsReceived;

      // Completion
      const pctComplete = revisedEstCost > 0 ? Math.min((totalActualCost / revisedEstCost) * 100, 100) : 0;
      const revenueRecognized = (pctComplete / 100) * revisedContract;

      // Over/under billing
      const billingDiff = billingsToDate - revenueRecognized;
      const overbilling = billingDiff > 0 ? billingDiff : 0;
      const underbilling = billingDiff < 0 ? Math.abs(billingDiff) : 0;

      // Retainage
      const retainageRec = jobInvoices.reduce((s: number, i: any) =>
        s + Math.max((Number(i.retainage_amount) || 0) - (Number(i.retainage_released) || 0), 0), 0);

      // Forecasting
      const costHistory: CostDataPoint[] = [
        ...jobExpenses.map((e: any) => ({ date: String(e.date), amount: Number(e.amount) || 0 })),
        ...jobBills.map((b: any) => ({ date: String(b.bill_date), amount: Number(b.total) || 0 })),
      ].filter(d => d.date && d.amount > 0).sort((a, b) => a.date.localeCompare(b.date));

      const forecastInput: ForecastInput = {
        contractValue: revisedContract,
        estimatedCost: revisedEstCost,
        actualCost: totalActualCost,
        percentComplete: pctComplete,
        costHistory,
      };

      const ctc = calculateCostToComplete(forecastInput);
      const marginForecast = calculateMarginForecast(forecastInput, ctc);

      const originalMargin = contractValue > 0 ? ((contractValue - estimatedCost) / contractValue) * 100 : 0;

      // --- ALERT RULES ---

      // 1. Cost Overrun (actual > budget)
      if (totalActualCost > revisedEstCost) {
        const overAmount = totalActualCost - revisedEstCost;
        alerts.push({
          id: `cost_overrun_${job.id}`,
          type: 'cost_overrun',
          severity: overAmount > revisedEstCost * 0.1 ? 'critical' : 'warning',
          title: 'Cost Overrun',
          message: `Actual cost exceeds budget by $${formatNum(overAmount)} (${((overAmount / revisedEstCost) * 100).toFixed(1)}% over)`,
          job_id: job.id,
          job_number: job.job_number,
          job_name: job.name,
          metric_value: totalActualCost,
          threshold_value: revisedEstCost,
        });
      } else if (totalActualCost > revisedEstCost * 0.9 && pctComplete < 85) {
        alerts.push({
          id: `cost_overrun_warning_${job.id}`,
          type: 'cost_overrun',
          severity: 'warning',
          title: 'Budget Nearly Exhausted',
          message: `90%+ of budget used at only ${pctComplete.toFixed(0)}% completion`,
          job_id: job.id,
          job_number: job.job_number,
          job_name: job.name,
          metric_value: pctComplete,
        });
      }

      // 2. Retainage Accumulation
      if (retainageRec > revisedContract * 0.08) {
        alerts.push({
          id: `retainage_${job.id}`,
          type: 'retainage_accumulation',
          severity: retainageRec > revisedContract * 0.12 ? 'warning' : 'info',
          title: 'Retainage Accumulation',
          message: `$${formatNum(retainageRec)} in retainage receivable (${((retainageRec / revisedContract) * 100).toFixed(1)}% of contract)`,
          job_id: job.id,
          job_number: job.job_number,
          job_name: job.name,
          metric_value: retainageRec,
        });
      }

      // 3. Change Order Exposure
      const pendingExposure = pendingCOs.reduce((s: number, co: any) => s + (Number(co.revenue_impact) || 0), 0);
      if (pendingExposure > revisedContract * 0.1 && pendingCOs.length > 0) {
        alerts.push({
          id: `co_exposure_${job.id}`,
          type: 'change_order_exposure',
          severity: pendingExposure > revisedContract * 0.2 ? 'critical' : 'warning',
          title: 'Change Order Exposure',
          message: `${pendingCOs.length} pending COs totaling $${formatNum(pendingExposure)} (${((pendingExposure / revisedContract) * 100).toFixed(1)}% of contract)`,
          job_id: job.id,
          job_number: job.job_number,
          job_name: job.name,
          metric_value: pendingExposure,
        });
      }

      // 4. Underbilling Threshold
      if (underbilling > revisedContract * 0.15) {
        alerts.push({
          id: `underbilling_${job.id}`,
          type: 'underbilling',
          severity: underbilling > revisedContract * 0.25 ? 'critical' : 'warning',
          title: 'Underbilling Alert',
          message: `$${formatNum(underbilling)} underbilled — work performed but not yet invoiced, cash flow risk`,
          job_id: job.id,
          job_number: job.job_number,
          job_name: job.name,
          metric_value: underbilling,
        });
      }

      // 5. Overbilling Liability
      if (overbilling > revisedContract * 0.25) {
        alerts.push({
          id: `overbilling_${job.id}`,
          type: 'overbilling_liability',
          severity: 'warning',
          title: 'Overbilling Liability',
          message: `$${formatNum(overbilling)} overbilled — billings exceed earned revenue, liability exposure`,
          job_id: job.id,
          job_number: job.job_number,
          job_name: job.name,
          metric_value: overbilling,
        });
      }

      // 6. Margin Erosion
      if (originalMargin > 0 && marginForecast.margin_erosion < -5) {
        alerts.push({
          id: `margin_erosion_${job.id}`,
          type: 'margin_erosion',
          severity: marginForecast.margin_erosion < -10 ? 'critical' : 'warning',
          title: 'Margin Erosion',
          message: `Projected margin ${marginForecast.projected_margin.toFixed(1)}% vs estimated ${originalMargin.toFixed(1)}% (${marginForecast.margin_erosion.toFixed(1)}% erosion)`,
          job_id: job.id,
          job_number: job.job_number,
          job_name: job.name,
          metric_value: marginForecast.projected_margin,
          threshold_value: originalMargin,
        });
      }

      // 7. CTC Exceeds Remaining Budget
      if (ctc.vac_recommended < 0 && pctComplete > 20) {
        alerts.push({
          id: `ctc_budget_${job.id}`,
          type: 'ctc_exceeds_budget',
          severity: Math.abs(ctc.vac_recommended) > revisedEstCost * 0.1 ? 'critical' : 'warning',
          title: 'Projected Cost Overrun',
          message: `Cost-to-complete projects $${formatNum(Math.abs(ctc.vac_recommended))} over budget (EAC: $${formatNum(ctc.recommended_eac)})`,
          job_id: job.id,
          job_number: job.job_number,
          job_name: job.name,
          metric_value: ctc.recommended_eac,
          threshold_value: revisedEstCost,
        });
      }

      // 8. Schedule Risk (burn rate projects past end date)
      if (costHistory.length >= 2 && job.end_date) {
        const firstDate = new Date(costHistory[0].date);
        const lastDate = new Date(costHistory[costHistory.length - 1].date);
        const daySpan = Math.max((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24), 1);
        const dailyBurn = totalActualCost / daySpan;
        const costToComplete = ctc.recommended_etc;

        if (dailyBurn > 0 && costToComplete > 0) {
          const daysRemaining = Math.ceil(costToComplete / dailyBurn);
          const projectedEnd = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);
          const plannedEnd = new Date(String(job.end_date));

          if (projectedEnd > plannedEnd) {
            const daysOver = Math.ceil((projectedEnd.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
            alerts.push({
              id: `schedule_${job.id}`,
              type: 'schedule_risk',
              severity: daysOver > 30 ? 'critical' : 'warning',
              title: 'Schedule Risk',
              message: `Burn rate projects completion ${daysOver} days past planned end date (${String(job.end_date)})`,
              job_id: job.id,
              job_number: job.job_number,
              job_name: job.name,
              metric_value: daysOver,
            });
          }
        }
      }

      // 9. Collection Risk
      if (outstandingAR > billingsToDate * 0.5 && outstandingAR > 5000) {
        alerts.push({
          id: `collection_${job.id}`,
          type: 'collection_risk',
          severity: outstandingAR > billingsToDate * 0.7 ? 'critical' : 'warning',
          title: 'Collection Risk',
          message: `$${formatNum(outstandingAR)} outstanding (${((outstandingAR / billingsToDate) * 100).toFixed(0)}% of billings unpaid)`,
          job_id: job.id,
          job_number: job.job_number,
          job_name: job.name,
          metric_value: outstandingAR,
          threshold_value: billingsToDate,
        });
      }
    }

    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const summary = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
      jobs_with_alerts: new Set(alerts.map(a => a.job_id)).size,
      jobs_total: (jobs as any[]).length,
    };

    return NextResponse.json({ success: true, data: alerts, summary });
  } catch (error) {
    console.error('Error generating construction alerts:', error);
    return NextResponse.json({ error: 'Failed to generate construction alerts' }, { status: 500 });
  }
}

function formatNum(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
