/**
 * Sync Engine — Core sync processing for SiteSense and Expenses Made Easy
 *
 * Handles: connection management, event recording, idempotent processing,
 * conflict detection/resolution, and sync status aggregation.
 *
 * Uses supabaseAdmin for DB access (matching existing app pattern).
 */

import { supabaseAdmin } from '@/utils/supabaseAdmin';
import {
  generateId,
  computeChecksum,
  detectConflicts,
  OBJECT_TABLE_MAP,
  type SyncSource,
  type SyncObjectType,
  type SyncEventStatus,
  type SyncConnection,
  type SyncEvent,
  type SyncLogEntry,
  type SyncConflict,
  type ConflictStatus,
} from '@/lib/syncProtocol';

// ============================================
// CONNECTION MANAGEMENT
// ============================================

/**
 * Get or create a sync connection for a user/entity/source combination.
 */
export async function getOrCreateConnection(
  userId: string,
  source: SyncSource,
  entityId?: string | null,
  displayName?: string
): Promise<SyncConnection> {
  // Try to find existing connection
  let query = supabaseAdmin
    .from('sync_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('source', source);

  if (entityId) {
    query = query.eq('entity_id', entityId);
  } else {
    query = query.is('entity_id', null);
  }

  const { data: existing } = await query.single();

  if (existing) {
    return existing as unknown as SyncConnection;
  }

  // Create new connection
  const id = generateId();
  const defaultName = source === 'sitesense' ? 'SiteSense' :
    source === 'expenses_made_easy' ? 'Expenses Made Easy' : displayName || 'External System';

  const { data: created, error } = await supabaseAdmin
    .from('sync_connections')
    .insert({
      id,
      user_id: userId,
      entity_id: entityId || null,
      source,
      display_name: displayName || defaultName,
      is_active: 1,
      auto_sync: 1,
      pull_interval_minutes: 60,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create sync connection: ${error.message}`);
  return created as unknown as SyncConnection;
}

/**
 * Get a connection by ID.
 */
export async function getConnection(connectionId: string): Promise<SyncConnection | null> {
  const { data } = await supabaseAdmin
    .from('sync_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  return (data as unknown as SyncConnection) || null;
}

/**
 * Update connection settings.
 */
export async function updateConnection(
  connectionId: string,
  updates: Partial<Pick<SyncConnection, 'display_name' | 'endpoint_url' | 'webhook_secret_encrypted' | 'api_key_encrypted' | 'is_active' | 'auto_sync' | 'pull_interval_minutes'>>
): Promise<SyncConnection> {
  const { data, error } = await supabaseAdmin
    .from('sync_connections')
    .update(updates)
    .eq('id', connectionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update connection: ${error.message}`);
  return data as unknown as SyncConnection;
}

/**
 * Get all connections for a user.
 */
export async function getConnections(userId: string, source?: SyncSource): Promise<SyncConnection[]> {
  let query = supabaseAdmin
    .from('sync_connections')
    .select('*')
    .eq('user_id', userId);

  if (source) query = query.eq('source', source);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to fetch connections: ${error.message}`);
  return (data || []) as unknown as SyncConnection[];
}

// ============================================
// EVENT RECORDING
// ============================================

/**
 * Record a raw inbound sync event before processing.
 */
export async function recordInboundEvent(
  connectionId: string,
  eventType: string,
  objectType: string,
  externalId: string | null,
  payload: Record<string, unknown>
): Promise<SyncEvent> {
  const id = generateId();

  const { data, error } = await supabaseAdmin
    .from('sync_events')
    .insert({
      id,
      connection_id: connectionId,
      event_type: eventType,
      object_type: objectType,
      external_id: externalId,
      payload: JSON.stringify(payload),
      status: 'pending',
      retry_count: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to record event: ${error.message}`);
  return data as unknown as SyncEvent;
}

/**
 * Update event status.
 */
export async function updateEventStatus(
  eventId: string,
  status: SyncEventStatus,
  errorMessage?: string
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'processed' || status === 'failed') {
    updates.processed_at = new Date().toISOString();
  }
  if (errorMessage) {
    updates.error_message = errorMessage;
  }

  await supabaseAdmin.from('sync_events').update(updates).eq('id', eventId);
}

// ============================================
// CORE SYNC PROCESSING
// ============================================

export interface ProcessEventResult {
  action: 'created' | 'updated' | 'skipped' | 'conflict';
  localId: string | null;
  conflicts?: { field: string; localValue: unknown; remoteValue: unknown }[];
}

