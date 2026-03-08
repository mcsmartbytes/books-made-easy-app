import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/locations?user_id=xxx&entity_id=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const entityId = searchParams.get('entity_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  if (!entityId) {
    return NextResponse.json({ error: 'entity_id is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('locations')
      .select('*')
      .eq('entity_id', entityId)
      .order('is_primary', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}

// POST /api/locations - Create location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      entity_id,
      name,
      location_type,
      address,
      city,
      state,
      zip,
      country,
      phone,
      is_primary,
    } = body;

    if (!user_id || !entity_id || !name) {
      return NextResponse.json({ error: 'user_id, entity_id, and name are required' }, { status: 400 });
    }

    // If this is being set as primary, unset existing primary locations
    if (is_primary) {
      const { data: existing, error: existError } = await supabaseAdmin
        .from('locations')
        .select('*')
        .eq('entity_id', entity_id)
        .eq('is_primary', 1);

      if (!existError && existing && (existing as any[]).length > 0) {
        for (const loc of existing as any[]) {
          await supabaseAdmin
            .from('locations')
            .update({ is_primary: 0 })
            .eq('id', loc.id);
        }
      }
    }

    const { data: location, error } = await supabaseAdmin
      .from('locations')
      .insert({
        entity_id,
        name,
        location_type: location_type || 'office',
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        country: country || 'United States',
        phone: phone || null,
        is_primary: is_primary ? 1 : 0,
        is_active: 1,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: location }, { status: 201 });
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json({ error: 'Failed to create location' }, { status: 500 });
  }
}

// PUT /api/locations - Update location
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    // If setting as primary, unset others for the same entity
    if (updates.is_primary) {
      const { data: current, error: fetchError } = await supabaseAdmin
        .from('locations')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (current) {
        const entityId = (current as any).entity_id;
        const { data: existing, error: existError } = await supabaseAdmin
          .from('locations')
          .select('*')
          .eq('entity_id', entityId)
          .eq('is_primary', 1);

        if (!existError && existing) {
          for (const loc of existing as any[]) {
            if (loc.id !== id) {
              await supabaseAdmin
                .from('locations')
                .update({ is_primary: 0 })
                .eq('id', loc.id);
            }
          }
        }
      }
    }

    const { data: location, error } = await supabaseAdmin
      .from('locations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: location });
  } catch (error) {
    console.error('Error updating location:', error);
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
  }
}

// DELETE /api/locations?id=xxx&user_id=xxx
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const userId = searchParams.get('user_id');

  if (!id || !userId) {
    return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('locations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting location:', error);
    return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 });
  }
}
