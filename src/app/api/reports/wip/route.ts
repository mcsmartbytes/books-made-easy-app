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

    // Fetch all invoices linked to these jobs (billings to date)
    const jobIds = jobs.map((j: any) => j.id);

    const { data: invoices, error: invError } = await supabaseAdmin
      .from('invoices')
      .select('id, job_id, total, status')
      .in('job_id', jobIds);

    if (invError) throw invError;

    // Fetch all bills linked to these jobs (actual costs)
    const { data: bills, error: billsError } = await supabaseAdmin
      .from('bills')
      .select('id, job_id, total, status')
      .in('job_id', jobIds);

    if (billsError) throw billsError;

    // Group invoices and bills by job_id
    const invoicesByJob: Record<string, number> = {};
    const costsByJob: Record<string, number> = {};

    (invoices || []).forEach((inv: any) => {
      if (inv.status !== 'cancelled') {
        invoicesByJob[inv.job_id] = (invoicesByJob[inv.job_id] || 0) + (inv.total || 0);
      }
    });

    (bills || []).forEach((bill: any) => {
      if (bill.status !== 'cancelled') {
        costsByJob[bill.job_id] = (costsByJob[bill.job_id] || 0) + (bill.total || 0);
      }
    });

    // Calculate WIP for each job
    const wipData: WipJobData[] = jobs.map((job: any) => {
      const contractValue = job.estimated_revenue || 0;
      const estimatedCost = job.estimated_cost || 0;
      const phases = job.job_phases || [];
      const totalPhases = phases.length;
      const completedPhases = phases.filter((p: any) => p.status === 'completed').length;

      // Actual cost: use bills linked to job, or job.actual_cost, whichever is greater
      const billsCost = costsByJob[job.id] || 0;
      const actualCost = Math.max(billsCost, job.actual_cost || 0);

      // % Complete calculations
      const pctCompleteCost = estimatedCost > 0
        ? Math.min((actualCost / estimatedCost) * 100, 100)
        : 0;
      const pctCompletePhases = totalPhases > 0
        ? (completedPhases / totalPhases) * 100
        : 0;

      // Use selected method
      const percentComplete = method === 'phases' ? pctCompletePhases : pctCompleteCost;

      // Revenue Recognized = % Complete x Contract Value
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

      const customer = job.customers;

      return {
        id: job.id,
        job_number: job.job_number,
        name: job.name,
        customer_name: customer?.company || customer?.name || 'Unknown',
        status: job.status,
        start_date: job.start_date,
        end_date: job.end_date,
        contract_value: contractValue,
        estimated_cost: estimatedCost,
        actual_cost: actualCost,
        total_phases: totalPhases,
        completed_phases: completedPhases,
        percent_complete_cost: Math.round(pctCompleteCost * 100) / 100,
        percent_complete_phases: Math.round(pctCompletePhases * 100) / 100,
        percent_complete: Math.round(percentComplete * 100) / 100,
        revenue_recognized: Math.round(revenueRecognized * 100) / 100,
        billings_to_date: Math.round(billingsToDate * 100) / 100,
        overbilling: Math.round(overbilling * 100) / 100,
        underbilling: Math.round(underbilling * 100) / 100,
        earned_revenue: Math.round(earnedRevenue * 100) / 100,
        remaining_backlog: Math.round(remainingBacklog * 100) / 100,
        gross_profit: Math.round(grossProfit * 100) / 100,
        gross_profit_margin: Math.round(grossProfitMargin * 100) / 100,
      };
    });

    // Summary totals
    const summary = {
      total_contract_value: wipData.reduce((s, j) => s + j.contract_value, 0),
      total_revenue_recognized: wipData.reduce((s, j) => s + j.revenue_recognized, 0),
      total_billings: wipData.reduce((s, j) => s + j.billings_to_date, 0),
      total_overbilling: wipData.reduce((s, j) => s + j.overbilling, 0),
      total_underbilling: wipData.reduce((s, j) => s + j.underbilling, 0),
      total_remaining_backlog: wipData.reduce((s, j) => s + j.remaining_backlog, 0),
      total_earned_revenue: wipData.reduce((s, j) => s + j.earned_revenue, 0),
      total_gross_profit: wipData.reduce((s, j) => s + j.gross_profit, 0),
      total_actual_cost: wipData.reduce((s, j) => s + j.actual_cost, 0),
      total_estimated_cost: wipData.reduce((s, j) => s + j.estimated_cost, 0),
      job_count: wipData.length,
      net_overbilling: wipData.reduce((s, j) => s + j.overbilling, 0) - wipData.reduce((s, j) => s + j.underbilling, 0),
    };

    return NextResponse.json({ success: true, data: wipData, summary });
  } catch (error) {
    console.error('Error generating WIP report:', error);
    return NextResponse.json({ error: 'Failed to generate WIP report' }, { status: 500 });
  }
}