/**
 * Core idempotent event processor.
 *
 * Flow:
 * 1. Compute checksum of incoming data
 * 2. Check sync_log for existing mapping (external_id → local_id)
 * 3. If exists and checksum matches → skip (duplicate)
 * 4. If exists and checksum differs → update with conflict detection
 * 5. If new → insert
 * 6. Record/update sync_log entry
 */
export async function processEvent(
  connectionId: string,
  eventId: string,
  objectType: SyncObjectType,
  externalId: string,
  mappedData: Record<string, unknown>,
  remoteUpdatedAt?: string
): Promise<ProcessEventResult> {
  const localTable = OBJECT_TABLE_MAP[objectType];
  if (!localTable) {
    throw new Error(`Unknown object type: ${objectType}`);
  }

  const checksum = computeChecksum(mappedData);

  // Check existing sync_log entry
  const { data: existingLog } = await supabaseAdmin
    .from('sync_log')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('object_type', objectType)
    .eq('external_id', externalId)
    .single();

  const syncLog = existingLog as unknown as SyncLogEntry | null;

  if (syncLog) {
    // Already synced — check if data changed
    if (syncLog.source_checksum === checksum) {
      // No change — skip
      await updateEventStatus(eventId, 'skipped');
      return { action: 'skipped', localId: syncLog.local_id };
    }

    // Data changed — fetch local record and detect conflicts
    const { data: localRecord } = await supabaseAdmin
      .from(localTable)
      .select('*')
      .eq('id', syncLog.local_id)
      .single();

    if (!localRecord) {
      // Local record deleted — recreate
      return await insertNewRecord(connectionId, eventId, objectType, externalId, localTable, mappedData, checksum);
    }

    const localData = localRecord as Record<string, unknown>;
    const conflictResults = detectConflicts(objectType, localData, mappedData, localData.updated_at as string, remoteUpdatedAt);

    // Separate auto-resolvable from manual conflicts
    const manualConflicts = conflictResults.filter(c => c.winner === 'conflict');
    const autoResolved = conflictResults.filter(c => c.winner !== 'conflict');

    // Build update object from auto-resolved fields
    const updateData: Record<string, unknown> = {};
    for (const resolved of autoResolved) {
      if (resolved.winner === 'remote') {
        updateData[resolved.field] = resolved.remoteValue;
      }
      // 'local' winner = keep existing value, no update needed
    }

    // Apply auto-resolved updates if any
    if (Object.keys(updateData).length > 0) {
      await supabaseAdmin
        .from(localTable)
        .update(updateData)
        .eq('id', syncLog.local_id);
    }

    // Record manual conflicts
    if (manualConflicts.length > 0) {
      for (const conflict of manualConflicts) {
        await supabaseAdmin
          .from('sync_conflicts')
          .insert({
            id: generateId(),
            connection_id: connectionId,
            sync_log_id: syncLog.id,
            object_type: objectType,
            external_id: externalId,
            local_id: syncLog.local_id,
            field_name: conflict.field,
            local_value: String(conflict.localValue ?? ''),
            remote_value: String(conflict.remoteValue ?? ''),
            local_updated_at: localData.updated_at as string || null,
            remote_updated_at: remoteUpdatedAt || null,
            status: 'open',
          });
      }
    }

    // Update sync_log
    await supabaseAdmin
      .from('sync_log')
      .update({
        source_checksum: checksum,
        last_synced_at: new Date().toISOString(),
        sync_count: (syncLog.sync_count || 0) + 1,
        last_event_id: eventId,
      })
      .eq('id', syncLog.id);

    await updateEventStatus(eventId, manualConflicts.length > 0 ? 'processed' : 'processed');

    if (manualConflicts.length > 0) {
      return {
        action: 'conflict',
        localId: syncLog.local_id,
        conflicts: manualConflicts.map(c => ({
          field: c.field,
          localValue: c.localValue,
          remoteValue: c.remoteValue,
        })),
      };
    }

    return { action: 'updated', localId: syncLog.local_id };
  }

  // New record — insert
  return await insertNewRecord(connectionId, eventId, objectType, externalId, localTable, mappedData, checksum);
}

/**
 * Insert a new record into the local table and create sync_log entry.
 */
async function insertNewRecord(
  connectionId: string,
  eventId: string,
  objectType: SyncObjectType,
  externalId: string,
  localTable: string,
  mappedData: Record<string, unknown>,
  checksum: string
): Promise<ProcessEventResult> {
  const localId = generateId();

  const insertData = {
    id: localId,
    external_id: externalId,
    ...mappedData,
  };

  const { error: insertError } = await supabaseAdmin
    .from(localTable)
    .insert(insertData);

  if (insertError) {
    await updateEventStatus(eventId, 'failed', insertError.message);
    throw new Error(`Failed to insert ${objectType}: ${insertError.message}`);
  }

  // Create sync_log entry
  await supabaseAdmin
    .from('sync_log')
    .insert({
      id: generateId(),
      connection_id: connectionId,
      object_type: objectType,
      external_id: externalId,
      local_id: localId,
      local_table: localTable,
      sync_direction: 'inbound',
      last_synced_at: new Date().toISOString(),
      source_checksum: checksum,
      sync_count: 1,
      last_event_id: eventId,
    });

  await updateEventStatus(eventId, 'processed');
  return { action: 'created', localId };
}

