import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';
import { generateId } from '@/lib/syncProtocol';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/sitesense/timecards?user_id=xxx&status=xxx&job_id=xxx
 *
 * View synced timecards with filtering.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const status = searchParams.get('status');
  const jobId = searchParams.get('job_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    let query = supabaseAdmin
      .from('timecards')
      .select('*')
      .eq('user_id', userId);

    if (status) query = query.eq('status', status);
    if (jobId) query = query.eq('job_id', jobId);

    const { data, error } = await query.order('work_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Error fetching timecards:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch timecards' }, { status: 500 });
  }
}

/**
 * POST /api/sync/sitesense/timecards — Post approved timecards to payroll (as bills)
 *
 * Body: { user_id, entity_id?, timecard_ids: string[], action: 'post_to_payroll' }
 *
 * Groups timecards by job, sums costs, creates a bill per job group.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, entity_id, timecard_ids, action } = body;

    if (!user_id || !timecard_ids || !Array.isArray(timecard_ids)) {
      return NextResponse.json({ error: 'user_id and timecard_ids are required' }, { status: 400 });
    }

    if (action !== 'post_to_payroll') {
      return NextResponse.json({ error: 'Invalid action. Use "post_to_payroll"' }, { status: 400 });
    }

    // Fetch the selected timecards
    const { data: timecards, error: fetchError } = await supabaseAdmin
      .from('timecards')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'approved')
      .in('id', timecard_ids);

    if (fetchError) throw fetchError;
    if (!timecards || timecards.length === 0) {
      return NextResponse.json({ error: 'No approved timecards found for the given IDs' }, { status: 400 });
    }

    // Group by job_id
    const jobGroups: Record<string, any[]> = {};
    for (const tc of timecards as any[]) {
      const jobId = tc.job_id || 'unassigned';
      if (!jobGroups[jobId]) jobGroups[jobId] = [];
      jobGroups[jobId].push(tc);
    }

    const bills: any[] = [];

    for (const [jobId, cards] of Object.entries(jobGroups)) {
      const totalCost = cards.reduce((sum, tc) => sum + (Number(tc.total_cost) || 0), 0);
      const totalHours = cards.reduce((sum, tc) => sum + (Number(tc.hours_total) || 0), 0);

      const dateRange = cards.map(tc => tc.work_date).sort();
      const startDate = dateRange[0];
      const endDate = dateRange[dateRange.length - 1];

      const billId = generateId();

      const { data: bill, error: billError } = await supabaseAdmin
        .from('bills')
        .insert({
          id: billId,
          user_id,
          entity_id: entity_id || null,
          job_id: jobId === 'unassigned' ? null : jobId,
          external_source: 'sitesense',
          bill_number: `TC-${billId.slice(0, 8)}`,
          bill_date: endDate,
          due_date: endDate,
          category: 'Labor',
          description: `Timecards: ${totalHours.toFixed(1)} hrs (${startDate} to ${endDate}), ${cards.length} entries`,
          subtotal: totalCost,
          total: totalCost,
          status: 'unpaid',
          notes: `Posted from SiteSense timecards. Employees: ${[...new Set(cards.map(tc => tc.employee_name))].join(', ')}`,
        })
        .select()
        .single();

      if (billError) throw billError;
      bills.push(bill);

      // Create bill_items (one per timecard)
      const billItems = cards.map((tc, idx) => ({
        id: generateId(),
        bill_id: billId,
        description: `${tc.employee_name} - ${tc.work_date} (${Number(tc.hours_regular || 0).toFixed(1)}reg + ${Number(tc.hours_overtime || 0).toFixed(1)}ot)`,
        quantity: 1,
        rate: Number(tc.total_cost) || 0,
        amount: Number(tc.total_cost) || 0,
        sort_order: idx,
      }));

      if (billItems.length > 0) {
        await supabaseAdmin.from('bill_items').insert(billItems);
      }

      // Update timecard status to 'posted' and link to bill
      for (const tc of cards) {
        await supabaseAdmin
          .from('timecards')
          .update({ status: 'posted', bill_id: billId })
          .eq('id', tc.id);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        bills_created: bills.length,
        timecards_posted: timecards.length,
        bills,
      },
    });
  } catch (error: any) {
    console.error('Error posting timecards:', error);
    return NextResponse.json({ error: error.message || 'Failed to post timecards' }, { status: 500 });
  }
}
