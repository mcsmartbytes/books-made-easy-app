import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/intercompany?user_id=xxx&organization_id=xxx&status=pending
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const organizationId = searchParams.get('organization_id');
  const status = searchParams.get('status');

  if (!userId || !organizationId) {
    return NextResponse.json({ error: 'user_id and organization_id are required' }, { status: 400 });
  }

  try {
    // Verify user has access to this organization
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_entity_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (rolesError) throw rolesError;

    if (!roles || roles.length === 0) {
      return NextResponse.json({ error: 'No access to this organization' }, { status: 403 });
    }

    // Build query for intercompany transactions
    let query = supabaseAdmin
      .from('intercompany_transactions')
      .select('*')
      .eq('organization_id', organizationId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: transactions, error } = await query.order('transaction_date', { ascending: false });

    if (error) throw error;

    // Fetch from/to entity names separately since relation map uses separate queries
    const txns = (transactions as any[]) || [];

    if (txns.length > 0) {
      const entityIds = [
        ...new Set([
          ...txns.map((t: any) => t.from_entity_id),
          ...txns.map((t: any) => t.to_entity_id),
        ].filter(Boolean))
      ];

      const { data: entities, error: entitiesError } = await supabaseAdmin
        .from('entities')
        .select('*')
        .in('id', entityIds);

      if (!entitiesError && entities) {
        const entityMap = new Map<string, any>();
        for (const e of entities as any[]) {
          entityMap.set(e.id, e);
        }

        for (const txn of txns) {
          txn.from_entity = entityMap.get(txn.from_entity_id) || null;
          txn.to_entity = entityMap.get(txn.to_entity_id) || null;
        }
      }
    }

    return NextResponse.json({ success: true, data: txns });
  } catch (error) {
    console.error('Error fetching intercompany transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch intercompany transactions' }, { status: 500 });
  }
}

// POST /api/intercompany - Create intercompany transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      organization_id,
      from_entity_id,
      to_entity_id,
      transaction_type,
      description,
      amount,
      transaction_date,
      from_account_id,
      to_account_id,
      reference,
      notes,
    } = body;

    if (!user_id || !organization_id || !from_entity_id || !to_entity_id || !description || !amount || !transaction_date) {
      return NextResponse.json(
        { error: 'user_id, organization_id, from_entity_id, to_entity_id, description, amount, and transaction_date are required' },
        { status: 400 }
      );
    }

    if (from_entity_id === to_entity_id) {
      return NextResponse.json({ error: 'from_entity_id and to_entity_id must be different' }, { status: 400 });
    }

    // Verify user has access to the organization
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_entity_roles')
      .select('*')
      .eq('user_id', user_id)
      .eq('organization_id', organization_id);

    if (rolesError) throw rolesError;

    if (!roles || roles.length === 0) {
      return NextResponse.json({ error: 'No access to this organization' }, { status: 403 });
    }

    const { data: txn, error } = await supabaseAdmin
      .from('intercompany_transactions')
      .insert({
        organization_id,
        from_entity_id,
        to_entity_id,
        transaction_type: transaction_type || 'transfer',
        description,
        amount,
        transaction_date,
        status: 'pending',
        from_account_id: from_account_id || null,
        to_account_id: to_account_id || null,
        reference: reference || null,
        notes: notes || null,
        created_by: user_id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: txn }, { status: 201 });
  } catch (error) {
    console.error('Error creating intercompany transaction:', error);
    return NextResponse.json({ error: 'Failed to create intercompany transaction' }, { status: 500 });
  }
}

// PUT /api/intercompany - Update status (approve/post/void)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, status, notes } = body;

    if (!id || !user_id || !status) {
      return NextResponse.json({ error: 'id, user_id, and status are required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'approved', 'posted', 'voided'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Get the existing transaction
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('intercompany_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const currentStatus = (existing as any).status;
    const orgId = (existing as any).organization_id;

    // Validate status transitions
    const allowedTransitions: Record<string, string[]> = {
      pending: ['approved', 'voided'],
      approved: ['posted', 'voided'],
      posted: ['voided'],
      voided: [],
    };

    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${currentStatus}' to '${status}'` },
        { status: 400 }
      );
    }

    // Verify user has access
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_entity_roles')
      .select('*')
      .eq('user_id', user_id)
      .eq('organization_id', orgId);

    if (rolesError) throw rolesError;

    const hasPermission = (roles as any[] || []).some(
      (r: any) => r.role === 'owner' || r.role === 'admin' || r.role === 'manager'
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = { status };

    if (status === 'approved') {
      updatePayload.approved_by = user_id;
    }

    if (notes !== undefined) {
      updatePayload.notes = notes;
    }

    const { data: txn, error: updateError } = await supabaseAdmin
      .from('intercompany_transactions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // TODO: When status is 'posted', create journal entries for both entities
    // This would debit the from_account on the source entity and credit the to_account
    // on the destination entity, creating an intercompany receivable/payable pair.

    return NextResponse.json({ success: true, data: txn });
  } catch (error) {
    console.error('Error updating intercompany transaction:', error);
    return NextResponse.json({ error: 'Failed to update intercompany transaction' }, { status: 500 });
  }
}
