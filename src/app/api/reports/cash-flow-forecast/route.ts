import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface WeekBucket {
  week_start: string;
  week_end: string;
  label: string;
  inflows: number;
  outflows: number;
  retainage_receivable_release: number;
  retainage_payable_release: number;
  net: number;
  cumulative: number;
}

// GET /api/reports/cash-flow-forecast?user_id=xxx&weeks=12&job_id=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const weeksAhead = Math.min(Number(searchParams.get('weeks')) || 12, 26);
  const jobId = searchParams.get('job_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    // Build date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of current week (Sunday)
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + weeksAhead * 7);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch data in parallel
    let invoicesQuery = supabaseAdmin
      .from('invoices')
      .select('id, job_id, total, amount_paid, due_date, status, retainage_amount, retainage_released')
      .eq('user_id', userId)
      .in('status', ['sent', 'overdue', 'draft']);
    if (jobId) invoicesQuery = invoicesQuery.eq('job_id', jobId);

    let billsQuery = supabaseAdmin
      .from('bills')
      .select('id, job_id, total, amount_paid, due_date, status, retainage_amount, retainage_released')
      .eq('user_id', userId)
      .in('status', ['unpaid', 'overdue', 'draft']);
    if (jobId) billsQuery = billsQuery.eq('job_id', jobId);

    let jobsQuery = supabaseAdmin
      .from('jobs')
      .select('id, job_number, name, estimated_revenue, estimated_cost, actual_cost, start_date, end_date, retainage_percent')
      .eq('user_id', userId)
      .in('status', ['active', 'in_progress', 'pending']);
    if (jobId) jobsQuery = jobsQuery.eq('id', jobId);

    const [invoicesRes, billsRes, jobsRes] = await Promise.all([
      invoicesQuery,
      billsQuery,
      jobsQuery,
    ]);

    const invoices = (invoicesRes.data || []) as any[];
    const bills = (billsRes.data || []) as any[];
    const jobs = (jobsRes.data || []) as any[];

    // Generate week buckets
    const weeks: WeekBucket[] = [];
    for (let w = 0; w < weeksAhead; w++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      weeks.push({
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        label: `Week ${w + 1}`,
        inflows: 0,
        outflows: 0,
        retainage_receivable_release: 0,
        retainage_payable_release: 0,
        net: 0,
        cumulative: 0,
      });
    }

    // Place invoice payments into weekly buckets based on due date
    for (const inv of invoices) {
      const remaining = (Number(inv.total) || 0) - (Number(inv.amount_paid) || 0);
      if (remaining <= 0) continue;

      const dueDate = inv.due_date || now.toISOString().split('T')[0];
      const weekIdx = getWeekIndex(dueDate, startDate, weeksAhead);
      if (weekIdx >= 0 && weekIdx < weeks.length) {
        weeks[weekIdx].inflows += remaining;
      } else if (weekIdx < 0) {
        // Overdue — expect in current week
        weeks[0].inflows += remaining;
      }
    }

    // Place bill payments into weekly buckets based on due date
    for (const bill of bills) {
      const remaining = (Number(bill.total) || 0) - (Number(bill.amount_paid) || 0);
      if (remaining <= 0) continue;

      const dueDate = bill.due_date || now.toISOString().split('T')[0];
      const weekIdx = getWeekIndex(dueDate, startDate, weeksAhead);
      if (weekIdx >= 0 && weekIdx < weeks.length) {
        weeks[weekIdx].outflows += remaining;
      } else if (weekIdx < 0) {
        // Overdue — expect in current week
        weeks[0].outflows += remaining;
      }
    }

    // Estimate ongoing burn rate for jobs without enough committed bills
    // Use historical spending to project future outflows
    for (const job of jobs) {
      const estCost = Number(job.estimated_cost) || 0;
      const actualCost = Number(job.actual_cost) || 0;
      const remainingCost = Math.max(estCost - actualCost, 0);

      if (remainingCost <= 0) continue;

      // Calculate committed outflows already placed
      const jobBillsTotal = bills
        .filter((b: any) => b.job_id === job.id)
        .reduce((s: number, b: any) => s + Math.max((Number(b.total) || 0) - (Number(b.amount_paid) || 0), 0), 0);

      // Uncommitted remaining cost to spread
      const uncommitted = Math.max(remainingCost - jobBillsTotal, 0);
      if (uncommitted <= 0) continue;

      // Estimate how many weeks of work remain
      const jobEndDate = job.end_date ? new Date(String(job.end_date)) : endDate;
      const weeksRemaining = Math.max(
        Math.ceil((jobEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)),
        1
      );
      const weeklyBurn = uncommitted / weeksRemaining;

      // Spread across future weeks
      for (let w = 1; w < weeks.length && w <= weeksRemaining; w++) {
        weeks[w].outflows += weeklyBurn;
      }
    }

    // Calculate retainage release estimates
    // Retainage is typically released at substantial completion — model as lump in final weeks
    const totalRetRec = invoices.reduce((s: number, i: any) => {
      return s + Math.max((Number(i.retainage_amount) || 0) - (Number(i.retainage_released) || 0), 0);
    }, 0);
    const totalRetPay = bills.reduce((s: number, b: any) => {
      return s + Math.max((Number(b.retainage_amount) || 0) - (Number(b.retainage_released) || 0), 0);
    }, 0);

    // Place retainage releases in the last quarter of the forecast period
    if (totalRetRec > 0 || totalRetPay > 0) {
      const releaseWeek = Math.max(Math.floor(weeks.length * 0.75), weeks.length - 4);
      if (releaseWeek < weeks.length) {
        weeks[releaseWeek].retainage_receivable_release = totalRetRec;
        weeks[releaseWeek].retainage_payable_release = totalRetPay;
        weeks[releaseWeek].inflows += totalRetRec;
        weeks[releaseWeek].outflows += totalRetPay;
      }
    }

    // Calculate net and cumulative
    let cumulative = 0;
    for (const week of weeks) {
      week.inflows = round(week.inflows);
      week.outflows = round(week.outflows);
      week.retainage_receivable_release = round(week.retainage_receivable_release);
      week.retainage_payable_release = round(week.retainage_payable_release);
      week.net = round(week.inflows - week.outflows);
      cumulative += week.net;
      week.cumulative = round(cumulative);
    }

    // Summary
    const totalInflows = weeks.reduce((s, w) => s + w.inflows, 0);
    const totalOutflows = weeks.reduce((s, w) => s + w.outflows, 0);
    const lowestPoint = Math.min(...weeks.map(w => w.cumulative));
    const lowestWeek = weeks.find(w => w.cumulative === lowestPoint);
    const negativeWeeks = weeks.filter(w => w.cumulative < 0);

    // Cash flow health
    let cashFlowHealth: 'healthy' | 'caution' | 'critical' = 'healthy';
    if (lowestPoint < -totalInflows * 0.3) {
      cashFlowHealth = 'critical';
    } else if (negativeWeeks.length > weeks.length * 0.3 || lowestPoint < 0) {
      cashFlowHealth = 'caution';
    }

    return NextResponse.json({
      success: true,
      data: weeks,
      summary: {
        period_weeks: weeksAhead,
        start_date: startStr,
        end_date: endStr,
        total_projected_inflows: round(totalInflows),
        total_projected_outflows: round(totalOutflows),
        net_cash_flow: round(totalInflows - totalOutflows),
        lowest_cumulative: round(lowestPoint),
        lowest_week: lowestWeek?.label || null,
        negative_weeks: negativeWeeks.length,
        retainage_receivable_pending: round(totalRetRec),
        retainage_payable_pending: round(totalRetPay),
        cash_flow_health: cashFlowHealth,
        jobs_count: jobs.length,
      },
    });
  } catch (error) {
    console.error('Error generating cash flow forecast:', error);
    return NextResponse.json({ error: 'Failed to generate cash flow forecast' }, { status: 500 });
  }
}

function getWeekIndex(dateStr: string, startDate: Date, maxWeeks: number): number {
  const date = new Date(dateStr + 'T00:00:00');
  const diff = date.getTime() - startDate.getTime();
  const weekIdx = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
  return weekIdx;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
