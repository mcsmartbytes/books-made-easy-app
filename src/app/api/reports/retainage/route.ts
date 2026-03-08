import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/reports/retainage?user_id=xxx&type=receivable|payable
// Retainage aging report — receivable (what customers owe you) or payable (what you owe subs)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const reportType = searchParams.get('type') || 'receivable'; // 'receivable' or 'payable'
  const jobId = searchParams.get('job_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (reportType === 'receivable') {
      return await getRetainageReceivable(userId, jobId);
    } else {
      return await getRetainagePayable(userId, jobId);
    }
  } catch (error) {
    console.error('Error generating retainage report:', error);
    return NextResponse.json({ error: 'Failed to generate retainage report' }, { status: 500 });
  }
}

async function getRetainageReceivable(userId: string, jobId: string | null) {
  // Get invoices with retainage held
  let query = supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, issue_date, due_date, status, total, amount_paid, retainage_percent, retainage_amount, retainage_released, customer_id, job_id, customers(id, name, company), jobs(id, job_number, name)')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .gt('retainage_amount', 0);

  if (jobId) {
    query = query.eq('job_id', jobId);
  }

  const { data, error } = await query.order('issue_date', { ascending: false });
  if (error) throw error;

  const invoices = (data || []) as any[];
  const now = new Date();

  // Calculate aging buckets and build per-invoice detail
  const details = invoices.map((inv: any) => {
    const retainageHeld = Number(inv.retainage_amount) || 0;
    const retainageReleased = Number(inv.retainage_released) || 0;
    const retainageOutstanding = retainageHeld - retainageReleased;

    const issueDate = new Date(inv.issue_date);
    const daysAged = Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));

    let agingBucket: string;
    if (daysAged <= 30) agingBucket = 'current';
    else if (daysAged <= 60) agingBucket = '31-60';
    else if (daysAged <= 90) agingBucket = '61-90';
    else if (daysAged <= 120) agingBucket = '91-120';
    else agingBucket = '120+';

    return {
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      issue_date: inv.issue_date,
      invoice_total: Number(inv.total) || 0,
      retainage_percent: Number(inv.retainage_percent) || 0,
      retainage_held: retainageHeld,
      retainage_released: retainageReleased,
      retainage_outstanding: Math.max(retainageOutstanding, 0),
      days_aged: daysAged,
      aging_bucket: agingBucket,
      customer: inv.customers ? { id: (inv.customers as any).id, name: (inv.customers as any).name, company: (inv.customers as any).company } : null,
      job: inv.jobs ? { id: (inv.jobs as any).id, job_number: (inv.jobs as any).job_number, name: (inv.jobs as any).name } : null,
    };
  }).filter(d => d.retainage_outstanding > 0);

  // Summary by aging bucket
  const buckets = { current: 0, '31-60': 0, '61-90': 0, '91-120': 0, '120+': 0 };
  for (const d of details) {
    buckets[d.aging_bucket as keyof typeof buckets] += d.retainage_outstanding;
  }

  const totalHeld = details.reduce((s, d) => s + d.retainage_held, 0);
  const totalReleased = details.reduce((s, d) => s + d.retainage_released, 0);
  const totalOutstanding = details.reduce((s, d) => s + d.retainage_outstanding, 0);

  // Group by job
  const byJob: Record<string, { job_number: string; job_name: string; outstanding: number; count: number }> = {};
  for (const d of details) {
    if (d.job) {
      const key = d.job.id;
      if (!byJob[key]) {
        byJob[key] = { job_number: d.job.job_number, job_name: d.job.name, outstanding: 0, count: 0 };
      }
      byJob[key].outstanding += d.retainage_outstanding;
      byJob[key].count++;
    }
  }

  return NextResponse.json({
    success: true,
    type: 'receivable',
    data: details,
    by_job: Object.entries(byJob).map(([id, v]) => ({ job_id: id, ...v })),
    summary: {
      total_held: round(totalHeld),
      total_released: round(totalReleased),
      total_outstanding: round(totalOutstanding),
      invoice_count: details.length,
      aging: {
        current: round(buckets.current),
        '31_60': round(buckets['31-60']),
        '61_90': round(buckets['61-90']),
        '91_120': round(buckets['91-120']),
        over_120: round(buckets['120+']),
      },
    },
  });
}

