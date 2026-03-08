import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';
import { calculateCostToComplete, calculateMarginForecast, type CostDataPoint, type ForecastInput } from '@/lib/jobForecasting';

export const dynamic = 'force-dynamic';

// GET /api/jobs/[id]/financial-summary — Consolidated financial view for a single job
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const jobId = params.id;

    // Fetch job with customer and phases
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*, customers(id, name, company), job_phases(*)')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Fetch invoices, bills, expenses, and change orders in parallel
    const [invoicesRes, billsRes, expensesRes, changeOrdersRes] = await Promise.all([
      supabaseAdmin
        .from('invoices')
        .select('id, invoice_number, status, issue_date, due_date, total, amount_paid, customer_id, retainage_percent, retainage_amount, retainage_released')
        .eq('job_id', jobId),
      supabaseAdmin
        .from('bills')
        .select('id, bill_number, status, bill_date, due_date, total, amount_paid, vendor_id, retainage_percent, retainage_amount, retainage_released')
        .eq('job_id', jobId),
      supabaseAdmin
        .from('expenses')
        .select('id, description, amount, date, vendor, category_id')
        .eq('job_id', jobId),
      supabaseAdmin
        .from('change_orders')
        .select('id, co_number, title, status, type, revenue_impact, cost_impact, margin_impact, days_impact, approved_date')
        .eq('job_id', jobId),
    ]);

    const invoices = invoicesRes.data;
    const bills = billsRes.data;
    const expenses = expensesRes.data;

    const allInvoices = invoices || [];
    const allBills = bills || [];
    const allExpenses = expenses || [];
    const allChangeOrders = (changeOrdersRes.data || []) as any[];
    const phases: any[] = Array.isArray(job.job_phases) ? job.job_phases : [];

    // --- Change Orders ---
    const approvedCOs = allChangeOrders.filter((co: any) => co.status === 'approved');
    const pendingCOs = allChangeOrders.filter((co: any) => co.status === 'pending');
    const approvedRevenueImpact = approvedCOs.reduce((s: number, co: any) => s + (Number(co.revenue_impact) || 0), 0);
    const approvedCostImpact = approvedCOs.reduce((s: number, co: any) => s + (Number(co.cost_impact) || 0), 0);
    const pendingRevenueExposure = pendingCOs.reduce((s: number, co: any) => s + (Number(co.revenue_impact) || 0), 0);
    const pendingCostExposure = pendingCOs.reduce((s: number, co: any) => s + (Number(co.cost_impact) || 0), 0);
    const totalDaysImpact = approvedCOs.reduce((s: number, co: any) => s + (Number(co.days_impact) || 0), 0);

    // --- Contract & Budget (with Change Orders) ---
    const originalContractValue = Number(job.estimated_revenue) || 0;
    const originalEstimatedCost = Number(job.estimated_cost) || 0;
    const contractValue = originalContractValue + approvedRevenueImpact;
    const estimatedCost = originalEstimatedCost + approvedCostImpact;
    const estimatedProfit = contractValue - estimatedCost;
    const estimatedMargin = contractValue > 0 ? (estimatedProfit / contractValue) * 100 : 0;

    // --- Billings ---
    const activeInvoices = allInvoices.filter((i: any) => i.status !== 'cancelled');
    const billingsToDate = activeInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0);
    const paymentsReceived = activeInvoices.reduce((s: number, i: any) => s + (i.amount_paid || 0), 0);
    const outstandingAR = billingsToDate - paymentsReceived;
    const invoicesByStatus = {
      draft: activeInvoices.filter((i: any) => i.status === 'draft'),
      sent: activeInvoices.filter((i: any) => i.status === 'sent'),
      paid: activeInvoices.filter((i: any) => i.status === 'paid'),
      overdue: activeInvoices.filter((i: any) => i.status === 'overdue'),
    };

    // --- Retainage (Receivable) ---
    const retainageReceivableHeld = activeInvoices.reduce((s: number, i: any) => s + (Number(i.retainage_amount) || 0), 0);
    const retainageReceivableReleased = activeInvoices.reduce((s: number, i: any) => s + (Number(i.retainage_released) || 0), 0);
    const retainageReceivableOutstanding = retainageReceivableHeld - retainageReceivableReleased;

    // --- Costs ---
    const activeBills = allBills.filter((b: any) => b.status !== 'cancelled');
    const committedCosts = activeBills.reduce((s: number, b: any) => s + (b.total || 0), 0);
    const billsPaid = activeBills.reduce((s: number, b: any) => s + (b.amount_paid || 0), 0);
    const outstandingAP = committedCosts - billsPaid;
    const expenseCosts = allExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
    const totalActualCost = Math.max(committedCosts + expenseCosts, Number(job.actual_cost) || 0);

    // --- Retainage (Payable) ---
    const retainagePayableHeld = activeBills.reduce((s: number, b: any) => s + (Number(b.retainage_amount) || 0), 0);
    const retainagePayableReleased = activeBills.reduce((s: number, b: any) => s + (Number(b.retainage_released) || 0), 0);
    const retainagePayableOutstanding = retainagePayableHeld - retainagePayableReleased;

    // --- Completion ---
    const totalPhases = phases.length;
    const completedPhases = phases.filter((p: any) => p.status === 'completed').length;
    const inProgressPhases = phases.filter((p: any) => p.status === 'in_progress').length;

    const pctCompleteCost = estimatedCost > 0
      ? Math.min((totalActualCost / estimatedCost) * 100, 100)
      : 0;
    const pctCompletePhases = totalPhases > 0
      ? (completedPhases / totalPhases) * 100
      : 0;

    // --- WIP Calculations ---
    const percentComplete = pctCompleteCost; // default to cost method
    const revenueRecognized = (percentComplete / 100) * contractValue;
    const billingDiff = billingsToDate - revenueRecognized;
    const overbilling = billingDiff > 0 ? billingDiff : 0;
    const underbilling = billingDiff < 0 ? Math.abs(billingDiff) : 0;
    const remainingBacklog = contractValue - revenueRecognized;

    // --- Profitability ---
    const grossProfit = revenueRecognized - totalActualCost;
    const grossMargin = revenueRecognized > 0 ? (grossProfit / revenueRecognized) * 100 : 0;
    const actualProfit = billingsToDate - totalActualCost;

    // --- Cost History for Forecasting ---
    const costHistory: CostDataPoint[] = [
      ...allExpenses.map((e: any) => ({ date: String(e.date), amount: Number(e.amount) || 0 })),
      ...activeBills.map((b: any) => ({ date: String(b.bill_date), amount: Number(b.total) || 0 })),
    ].filter(d => d.date && d.amount > 0).sort((a, b) => a.date.localeCompare(b.date));

    // --- Forecasting Engine ---
    const forecastInput: ForecastInput = {
      contractValue,
      estimatedCost,
      actualCost: totalActualCost,
      percentComplete,
      costHistory,
    };

    const ctc = calculateCostToComplete(forecastInput);
    const marginForecast = calculateMarginForecast(forecastInput, ctc);

    // Use recommended values for backward compatibility
    const costToComplete = ctc.recommended_etc;
    const projectedTotalCost = ctc.recommended_eac;
    const projectedProfit = contractValue - projectedTotalCost;
    const projectedMargin = contractValue > 0 ? (projectedProfit / contractValue) * 100 : 0;

    // --- Burn Rate ---
    let burnRate = null;
    if (costHistory.length >= 2) {
      const firstDate = new Date(costHistory[0].date);
      const lastDate = new Date(costHistory[costHistory.length - 1].date);
      const daySpan = Math.max((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24), 1);
      const dailyBurn = totalActualCost / daySpan;
      const weeklyBurn = dailyBurn * 7;
      const monthlyBurn = dailyBurn * 30;
      const daysRemaining = costToComplete > 0 && dailyBurn > 0
        ? Math.ceil(costToComplete / dailyBurn)
        : null;
      const projectedCompletionDate = daysRemaining
        ? new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null;

      burnRate = {
        daily: Math.round(dailyBurn * 100) / 100,
        weekly: Math.round(weeklyBurn * 100) / 100,
        monthly: Math.round(monthlyBurn * 100) / 100,
        days_of_cost_data: Math.round(daySpan),
        estimated_days_remaining: daysRemaining,
        projected_completion_date: projectedCompletionDate,
        trend: ctc.burn_rate_trend,
      };
    }

    // --- Margin Health ---
    let marginHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (marginForecast.projected_margin < 5 || (estimatedMargin > 0 && marginForecast.projected_margin < estimatedMargin * 0.5)) {
      marginHealth = 'critical';
    } else if (estimatedMargin > 0 && marginForecast.projected_margin < estimatedMargin * 0.8) {
      marginHealth = 'warning';
    }

    // --- Risk Indicators ---
    const risks: string[] = [];
    if (pctCompleteCost > 90 && pctCompletePhases < 50) {
      risks.push('Cost nearly exhausted but phases incomplete — potential overrun');
    }
    if (totalActualCost > estimatedCost) {
      risks.push(`Over budget by ${formatCurrency(totalActualCost - estimatedCost)}`);
    }
    if (underbilling > contractValue * 0.2) {
      risks.push(`Significant underbilling: ${formatCurrency(underbilling)} — cash flow risk`);
    }
    if (overbilling > contractValue * 0.3) {
      risks.push(`High overbilling: ${formatCurrency(overbilling)} — liability exposure`);
    }
    if (outstandingAR > billingsToDate * 0.5) {
      risks.push(`${formatCurrency(outstandingAR)} in outstanding receivables — collection risk`);
    }
    if (marginHealth === 'critical') {
      risks.push('Gross margin critically low — review cost controls');
    }
    if (retainageReceivableOutstanding > contractValue * 0.08) {
      risks.push(`Retainage receivable ${formatCurrency(retainageReceivableOutstanding)} — significant cash tied up`);
    }
    if (pendingRevenueExposure > contractValue * 0.1) {
      risks.push(`Pending COs: ${formatCurrency(pendingRevenueExposure)} revenue exposure — ${pendingCOs.length} awaiting approval`);
    }
    if (burnRate && burnRate.projected_completion_date && job.end_date) {
      const projected = new Date(burnRate.projected_completion_date);
      const planned = new Date(String(job.end_date));
      if (projected > planned) {
        const daysOver = Math.ceil((projected.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
        risks.push(`Burn rate projects ${daysOver} days past planned end date`);
      }
    }

    const summary = {
      job: {
        id: job.id,
        job_number: job.job_number,
        name: job.name,
        status: job.status,
        customer: job.customers ? { id: (job.customers as any).id, name: (job.customers as any).name, company: (job.customers as any).company } : null,
        start_date: job.start_date,
        end_date: job.end_date,
      },

      contract: {
        original_value: originalContractValue,
        revised_value: round(contractValue),
        original_cost: originalEstimatedCost,
        estimated_cost: round(estimatedCost),
        estimated_profit: round(estimatedProfit),
        estimated_margin: round(estimatedMargin),
        co_revenue_impact: round(approvedRevenueImpact),
        co_cost_impact: round(approvedCostImpact),
      },

      completion: {
        percent_complete_cost: round(pctCompleteCost),
        percent_complete_phases: round(pctCompletePhases),
        total_phases: totalPhases,
        completed_phases: completedPhases,
        in_progress_phases: inProgressPhases,
        pending_phases: totalPhases - completedPhases - inProgressPhases,
      },

      billings: {
        billings_to_date: round(billingsToDate),
        payments_received: round(paymentsReceived),
        outstanding_ar: round(outstandingAR),
        invoices_count: activeInvoices.length,
        draft_count: invoicesByStatus.draft.length,
        sent_count: invoicesByStatus.sent.length,
        paid_count: invoicesByStatus.paid.length,
        overdue_count: invoicesByStatus.overdue.length,
      },

      costs: {
        total_actual_cost: round(totalActualCost),
        committed_costs: round(committedCosts),
        expense_costs: round(expenseCosts),
        bills_paid: round(billsPaid),
        outstanding_ap: round(outstandingAP),
        cost_to_complete: round(costToComplete),
        projected_total_cost: round(projectedTotalCost),
        bills_count: activeBills.length,
        expenses_count: allExpenses.length,
      },

      wip: {
        revenue_recognized: round(revenueRecognized),
        billings_to_date: round(billingsToDate),
        overbilling: round(overbilling),
        underbilling: round(underbilling),
        remaining_backlog: round(remainingBacklog),
        billing_status: overbilling > 0 ? 'overbilled' : underbilling > 0 ? 'underbilled' : 'even',
      },

      profitability: {
        gross_profit: round(grossProfit),
        gross_margin: round(grossMargin),
        actual_profit: round(actualProfit),
        projected_profit: round(projectedProfit),
        projected_margin: round(projectedMargin),
        margin_health: marginHealth,
        margin_variance: round(grossMargin - estimatedMargin),
      },

      change_orders: {
        total_count: allChangeOrders.length,
        approved_count: approvedCOs.length,
        pending_count: pendingCOs.length,
        approved_revenue_impact: round(approvedRevenueImpact),
        approved_cost_impact: round(approvedCostImpact),
        pending_revenue_exposure: round(pendingRevenueExposure),
        pending_cost_exposure: round(pendingCostExposure),
        total_days_impact: totalDaysImpact,
      },

      retainage: {
        receivable: {
          held: round(retainageReceivableHeld),
          released: round(retainageReceivableReleased),
          outstanding: round(Math.max(retainageReceivableOutstanding, 0)),
        },
        payable: {
          held: round(retainagePayableHeld),
          released: round(retainagePayableReleased),
          outstanding: round(Math.max(retainagePayableOutstanding, 0)),
        },
        net_retainage: round(Math.max(retainageReceivableOutstanding, 0) - Math.max(retainagePayableOutstanding, 0)),
      },

      burn_rate: burnRate,

      forecast: {
        cost_to_complete: ctc,
        margin_forecast: marginForecast,
      },

      risks,

      // Raw data for drill-down
      _invoices: activeInvoices,
      _bills: activeBills,
      _expenses: allExpenses,
      _phases: phases,
    };

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error generating financial summary:', error);
    return NextResponse.json({ error: 'Failed to generate financial summary' }, { status: 500 });
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
