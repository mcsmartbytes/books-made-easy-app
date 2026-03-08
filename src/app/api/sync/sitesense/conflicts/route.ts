import { NextRequest, NextResponse } from 'next/server';
import { getConnections, getOpenConflicts, resolveConflict } from '@/lib/syncEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/sitesense/conflicts?user_id=xxx&connection_id=xxx
 *
 * View open conflicts that need manual resolution.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const connectionId = searchParams.get('connection_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    let connId = connectionId;
    if (!connId) {
      const connections = await getConnections(userId, 'sitesense');
      if (connections.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }
      connId = connections[0].id;
    }

    const conflicts = await getOpenConflicts(connId);
    return NextResponse.json({ success: true, data: conflicts });
  } catch (error: any) {
    console.error('Error fetching conflicts:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch conflicts' }, { status: 500 });
  }
}

/**
 * PUT /api/sync/sitesense/conflicts — Resolve a conflict
 *
 * Body: { conflict_id, resolution: 'resolved_local' | 'resolved_remote' | 'dismissed', user_id }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { conflict_id, resolution, user_id } = body;

    if (!conflict_id || !resolution || !user_id) {
      return NextResponse.json(
        { error: 'conflict_id, resolution, and user_id are required' },
        { status: 400 }
      );
    }

    const validResolutions = ['resolved_local', 'resolved_remote', 'dismissed'];
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json(
        { error: `resolution must be one of: ${validResolutions.join(', ')}` },
        { status: 400 }
      );
    }

    await resolveConflict(conflict_id, resolution, user_id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error resolving conflict:', error);
    return NextResponse.json({ error: error.message || 'Failed to resolve conflict' }, { status: 500 });
  }
}
