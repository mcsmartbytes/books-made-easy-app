import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/jobs - List jobs
// GET /api/jobs?id=xxx - Get single job with phases
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const jobId = searchParams.get('id');
  const customerId = searchParams.get('customer_id');
  const status = searchParams.get('status');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    if (jobId) {
      const { data, error } = await supabaseAdmin
        .from('jobs')
        .select('*, customers(id, name, email, company), job_phases(*)')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin
      .from('jobs')
      .select('*, customers(id, name, email, company)')
      .eq('user_id', userId);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

// POST /api/jobs - Create job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id, customer_id, job_number, name, description,
      start_date, end_date, estimated_revenue, estimated_cost,
      _upsert, _onConflict, ...rest
    } = body;

    if (!user_id || !name) {
      return NextResponse.json({ error: 'user_id and name are required' }, { status: 400 });
    }

    // Generate job number if not provided
    let finalJobNumber = job_number;
    if (!finalJobNumber) {
      const { data: countData } = await supabaseAdmin
        .from('jobs')
        .select('id')
        .eq('user_id', user_id);
      const count = (countData || []).length + 1;
      finalJobNumber = `JOB-${String(count).padStart(4, '0')}`;
    }

    const insertData = {
      user_id,
      customer_id: customer_id || null,
      job_number: finalJobNumber,
      name,
      description: description || null,
      start_date: start_date || null,
      end_date: end_date || null,
      estimated_revenue: estimated_revenue || 0,
      estimated_cost: estimated_cost || 0,
      status: 'pending',
      ...rest,
    };

    if (_upsert && _onConflict) {
      const { data, error } = await supabaseAdmin
        .from('jobs')
        .upsert(insertData, { onConflict: _onConflict })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data }, { status: 201 });
    }

    const { data, error } = await supabaseAdmin
      .from('jobs')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}

// PUT /api/jobs - Update job
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('jobs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating job:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}

// DELETE /api/jobs?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('jobs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting job:', error);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
