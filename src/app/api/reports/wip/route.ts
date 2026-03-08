import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface WipJobData {
  id: string;
  job_number: string;
  name: string;
  customer_name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  original_contract_value: number;
  contract_value: number;
  estimated_cost: number;
  actual_cost: number;
  total_phases: number;
  completed_phases: number;
  percent_complete_cost: number;
  percent_complete_phases: number;
  percent_complete: number;
  revenue_recognized: number;
  billings_to_date: number;
  overbilling: number;
  underbilling: number;
  earned_revenue: number;
  remaining_backlog: number;
  gross_profit: number;
  gross_profit_margin: number;
  retainage_receivable: number;
  retainage_payable: number;
  approved_cos: number;
  pending_cos: number;
  billing_trend: 'improving' | 'stable' | 'worsening';
}

// GET /api/reports/wip - Work In Progress report
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const method = searchParams.get('method') || 'cost'; // 'cost' or 'phases'
  const statusFilter = searchParams.get('status'); // optional: filter by job status

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    // Fetch all active jobs with customer info and phases
    let jobsQuery = supabaseAdmin
      .from('jobs')
      .select('*, customers(id, name, company), job_phases(*)')
      .eq('user_id', userId);

    if (statusFilter) {
      jobsQuery = jobsQuery.eq('status', statusFilter);
    }

    const { data: jobs, error: jobsError } = await jobsQuery.order('created_at', { ascending: false });

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        summary: {
          total_contract_value: 0,
          total_revenue_recognized: 0,
          total_billings: 0,
          total_overbilling: 0,
          total_underbilling: 0,
          total_remaining_backlog: 0,
          total_earned_revenue: 0,
          total_gross_profit: 0,
          job_count: 0,
        },
      });
    }

    // Fetch all invoices, bills, and change orders linked to these jobs
    const jobIds = jobs.map((j: any) => j.id);

    const [invoicesRes, billsRes, changeOrdersRes] = await Promise.all([
      supabaseAdmin
        .from('invoices')
        .select('id, job_id, total, status, retainage_amount, retainage_released')
        .in('job_id', jobIds),
      supabaseAdmin
        .from('bills')
        .select('id, job_id, total, status, retainage_amount, retainage_released')
        .in('job_id', jobIds),
      supabaseAdmin
        .from('change_orders')
        .select('id, job_id, status, revenue_impact, cost_impact')
        .in('job_id', jobIds),
    ]);

    if (invoicesRes.error) throw invoicesRes.error;
    if (billsRes.error) throw billsRes.error;

    const invoices = invoicesRes.data || [];
    const bills = billsRes.data || [];
    const changeOrders = (changeOrdersRes.data || []) as any[];

    // Group by job_id
    const invoicesByJob: Record<string, number> = {};
    const costsByJob: Record<string, number> = {};
    const retainageRecByJob: Record<string, number> = {};
    const retainagePayByJob: Record<string, number> = {};
    const approvedCORevenueByJob: Record<string, number> = {};
    const approvedCOCostByJob: Record<string, number> = {};
    const pendingCOByJob: Record<string, number> = {};

    (invoices as any[]).forEach((inv: any) => {
      if (inv.status !== 'cancelled') {
        invoicesByJob[inv.job_id] = (invoicesByJob[inv.job_id] || 0) + (Number(inv.total) || 0);
        const retOutstanding = Math.max((Number(inv.retainage_amount) || 0) - (Number(inv.retainage_released) || 0), 0);
        retainageRecByJob[inv.job_id] = (retainageRecByJob[inv.job_id] || 0) + retOutstanding;
      }
    });

    (bills as any[]).forEach((bill: any) => {
      if (bill.status !== 'cancelled') {
        costsByJob[bill.job_id] = (costsByJob[bill.job_id] || 0) + (Number(bill.total) || 0);
        const retOutstanding = Math.max((Number(bill.retainage_amount) || 0) - (Number(bill.retainage_released) || 0), 0);
        retainagePayByJob[bill.job_id] = (retainagePayByJob[bill.job_id] || 0) + retOutstanding;
      }
    });

    changeOrders.forEach((co: any) => {
      if (co.status === 'approved') {
        approvedCORevenueByJob[co.job_id] = (approvedCORevenueByJob[co.job_id] || 0) + (Number(co.revenue_impact) || 0);
        approvedCOCostByJob[co.job_id] = (approvedCOCostByJob[co.job_id] || 0) + (Number(co.cost_impact) || 0);
      }
      if (co.status === 'pending') {
        pendingCOByJob[co.job_id] = (pendingCOByJob[co.job_id] || 0) + 1;
      }
    });

    // Calculate WIP for each job
    const wipData: WipJobData[] = jobs.map((job: any) => {
      const originalContractValue = Number(job.estimated_revenue) || 0;
      const coRevenue = approvedCORevenueByJob[job.id] || 0;
      const coCost = approvedCOCostByJob[job.id] || 0;
      const contractValue = originalContractValue + coRevenue;
      const estimatedCost = (Number(job.estimated_cost) || 0) + coCost;
      const phases = job.job_phases || [];
      const totalPhases = phases.length;
      const completedPhases = phases.filter((p: any) => p.status === 'completed').length;

      // Actual cost: use bills linked to job, or job.actual_cost, whichever is greater
      const billsCost = costsByJob[job.id] || 0;
      const actualCost = Math.max(billsCost, Number(job.actual_cost) || 0);

      // % Complete calculations
      const pctCompleteCost = estimatedCost > 0
        ? Math.min((actualCost / estimatedCost) * 100, 100)
        : 0;
      const pctCompletePhases = totalPhases > 0
        ? (completedPhases / totalPhases) * 100
        : 0;

      // Use selected method
      const percentComplete = method === 'phases' ? pctCompletePhases : pctCompleteCost;

      // Revenue Recognized = % Complete x Revised Contract Value
      const revenueRecognized = (percentComplete / 100) * contractValue;

      // Billings to Date = total of all non-cancelled invoices for this job
      const billingsToDate = invoicesByJob[job.id] || 0;

      // Over/Under billing
      const billingDiff = billingsToDate - revenueRecognized;
      const overbilling = billingDiff > 0 ? billingDiff : 0;
      const underbilling = billingDiff < 0 ? Math.abs(billingDiff) : 0;

      // Earned Revenue = Revenue Recognized
      const earnedRevenue = revenueRecognized;

      // Remaining Backlog = Contract Value - Revenue Recognized
      const remainingBacklog = contractValue - revenueRecognized;

      // Gross Profit
      const grossProfit = revenueRecognized - actualCost;
      const grossProfitMargin = revenueRecognized > 0
        ? (grossProfit / revenueRecognized) * 100
        : 0;

      // Billing trend: compare billing ratio to completion
      const billingRatio = contractValue > 0 ? billingsToDate / contractValue : 0;
      const completionRatio = percentComplete / 100;
      let billingTrend: WipJobData['billing_trend'] = 'stable';
      if (billingRatio > completionRatio * 1.15) billingTrend = 'improving';
      else if (billingRatio < completionRatio * 0.85) billingTrend = 'worsening';

      const customer = job.customers;

      return {
        id: job.id,
        job_number: job.job_number,
        name: job.name,
        customer_name: customer?.company || customer?.name || 'Unknown',
        status: job.status,
        start_date: job.start_date,
        end_date: job.end_date,
        original_contract_value: originalContractValue,
        contract_value: round(contractValue),
        estimated_cost: round(estimatedCost),
        actual_cost: round(actualCost),
        total_phases: totalPhases,
        completed_phases: completedPhases,
        percent_complete_cost: round(pctCompleteCost),
        percent_complete_phases: round(pctCompletePhases),
        percent_complete: round(percentComplete),
        revenue_recognized: round(revenueRecognized),
        billings_to_date: round(billingsToDate),
        overbilling: round(overbilling),
        underbilling: round(underbilling),
        earned_revenue: round(earnedRevenue),
        remaining_backlog: round(remainingBacklog),
        gross_profit: round(grossProfit),
        gross_profit_margin: round(grossProfitMargin),
        retainage_receivable: round(retainageRecByJob[job.id] || 0),
        retainage_payable: round(retainagePayByJob[job.id] || 0),
        approved_cos: approvedCORevenueByJob[job.id] ? 1 : 0, // simplified count
        pending_cos: pendingCOByJob[job.id] || 0,
        billing_trend: billingTrend,
      };
    });

    // Summary totals
    const totalOverbilling = wipData.reduce((s, j) => s + j.overbilling, 0);
    const totalUnderbilling = wipData.reduce((s, j) => s + j.underbilling, 0);

    const summary = {
      total_contract_value: round(wipData.reduce((s, j) => s + j.contract_value, 0)),
      total_revenue_recognized: round(wipData.reduce((s, j) => s + j.revenue_recognized, 0)),
      total_billings: round(wipData.reduce((s, j) => s + j.billings_to_date, 0)),
      total_overbilling: round(totalOverbilling),
      total_underbilling: round(totalUnderbilling),
      total_remaining_backlog: round(wipData.reduce((s, j) => s + j.remaining_backlog, 0)),
      total_earned_revenue: round(wipData.reduce((s, j) => s + j.earned_revenue, 0)),
      total_gross_profit: round(wipData.reduce((s, j) => s + j.gross_profit, 0)),
      total_actual_cost: round(wipData.reduce((s, j) => s + j.actual_cost, 0)),
      total_estimated_cost: round(wipData.reduce((s, j) => s + j.estimated_cost, 0)),
      total_retainage_receivable: round(wipData.reduce((s, j) => s + j.retainage_receivable, 0)),
      total_retainage_payable: round(wipData.reduce((s, j) => s + j.retainage_payable, 0)),
      job_count: wipData.length,
      net_overbilling: round(totalOverbilling - totalUnderbilling),
      jobs_overbilled: wipData.filter(j => j.overbilling > 0).length,
      jobs_underbilled: wipData.filter(j => j.underbilling > 0).length,
      jobs_worsening: wipData.filter(j => j.billing_trend === 'worsening').length,
    };

    return NextResponse.json({ success: true, data: wipData, summary });
  } catch (error) {
    console.error('Error generating WIP report:', error);
    return NextResponse.json({ error: 'Failed to generate WIP report' }, { status: 500 });
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
