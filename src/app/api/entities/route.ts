import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/entities?user_id=xxx&organization_id=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const organizationId = searchParams.get('organization_id');

  if (!userId || !organizationId) {
    return NextResponse.json({ error: 'user_id and organization_id are required' }, { status: 400 });
  }

  try {
    // Get the user's roles for this organization to determine which entities they can access
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_entity_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (rolesError) throw rolesError;

    if (!roles || roles.length === 0) {
      return NextResponse.json({ error: 'No access to this organization' }, { status: 403 });
    }

    // Get entity IDs the user has access to
    const entityIds = (roles as any[])
      .map((r: any) => r.entity_id)
      .filter((id: any) => id != null);

    let entities;

    if (entityIds.length > 0) {
      // User has entity-specific roles - fetch those entities
      const { data, error } = await supabaseAdmin
        .from('entities')
        .select('*')
        .eq('organization_id', organizationId)
        .in('id', entityIds)
        .order('name', { ascending: true });

      if (error) throw error;
      entities = data;
    } else {
      // User has org-level role with no specific entity - return all entities in the org
      const { data, error } = await supabaseAdmin
        .from('entities')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;
      entities = data;
    }

    return NextResponse.json({ success: true, data: entities || [] });
  } catch (error) {
    console.error('Error fetching entities:', error);
    return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 });
  }
}

// POST /api/entities - Create entity within an organization
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      organization_id,
      name,
      legal_name,
      entity_type,
      tax_id,
      email,
      phone,
      address,
      city,
      state,
      zip,
      country,
      currency,
    } = body;

    if (!user_id || !organization_id || !name) {
      return NextResponse.json({ error: 'user_id, organization_id, and name are required' }, { status: 400 });
    }

    // Check user is owner or admin of this organization
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_entity_roles')
      .select('*')
      .eq('user_id', user_id)
      .eq('organization_id', organization_id);

    if (rolesError) throw rolesError;

    const hasPermission = (roles as any[] || []).some(
      (r: any) => r.role === 'owner' || r.role === 'admin'
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Only owners and admins can create entities' }, { status: 403 });
    }

    // Create the entity
    const { data: entity, error: entityError } = await supabaseAdmin
      .from('entities')
      .insert({
        organization_id,
        name,
        legal_name: legal_name || null,
        entity_type: entity_type || 'company',
        tax_id: tax_id || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        country: country || 'United States',
        currency: currency || 'USD',
        is_active: 1,
      })
      .select()
      .single();

    if (entityError) throw entityError;
    if (!entity) throw new Error('Failed to create entity');

    const entityId = (entity as any).id;

    // Auto-create a role for the creator on this entity
    const { error: roleError } = await supabaseAdmin
      .from('user_entity_roles')
      .insert({
        user_id,
        organization_id,
        entity_id: entityId,
        role: 'owner',
        is_default: 0,
      });

    if (roleError) throw roleError;

    return NextResponse.json({ success: true, data: entity }, { status: 201 });
  } catch (error) {
    console.error('Error creating entity:', error);
    return NextResponse.json({ error: 'Failed to create entity' }, { status: 500 });
  }
}

// PUT /api/entities - Update entity
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, organization_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    // Verify user has access to update this entity
    const { data: entity, error: entityError } = await supabaseAdmin
      .from('entities')
      .select('*')
      .eq('id', id)
      .single();

    if (entityError) throw entityError;
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const orgId = (entity as any).organization_id;

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
      return NextResponse.json({ error: 'Insufficient permissions to update this entity' }, { status: 403 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('entities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating entity:', error);
    return NextResponse.json({ error: 'Failed to update entity' }, { status: 500 });
  }
}

// DELETE /api/entities?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    // Get the entity to find its organization
    const { data: entity, error: entityError } = await supabaseAdmin
      .from('entities')
      .select('*')
      .eq('id', id)
      .single();

    if (entityError) throw entityError;
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const orgId = (entity as any).organization_id;

    // Check user has owner/admin role
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_entity_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', orgId);

    if (rolesError) throw rolesError;

    const hasPermission = (roles as any[] || []).some(
      (r: any) => r.role === 'owner' || r.role === 'admin'
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Only owners and admins can delete entities' }, { status: 403 });
    }

    // Ensure this is not the last entity in the organization
    const { data: allEntities, error: countError } = await supabaseAdmin
      .from('entities')
      .select('*')
      .eq('organization_id', orgId);

    if (countError) throw countError;

    if (!allEntities || (allEntities as any[]).length <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the last entity in an organization' },
        { status: 400 }
      );
    }

    // Delete entity (cascade will handle locations, roles)
    const { error } = await supabaseAdmin
      .from('entities')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting entity:', error);
    return NextResponse.json({ error: 'Failed to delete entity' }, { status: 500 });
  }
}
