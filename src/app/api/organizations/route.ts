import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/organizations?user_id=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    // Get all roles for this user to find their organizations
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_entity_roles')
      .select('*')
      .eq('user_id', userId);

    if (rolesError) throw rolesError;

    if (!roles || roles.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Get unique organization IDs
    const orgIds = [...new Set((roles as any[]).map((r: any) => r.organization_id))];

    // Fetch organizations
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .in('id', orgIds);

    if (orgsError) throw orgsError;

    // Attach the user's role info to each organization
    const orgsWithRoles = (orgs as any[] || []).map((org: any) => {
      const orgRoles = (roles as any[]).filter((r: any) => r.organization_id === org.id);
      // The highest role for this org (owner > admin > manager > accountant > viewer)
      const roleHierarchy = ['owner', 'admin', 'manager', 'accountant', 'viewer'];
      const highestRole = orgRoles.reduce((best: string, r: any) => {
        const currentIdx = roleHierarchy.indexOf(r.role);
        const bestIdx = roleHierarchy.indexOf(best);
        return currentIdx < bestIdx ? r.role : best;
      }, 'viewer');

      return { ...org, user_role: highestRole };
    });

    return NextResponse.json({ success: true, data: orgsWithRoles });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}

// POST /api/organizations - Create organization + default entity + owner role
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, name, tax_id, fiscal_year_start, currency, logo_url } = body;

    if (!user_id || !name) {
      return NextResponse.json({ error: 'user_id and name are required' }, { status: 400 });
    }

    // Create the organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        tax_id: tax_id || null,
        fiscal_year_start: fiscal_year_start || 'january',
        currency: currency || 'USD',
        logo_url: logo_url || null,
        created_by: user_id,
      })
      .select()
      .single();

    if (orgError) throw orgError;
    if (!org) throw new Error('Failed to create organization');

    const orgId = (org as any).id;

    // Create a default entity
    const { data: entity, error: entityError } = await supabaseAdmin
      .from('entities')
      .insert({
        organization_id: orgId,
        name: `${name} - Default`,
        entity_type: 'company',
        currency: currency || 'USD',
        is_active: 1,
      })
      .select()
      .single();

    if (entityError) throw entityError;

    const entityId = (entity as any).id;

    // Assign user as owner at org level (entity_id null = org-wide role)
    const { error: roleError } = await supabaseAdmin
      .from('user_entity_roles')
      .insert({
        user_id,
        organization_id: orgId,
        entity_id: entityId,
        role: 'owner',
        is_default: 1,
      });

    if (roleError) throw roleError;

    return NextResponse.json({
      success: true,
      data: { ...org, default_entity: entity },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}

// PUT /api/organizations - Update organization (owner/admin only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    // Check user has owner or admin role for this org
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_entity_roles')
      .select('*')
      .eq('user_id', user_id)
      .eq('organization_id', id);

    if (rolesError) throw rolesError;

    const hasPermission = (roles as any[] || []).some(
      (r: any) => r.role === 'owner' || r.role === 'admin'
    );

    if (!hasPermission) {
      return NextResponse.json({ error: 'Only owners and admins can update an organization' }, { status: 403 });
    }

    const { data: org, error: updateError } = await supabaseAdmin
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, data: org });
  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}

// DELETE /api/organizations?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    // Check user is owner
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_entity_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', id);

    if (rolesError) throw rolesError;

    const isOwner = (roles as any[] || []).some((r: any) => r.role === 'owner');

    if (!isOwner) {
      return NextResponse.json({ error: 'Only owners can delete an organization' }, { status: 403 });
    }

    // Delete organization (cascade will handle entities, locations, roles, intercompany)
    const { error } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
  }
}
