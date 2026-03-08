import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';
import { generateId } from '@/lib/syncProtocol';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/sitesense/sov?user_id=xxx&job_id=xxx
 *
 * View SOV lines synced from SiteSense.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const jobId = searchParams.get('job_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    let query = supabaseAdmin
      .from('sov_lines')
      .select('*')
      .eq('user_id', userId);

    if (jobId) query = query.eq('job_id', jobId);

    const { data, error } = await query.order('sort_order', { ascending: true });

    if (error) throw error;

    // Calculate totals per job
    const byJob: Record<string, any> = {};
    for (const line of (data || []) as any[]) {
      const jid = line.job_id;
      if (!byJob[jid]) {
        byJob[jid] = {
          job_id: jid,
          total_scheduled: 0,
          total_completed: 0,
          total_stored: 0,
          total_retainage: 0,
          lines: [],
        };
      }
      byJob[jid].total_scheduled += Number(line.scheduled_value) || 0;
      byJob[jid].total_completed +=
        (Number(line.work_completed_previous) || 0) +
        (Number(line.work_completed_this_period) || 0);
      byJob[jid].total_stored += Number(line.materials_stored) || 0;
      const lineTotal =
        (Number(line.work_completed_previous) || 0) +
        (Number(line.work_completed_this_period) || 0) +
        (Number(line.materials_stored) || 0);
      byJob[jid].total_retainage += lineTotal * ((Number(line.retainage_pct) || 10) / 100);
      byJob[jid].lines.push(line);
    }

    return NextResponse.json({
      success: true,
      data: jobId ? (byJob[jobId] || { lines: [] }) : Object.values(byJob),
    });
  } catch (error: any) {
    console.error('Error fetching SOV:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch SOV' }, { status: 500 });
  }
}

/**
 * POST /api/sync/sitesense/sov — Generate progress invoice from SOV lines
 *
 * Body: { user_id, entity_id?, job_id, period_end_date, action: 'generate_invoice' }
 *
 * Creates an AIA-style progress billing invoice from current SOV data.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, entity_id, job_id, period_end_date, action } = body;

    if (!user_id || !job_id) {
      return NextResponse.json({ error: 'user_id and job_id are required' }, { status: 400 });
    }

    if (action !== 'generate_invoice') {
      return NextResponse.json({ error: 'Invalid action. Use "generate_invoice"' }, { status: 400 });
    }

    // Get SOV lines for this job
    const { data: sovLines, error: sovError } = await supabaseAdmin
      .from('sov_lines')
      .select('*')
      .eq('user_id', user_id)
      .eq('job_id', job_id)
      .order('sort_order', { ascending: true });

    if (sovError) throw sovError;
    if (!sovLines || sovLines.length === 0) {
      return NextResponse.json({ error: 'No SOV lines found for this job' }, { status: 400 });
    }

    // Get job info for customer
    const { data: job } = await supabaseAdmin
      .from('jobs')
      .select('*, customers(id)')
      .eq('id', job_id)
      .single();

    // Calculate progress billing amounts
    let totalThisPeriod = 0;
    let totalRetainage = 0;
    const invoiceItems: any[] = [];

    for (const line of sovLines as any[]) {
      const thisPeriod = Number(line.work_completed_this_period) || 0;
      const retainagePct = (Number(line.retainage_pct) || 10) / 100;
      const retainageAmount = thisPeriod * retainagePct;
      const netThisPeriod = thisPeriod - retainageAmount;

      if (thisPeriod > 0) {
        invoiceItems.push({
          description: `Item ${line.line_number}: ${line.description}`,
          quantity: 1,
          rate: netThisPeriod,
          amount: netThisPeriod,
          sort_order: line.sort_order || line.line_number,
        });
      }

      totalThisPeriod += thisPeriod;
      totalRetainage += retainageAmount;
    }

    if (invoiceItems.length === 0) {
      return NextResponse.json({
        error: 'No work completed this period — nothing to invoice',
      }, { status: 400 });
    }

    const netAmount = totalThisPeriod - totalRetainage;

    // Generate invoice number
    const { data: invoiceCount } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .eq('user_id', user_id);

    const invoiceNumber = `AIA-${String(((invoiceCount || []).length) + 1001).padStart(4, '0')}`;

    // Create progress invoice
    const invoiceId = generateId();
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        id: invoiceId,
        user_id,
        entity_id: entity_id || null,
        customer_id: (job as any)?.customer_id || null,
        job_id,
        external_source: 'sitesense',
        invoice_number: invoiceNumber,
        issue_date: period_end_date || new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal: netAmount,
        total: netAmount,
        retainage_percent: (sovLines[0] as any)?.retainage_pct || 10,
        retainage_amount: totalRetainage,
        status: 'draft',
        notes: `AIA Progress Billing — Period ending ${period_end_date || 'current'}. Retainage withheld: $${totalRetainage.toFixed(2)}`,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Create invoice items
    const items = invoiceItems.map((item, idx) => ({
      id: generateId(),
      invoice_id: invoiceId,
      ...item,
      sort_order: idx,
    }));

    if (items.length > 0) {
      await supabaseAdmin.from('invoice_items').insert(items);
    }

    return NextResponse.json({
      success: true,
      data: {
        invoice,
        summary: {
          total_this_period: totalThisPeriod,
          retainage_withheld: totalRetainage,
          net_amount: netAmount,
          line_items: invoiceItems.length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error generating invoice:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate invoice' }, { status: 500 });
  }
}
