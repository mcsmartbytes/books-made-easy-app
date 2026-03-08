import { NextRequest, NextResponse } from 'next/server';
import { getConnections, getSyncStatus } from '@/lib/syncEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/sitesense/status?user_id=xxx&entity_id=xxx
 *
 * Returns aggregate sync health for the dashboard.
 * Shows per-data-type counts, last sync times, open conflicts, and health status.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');
  const entityId = searchParams.get('entity_id') || undefined;

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  try {
    // Get all connections for this user (both SiteSense and Expenses Made Easy)
    const connections = await getConnections(userId);

    if (connections.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          connections: [],
          summary: {
            totalConnections: 0,
            activeConnections: 0,
            totalSynced: 0,
            openConflicts: 0,
            overallHealth: 'disconnected',
          },
        },
      });
    }

    // Get status for each connection
    const statuses = [];
    let totalSynced = 0;
    let totalConflicts = 0;
    let worstHealth: 'healthy' | 'warning' | 'error' | 'disconnected' = 'healthy';
    const healthPriority = { disconnected: 3, error: 2, warning: 1, healthy: 0 };

    for (const conn of connections) {
      // Filter by entity_id if provided
      if (entityId && conn.entity_id && conn.entity_id !== entityId) continue;

      try {
        const status = await getSyncStatus(conn.id);
        statuses.push(status);

        // Aggregate totals
        for (const [, counts] of Object.entries(status.totals)) {
          totalSynced += counts.synced;
        }
        totalConflicts += status.openConflicts;

        if (healthPriority[status.health] > healthPriority[worstHealth]) {
          worstHealth = status.health;
        }
      } catch {
        statuses.push({
          connection: conn,
          totals: {},
          openConflicts: 0,
          recentErrors: 0,
          health: 'error' as const,
        });
        worstHealth = 'error';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        connections: statuses,
        summary: {
          totalConnections: connections.length,
          activeConnections: connections.filter(c => c.is_active).length,
          totalSynced,
          openConflicts: totalConflicts,
          overallHealth: worstHealth,
        },
      },
    });
  } catch (error: any) {
    console.error('Status error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get sync status' }, { status: 500 });
  }
}
