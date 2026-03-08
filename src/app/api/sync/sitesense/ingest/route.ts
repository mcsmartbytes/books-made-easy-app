import { NextRequest, NextResponse } from 'next/server';
import {
  verifyWebhookSignature,
  mapSiteSenseJob,
  mapSiteSenseTimecard,
  mapSiteSenseSOVLine,
  mapSiteSenseEquipment,
  mapSiteSenseContractor,
  mapSiteSenseContractorCompliance,
  mapSiteSenseContractorInvoice,
  type SyncObjectType,
  type SyncWebhookPayload,
} from '@/lib/syncProtocol';
import {
  getOrCreateConnection,
  recordInboundEvent,
  processEvent,
  updateEventStatus,
} from '@/lib/syncEngine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync/sitesense/ingest — Webhook receiver (HMAC auth)
 *
 * SiteSense pushes events here. No session required — machine-to-machine auth via
 * HMAC-SHA256 signature in X-SiteSense-Signature header.
 *
 * IMPORTANT: Read body as text BEFORE parsing JSON (signature needs raw bytes).
 */
export async function POST(request: NextRequest) {
  try {
    // Read raw body first for signature verification
    const rawBody = await request.text();

    // Verify HMAC signature
    const signature = request.headers.get('X-SiteSense-Signature');
    const webhookSecret = process.env.SITESENSE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }

    try {
      const valid = verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!valid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    // Parse payload
    const payload: SyncWebhookPayload & { user_id?: string; entity_id?: string } = JSON.parse(rawBody);

    if (!payload.event_type || !payload.object_type) {
      return NextResponse.json({ error: 'event_type and object_type are required' }, { status: 400 });
    }

    // User ID must be embedded in the webhook config or payload
    const userId = payload.user_id || request.headers.get('X-SiteSense-User-Id');
    if (!userId) {
      return NextResponse.json({ error: 'user_id required in payload or X-SiteSense-User-Id header' }, { status: 400 });
    }

    const entityId = payload.entity_id || request.headers.get('X-SiteSense-Entity-Id') || null;

    // Get or create connection
    const connection = await getOrCreateConnection(userId, 'sitesense', entityId);

    if (!connection.is_active) {
      return NextResponse.json({ error: 'Connection is inactive' }, { status: 403 });
    }

    // Handle bulk sync
    if (payload.event_type === 'bulk_sync') {
      const items = (payload as any).items || [];
      const results = [];

      for (const item of items) {
        try {
          const result = await processIngestItem(connection.id, userId, entityId, item);
          results.push(result);
        } catch (err: any) {
          results.push({ error: err.message, external_id: item.external_id });
        }
      }

      return NextResponse.json({
        success: true,
        processed: results.filter(r => !('error' in r)).length,
        errors: results.filter(r => 'error' in r).length,
        results,
      });
    }

    // Single event
    const result = await processIngestItem(connection.id, userId, entityId, payload);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Ingest error:', error);
    return NextResponse.json({ error: error.message || 'Ingest failed' }, { status: 500 });
  }
}

/**
 * Process a single ingest item (webhook event or bulk sync item).
 */
async function processIngestItem(
  connectionId: string,
  userId: string,
  entityId: string | null,
  payload: SyncWebhookPayload
) {
  const { event_type, object_type, external_id, data } = payload;

  // Record the raw event
  const event = await recordInboundEvent(
    connectionId,
    event_type,
    object_type,
    external_id,
    data
  );

  // Map the data to local table format
  const mappedData = mapPayloadData(
    object_type as SyncObjectType,
    data,
    userId,
    entityId
  );

  if (!mappedData) {
    await updateEventStatus(event.id, 'failed', `Unsupported object type: ${object_type}`);
    return { action: 'unsupported', object_type };
  }

  // Process (idempotent insert/update with conflict detection)
  const result = await processEvent(
    connectionId,
    event.id,
    object_type as SyncObjectType,
    external_id,
    mappedData,
    (data as any)?.updated_at
  );

  return {
    action: result.action,
    local_id: result.localId,
    object_type,
    external_id,
    conflicts: result.conflicts,
  };
}

/**
 * Map incoming payload data to local table columns based on object type.
 */
function mapPayloadData(
  objectType: SyncObjectType,
  data: Record<string, unknown>,
  userId: string,
  entityId: string | null
): Record<string, unknown> | null {
  switch (objectType) {
    case 'job':
      return mapSiteSenseJob(data as any, userId, entityId || undefined);
    case 'timecard':
      return mapSiteSenseTimecard(data as any, userId, entityId || undefined);
    case 'sov_line':
      return mapSiteSenseSOVLine(data as any, userId, entityId || undefined);
    case 'equipment':
      return mapSiteSenseEquipment(data as any, userId, entityId || undefined);
    case 'contractor':
      return mapSiteSenseContractor(data as any, userId, entityId || undefined);
    case 'contractor_compliance':
      return mapSiteSenseContractorCompliance(data as any, userId, entityId || undefined);
    case 'contractor_invoice':
      return mapSiteSenseContractorInvoice(data as any, userId, entityId || undefined);
    default:
      return null;
  }
}
