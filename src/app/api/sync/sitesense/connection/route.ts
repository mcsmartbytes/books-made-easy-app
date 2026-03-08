import { NextRequest, NextResponse } from 'next/server';
import {
  getConnections,
  getOrCreateConnection,
  updateConnection,
} from '@/lib/syncEngine';
import type { SyncSource } from '@/lib/syncProtocol';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/sitesense/connection?user_id=xxx&source=sitesense
 *
 * Get connection settings for a source.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const source = (searchParams.get('source') || 'sitesense') as SyncSource;

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    const connections = await getConnections(userId, source);
    return NextResponse.json({ success: true, data: connections });
  } catch (error: any) {
    console.error('Error fetching connections:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch connections' }, { status: 500 });
  }
}

/**
 * POST /api/sync/sitesense/connection — Create or get connection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, entity_id, source = 'sitesense', display_name, endpoint_url } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const connection = await getOrCreateConnection(
      user_id,
      source as SyncSource,
      entity_id,
      display_name
    );

    // If endpoint_url provided, update it
    if (endpoint_url) {
      const updated = await updateConnection(connection.id, { endpoint_url });
      return NextResponse.json({ success: true, data: updated }, { status: 201 });
    }

    return NextResponse.json({ success: true, data: connection }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating connection:', error);
    return NextResponse.json({ error: error.message || 'Failed to create connection' }, { status: 500 });
  }
}

/**
 * PUT /api/sync/sitesense/connection — Update connection settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_id, ...updates } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: 'id and user_id are required' }, { status: 400 });
    }

    // Verify ownership
    const connections = await getConnections(user_id);
    const owned = connections.find(c => c.id === id);

    if (!owned) {
      return NextResponse.json({ error: 'Connection not found or not authorized' }, { status: 404 });
    }

    // Filter allowed update fields
    const allowedFields: Record<string, unknown> = {};
    const allowed = ['display_name', 'endpoint_url', 'webhook_secret_encrypted', 'api_key_encrypted', 'is_active', 'auto_sync', 'pull_interval_minutes'];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        allowedFields[key] = updates[key];
      }
    }

    const updated = await updateConnection(id, allowedFields as any);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating connection:', error);
    return NextResponse.json({ error: error.message || 'Failed to update connection' }, { status: 500 });
  }
}
