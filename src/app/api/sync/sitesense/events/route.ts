import { NextRequest, NextResponse } from 'next/server';
import { getConnections, getSyncEvents } from '@/lib/syncEngine';
import type { SyncEventStatus } from '@/lib/syncProtocol';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/sitesense/events?user_id=xxx&connection_id=xxx&status=xxx&object_type=xxx&limit=50&offset=0
 *
 * Paginated event log for the sync dashboard.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const connectionId = searchParams.get('connection_id');
  const status = searchParams.get('status') as SyncEventStatus | null;
  const objectType = searchParams.get('object_type');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    // If no connection_id specified, get the first active connection
    let connId = connectionId;
    if (!connId) {
      const connections = await getConnections(userId, 'sitesense');
      if (connections.length === 0) {
        return NextResponse.json({ success: true, data: { events: [], total: 0 } });
      }
      connId = connections[0].id;
    }

    const { events, total } = await getSyncEvents(connId, {
      status: status || undefined,
      objectType: objectType || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: {
        events,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch events' }, { status: 500 });
  }
}