// ============================================
// CONFLICT RESOLUTION
// ============================================

/**
 * Resolve a sync conflict by choosing local or remote value.
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'resolved_local' | 'resolved_remote' | 'dismissed',
  resolvedBy: string
): Promise<void> {
  // Get the conflict
  const { data: conflict, error: fetchError } = await supabaseAdmin
    .from('sync_conflicts')
    .select('*')
    .eq('id', conflictId)
    .single();

  if (fetchError || !conflict) throw new Error('Conflict not found');

  const c = conflict as unknown as SyncConflict;

  // If resolving with remote value, update the local record
  if (resolution === 'resolved_remote') {
    const { data: syncLogEntry } = await supabaseAdmin
      .from('sync_log')
      .select('*')
      .eq('id', c.sync_log_id)
      .single();

    if (syncLogEntry) {
      const logEntry = syncLogEntry as unknown as SyncLogEntry;
      await supabaseAdmin
        .from(logEntry.local_table)
        .update({ [c.field_name]: c.remote_value })
        .eq('id', c.local_id);
    }
  }

  // Mark conflict as resolved
  await supabaseAdmin
    .from('sync_conflicts')
    .update({
      status: resolution,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', conflictId);
}

// ============================================
// SYNC STATUS & REPORTING
// ============================================

export interface SyncStatusSummary {
  connection: SyncConnection;
  totals: Record<string, { synced: number; lastSyncedAt: string | null }>;
  openConflicts: number;
  recentErrors: number;
  health: 'healthy' | 'warning' | 'error' | 'disconnected';
}

/**
 * Get aggregate sync status for a connection (dashboard data).
 */
export async function getSyncStatus(connectionId: string): Promise<SyncStatusSummary> {
  const connection = await getConnection(connectionId);
  if (!connection) throw new Error('Connection not found');

  // Get sync counts by object type
  const { data: logCounts } = await supabaseAdmin
    .from('sync_log')
    .select('object_type, last_synced_at')
    .eq('connection_id', connectionId);

  const totals: Record<string, { synced: number; lastSyncedAt: string | null }> = {};
  for (const row of (logCounts || []) as any[]) {
    const type = row.object_type as string;
    if (!totals[type]) {
      totals[type] = { synced: 0, lastSyncedAt: null };
    }
    totals[type].synced++;
    if (!totals[type].lastSyncedAt || row.last_synced_at > totals[type].lastSyncedAt!) {
      totals[type].lastSyncedAt = row.last_synced_at;
    }
  }

  // Count open conflicts
  const { data: conflicts } = await supabaseAdmin
    .from('sync_conflicts')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('status', 'open');

  const openConflicts = (conflicts || []).length;

  // Count recent errors (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: errors } = await supabaseAdmin
    .from('sync_events')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('status', 'failed')
    .gte('created_at', oneDayAgo);

  const recentErrors = (errors || []).length;

  // Determine health
  let health: SyncStatusSummary['health'] = 'healthy';
  if (!connection.is_active) {
    health = 'disconnected';
  } else if (recentErrors > 5) {
    health = 'error';
  } else if (openConflicts > 0 || recentErrors > 0) {
    health = 'warning';
  }

  return { connection, totals, openConflicts, recentErrors, health };
}

/**
 * Get paginated sync events for a connection.
 */
export async function getSyncEvents(
  connectionId: string,
  options: { status?: SyncEventStatus; objectType?: string; limit?: number; offset?: number } = {}
): Promise<{ events: SyncEvent[]; total: number }> {
  const { status, objectType, limit = 50, offset = 0 } = options;

  // Fetch all matching events (Turso adapter doesn't support .range())
  let query = supabaseAdmin
    .from('sync_events')
    .select('*')
    .eq('connection_id', connectionId);

  if (status) query = query.eq('status', status);
  if (objectType) query = query.eq('object_type', objectType);

  const { data, error } = await query
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch events: ${error.message}`);

  const allEvents = (data || []) as unknown as SyncEvent[];

  return {
    events: allEvents.slice(offset, offset + limit),
    total: allEvents.length,
  };
}

/**
 * Get open conflicts for a connection.
 */
export async function getOpenConflicts(connectionId: string): Promise<SyncConflict[]> {
  const { data, error } = await supabaseAdmin
    .from('sync_conflicts')
    .select('*')
    .eq('connection_id', connectionId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch conflicts: ${error.message}`);
  return (data || []) as unknown as SyncConflict[];
}

