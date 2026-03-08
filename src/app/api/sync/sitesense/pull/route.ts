import { NextRequest, NextResponse } from 'next/server';
import {
  mapSiteSenseJob,
  mapSiteSenseTimecard,
  mapSiteSenseSOVLine,
  mapSiteSenseEquipment,
  mapSiteSenseContractor,
  mapSiteSenseContractorCompliance,
  type SyncObjectType,
} from '@/lib/syncProtocol';
import {
  getOrCreateConnection,
  recordInboundEvent,
  processEvent,
  updateConnection,
} from '@/lib/syncEngine';

export const dynamic = 'force-dynamic';

type PullType = 'jobs' | 'timecards' | 'cost_codes' | 'change_orders' | 'sov' | 'equipment' | 'contractors' | 'all';

/**
 * POST /api/sync/sitesense/pull — Manual pull (session auth)
 *
 * User-triggered full data pull from SiteSense REST API.
 * Fetches records from SiteSense, then processes each through the sync engine.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, entity_id, pull_type = 'all' } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const connection = await getOrCreateConnection(user_id, 'sitesense', entity_id);

    if (!connection.is_active) {
      return NextResponse.json({ error: 'Connection is inactive' }, { status: 403 });
    }

    if (!connection.endpoint_url) {
      return NextResponse.json({ error: 'SiteSense endpoint URL not configured' }, { status: 400 });
    }

    const apiKey = connection.api_key_encrypted; // In production, decrypt first
    if (!apiKey && !process.env.SITESENSE_API_KEY) {
      return NextResponse.json({ error: 'SiteSense API key not configured' }, { status: 400 });
    }

    const effectiveApiKey = process.env.SITESENSE_API_KEY || apiKey;
    const baseUrl = connection.endpoint_url;
    const types: PullType[] = pull_type === 'all'
      ? ['jobs', 'timecards', 'equipment', 'sov', 'contractors']
      : [pull_type as PullType];

    const results: Record<string, { synced: number; skipped: number; errors: number }> = {};

    for (const type of types) {
      results[type] = { synced: 0, skipped: 0, errors: 0 };

      try {
        const records = await fetchFromSiteSense(baseUrl, effectiveApiKey!, type);

        for (const record of records) {
          try {
            const objectType = mapPullTypeToObjectType(type);
            const mappedData = mapPullData(objectType, record, user_id, entity_id);

            if (!mappedData) {
              results[type].errors++;
              continue;
            }

            const event = await recordInboundEvent(
              connection.id,
              `${type}.pulled`,
              objectType,
              record.id,
              record
            );

            const result = await processEvent(
              connection.id,
              event.id,
              objectType,
              record.id,
              mappedData,
              record.updated_at
            );

            if (result.action === 'skipped') {
              results[type].skipped++;
            } else {
              results[type].synced++;
            }
          } catch {
            results[type].errors++;
          }
        }
      } catch (err: any) {
        results[type].errors++;
        console.error(`Pull failed for ${type}:`, err.message);
      }
    }

    // Update connection last_pull_at
    await updateConnection(connection.id, {
      last_pull_at: new Date().toISOString(),
    } as any);

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Pull error:', error);
    return NextResponse.json({ error: error.message || 'Pull failed' }, { status: 500 });
  }
}

/**
 * Fetch records from SiteSense REST API.
 * Handles pagination (50 records per request with continuation token).
 */
async function fetchFromSiteSense(
  baseUrl: string,
  apiKey: string,
  type: PullType
): Promise<any[]> {
  const endpoint = `${baseUrl}/api/${type}`;
  const allRecords: any[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(endpoint);
    url.searchParams.set('limit', '50');
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SiteSense API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const records = json.data || json.items || json || [];

    if (Array.isArray(records)) {
      allRecords.push(...records);
    }

    cursor = json.next_cursor || json.cursor || null;
    hasMore = !!cursor && records.length === 50;
  }

  return allRecords;
}

function mapPullTypeToObjectType(type: PullType): SyncObjectType {
  const map: Record<PullType, SyncObjectType> = {
    jobs: 'job',
    timecards: 'timecard',
    cost_codes: 'cost_code',
    change_orders: 'change_order',
    sov: 'sov_line',
    equipment: 'equipment',
    contractors: 'contractor',
    all: 'job', // won't be used directly
  };
  return map[type] || 'job';
}

function mapPullData(
  objectType: SyncObjectType,
  data: any,
  userId: string,
  entityId?: string
): Record<string, unknown> | null {
  switch (objectType) {
    case 'job': return mapSiteSenseJob(data, userId, entityId);
    case 'timecard': return mapSiteSenseTimecard(data, userId, entityId);
    case 'sov_line': return mapSiteSenseSOVLine(data, userId, entityId);
    case 'equipment': return mapSiteSenseEquipment(data, userId, entityId);
    case 'contractor': return mapSiteSenseContractor(data, userId, entityId);
    case 'contractor_compliance': return mapSiteSenseContractorCompliance(data, userId, entityId);
    default: return null;
  }
}
