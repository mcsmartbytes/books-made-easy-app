import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/change-orders?user_id=xxx&job_id=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const jobId = searchParams.get('job_id');
  const id = searchParams.get('id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('change_orders')
        .select('*, jobs(id, job_number, name)')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin
      .from('change_orders')
      .select('*, jobs(id, job_number, name)')
      .eq('user_id', userId);

    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    // Calculate summary
    const all = (data || []) as any[];
    const approved = all.filter(co => co.status === 'approved');
    const pending = all.filter(co => co.status === 'pending');

    const summary = {
      total_count: all.length,
      approved_count: approved.length,
      pending_count: pending.length,
      rejected_count: all.filter(co => co.status === 'rejected').length,
      draft_count: all.filter(co => co.status === 'draft').length,
      approved_revenue_impact: approved.reduce((s: number, co: any) => s + (Number(co.revenue_impact) || 0), 0),
      approved_cost_impact: approved.reduce((s: number, co: any) => s + (Number(co.cost_impact) || 0), 0),
      approved_margin_impact: approved.reduce((s: number, co: any) => s + (Number(co.margin_impact) || 0), 0),
      pending_revenue_exposure: pending.reduce((s: number, co: any) => s + (Number(co.revenue_impact) || 0), 0),
      pending_cost_exposure: pending.reduce((s: number, co: any) => s + (Number(co.cost_impact) || 0), 0),
      total_days_impact: approved.reduce((s: number, co: any) => s + (Number(co.days_impact) || 0), 0),
    };

    return NextResponse.json({ success: true, data, summary });
  } catch (error) {
    console.error('Error fetching change orders:', error);
    return NextResponse.json({ error: 'Failed to fetch change orders' }, { status: 500 });
  }
}

// POST /api/change-orders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, job_id, co_number, title, description, type, revenue_impact, cost_impact, days_impact, notes } = body;

    if (!user_id || !job_id || !co_number || !title) {
      return NextResponse.json({ error: 'user_id, job_id, co_number, and title are required' }, { status: 400 });
    }

    const revenueImpact = Number(revenue_impact) || 0;
    const costImpact = Number(cost_impact) || 0;
    const marginImpact = revenueImpact - costImpact;

    const { data, error } = await supabaseAdmin
      .from('change_orders')
      .insert({
        user_id,
        job_id,
        co_number,
        title,
        description,
        type: type || 'addition',
        revenue_impact: revenueImpact,
        cost_impact: costImpact,
        margin_impact: marginImpact,
        days_impact: Number(days_impact) || 0,
        notes,
        status: 'draft',
      })
      .select('*, jobs(id, job_number, name)')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating change order:', error);
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Change order number already exists for this job' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create change order' }, { status: 500 });
  }
}

// PUT /api/change-orders
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    // Recalculate margin impact if revenue or cost changed
    if (updates.revenue_impact !== undefined || updates.cost_impact !== undefined) {
      const revenueImpact = Number(updates.revenue_impact) || 0;
      const costImpact = Number(updates.cost_impact) || 0;
      updates.margin_impact = revenueImpact - costImpact;
    }

    // Set dates based on status changes
    if (updates.status === 'pending' && !updates.submitted_date) {
      updates.submitted_date = new Date().toISOString().split('T')[0];
    }
    if (updates.status === 'approved' && !updates.approved_date) {
      updates.approved_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabaseAdmin
      .from('change_orders')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select('*, jobs(id, job_number, name)')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating change order:', error);
    return NextResponse.json({ error: 'Failed to update change order' }, { status: 500 });
  }
}

// DELETE /api/change-orders
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('change_orders')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting change order:', error);
    return NextResponse.json({ error: 'Failed to delete change order' }, { status: 500 });
  }
}