// ============================================
// CONTRACTOR COMPLIANCE MONITORING
// ============================================

export interface ComplianceAlert {
  vendorId: string;
  vendorName: string;
  complianceStatus: string;
  issues: string[];
  canPay: boolean;
}

/**
 * Check contractor compliance status and return payment eligibility.
 * Used by AP/bill payment flow to block payments to non-compliant contractors.
 */
export async function checkContractorCompliance(
  vendorId: string
): Promise<ComplianceAlert | null> {
  const { data: compliance } = await supabaseAdmin
    .from('contractor_compliance')
    .select('*')
    .eq('vendor_id', vendorId)
    .single();

  if (!compliance) return null;

  const c = compliance as any;
  const issues: string[] = [];
  const now = new Date();

  // Check W-9
  if (!c.w9_on_file) issues.push('W-9 not on file');

  // Check insurance expiry dates
  const insuranceChecks = [
    { name: 'General Liability Insurance', expiry: c.insurance_gl_expiry },
    { name: 'Workers Comp Insurance', expiry: c.insurance_wc_expiry },
    { name: 'Auto Insurance', expiry: c.insurance_auto_expiry },
  ];

  for (const check of insuranceChecks) {
    if (check.expiry) {
      const expDate = new Date(check.expiry);
      if (expDate < now) {
        issues.push(`${check.name} expired ${check.expiry}`);
      } else if (expDate < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        issues.push(`${check.name} expiring ${check.expiry}`);
      }
    }
  }

  // Check license
  if (c.license_expiry) {
    const licExpiry = new Date(c.license_expiry);
    if (licExpiry < now) issues.push(`License expired ${c.license_expiry}`);
  }

  // Get vendor name
  const { data: vendor } = await supabaseAdmin
    .from('vendors')
    .select('name')
    .eq('id', vendorId)
    .single();

  const canPay = c.compliance_status === 'compliant';

  return {
    vendorId,
    vendorName: (vendor as any)?.name || 'Unknown',
    complianceStatus: c.compliance_status,
    issues,
    canPay,
  };
}

/**
 * Get all contractors with compliance issues for a user/entity.
 */
export async function getComplianceAlerts(
  userId: string,
  entityId?: string
): Promise<ComplianceAlert[]> {
  let query = supabaseAdmin
    .from('contractor_compliance')
    .select('*, vendors(name)')
    .eq('user_id', userId)
    .in('compliance_status', ['expired', 'expiring', 'missing']);

  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch compliance alerts: ${error.message}`);

  const alerts: ComplianceAlert[] = [];
  for (const row of (data || []) as any[]) {
    const alert = await checkContractorCompliance(row.vendor_id);
    if (alert) alerts.push(alert);
  }

  return alerts;
}

// ============================================
// 1099 TRACKING
// ============================================

/**
 * Get aggregate payments per contractor for 1099 threshold tracking.
 * Returns contractors with >= $600 in payments for the given year.
 */
export async function get1099Candidates(
  userId: string,
  year: number,
  entityId?: string
): Promise<{ vendorId: string; vendorName: string; totalPaid: number; over600: boolean }[]> {
  let query = supabaseAdmin
    .from('bills')
    .select('vendor_id, vendors(name, is_1099_eligible), amount_paid')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .gte('bill_date', `${year}-01-01`)
    .lte('bill_date', `${year}-12-31`);

  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch 1099 data: ${error.message}`);

  // Aggregate by vendor
  const vendorTotals: Record<string, { name: string; total: number; eligible: boolean }> = {};

  for (const row of (data || []) as any[]) {
    if (!row.vendor_id) continue;
    if (!vendorTotals[row.vendor_id]) {
      vendorTotals[row.vendor_id] = {
        name: row.vendors?.name || 'Unknown',
        total: 0,
        eligible: row.vendors?.is_1099_eligible === 1 || row.vendors?.is_1099_eligible === true,
      };
    }
    vendorTotals[row.vendor_id].total += Number(row.amount_paid) || 0;
  }

  return Object.entries(vendorTotals)
    .filter(([_, v]) => v.eligible)
    .map(([vendorId, v]) => ({
      vendorId,
      vendorName: v.name,
      totalPaid: v.total,
      over600: v.total >= 600,
    }))
    .sort((a, b) => b.totalPaid - a.totalPaid);
}