async function getRetainagePayable(userId: string, jobId: string | null) {
  // Get bills with retainage held
  let query = supabaseAdmin
    .from('bills')
    .select('id, bill_number, bill_date, due_date, status, total, amount_paid, retainage_percent, retainage_amount, retainage_released, vendor_id, job_id, vendors(id, name, company), jobs(id, job_number, name)')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .gt('retainage_amount', 0);

  if (jobId) {
    query = query.eq('job_id', jobId);
  }

  const { data, error } = await query.order('bill_date', { ascending: false });
  if (error) throw error;

  const bills = (data || []) as any[];
  const now = new Date();

  const details = bills.map((bill: any) => {
    const retainageHeld = Number(bill.retainage_amount) || 0;
    const retainageReleased = Number(bill.retainage_released) || 0;
    const retainageOutstanding = retainageHeld - retainageReleased;

    const billDate = new Date(bill.bill_date);
    const daysAged = Math.floor((now.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24));

    let agingBucket: string;
    if (daysAged <= 30) agingBucket = 'current';
    else if (daysAged <= 60) agingBucket = '31-60';
    else if (daysAged <= 90) agingBucket = '61-90';
    else if (daysAged <= 120) agingBucket = '91-120';
    else agingBucket = '120+';

    return {
      bill_id: bill.id,
      bill_number: bill.bill_number,
      bill_date: bill.bill_date,
      bill_total: Number(bill.total) || 0,
      retainage_percent: Number(bill.retainage_percent) || 0,
      retainage_held: retainageHeld,
      retainage_released: retainageReleased,
      retainage_outstanding: Math.max(retainageOutstanding, 0),
      days_aged: daysAged,
      aging_bucket: agingBucket,
      vendor: bill.vendors ? { id: (bill.vendors as any).id, name: (bill.vendors as any).name, company: (bill.vendors as any).company } : null,
      job: bill.jobs ? { id: (bill.jobs as any).id, job_number: (bill.jobs as any).job_number, name: (bill.jobs as any).name } : null,
    };
  }).filter(d => d.retainage_outstanding > 0);

  const buckets = { current: 0, '31-60': 0, '61-90': 0, '91-120': 0, '120+': 0 };
  for (const d of details) {
    buckets[d.aging_bucket as keyof typeof buckets] += d.retainage_outstanding;
  }

  const totalHeld = details.reduce((s, d) => s + d.retainage_held, 0);
  const totalReleased = details.reduce((s, d) => s + d.retainage_released, 0);
  const totalOutstanding = details.reduce((s, d) => s + d.retainage_outstanding, 0);

  // Group by vendor
  const byVendor: Record<string, { vendor_name: string; outstanding: number; count: number }> = {};
  for (const d of details) {
    if (d.vendor) {
      const key = d.vendor.id;
      if (!byVendor[key]) {
        byVendor[key] = { vendor_name: d.vendor.company || d.vendor.name, outstanding: 0, count: 0 };
      }
      byVendor[key].outstanding += d.retainage_outstanding;
      byVendor[key].count++;
    }
  }

  return NextResponse.json({
    success: true,
    type: 'payable',
    data: details,
    by_vendor: Object.entries(byVendor).map(([id, v]) => ({ vendor_id: id, ...v })),
    summary: {
      total_held: round(totalHeld),
      total_released: round(totalReleased),
      total_outstanding: round(totalOutstanding),
      bill_count: details.length,
      aging: {
        current: round(buckets.current),
        '31_60': round(buckets['31-60']),
        '61_90': round(buckets['61-90']),
        '91_120': round(buckets['91-120']),
        over_120: round(buckets['120+']),
      },
    },
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
