# Phase 5: SiteSense Sync Layer — Architecture Plan

## Overview

Hybrid polling + webhook sync between SiteSense (field management) and Books Made Easy (financial processing). SiteSense pushes via webhook, Books can also pull on-demand.

**Conflict Resolution**: SiteSense wins for operational fields (job status, timecard hours, equipment). Books Made Easy wins for financial fields (invoice totals, payment status, retainage %).

---

## Database Migration: `turso/migrations/007_sync_layer.sql`

### New Tables (7 total)

| Table | Purpose |
|-------|---------|
| `sync_connections` | One row per connected external system per entity |
| `sync_events` | Raw inbound event log (every webhook POST recorded before processing) |
| `sync_log` | Canonical record of synced objects (external_id ↔ local_id mapping + checksum) |
| `sync_conflicts` | Records where auto-resolution failed for manual review |
| `sov_lines` | Schedule of Values lines synced from SiteSense |
| `equipment_log` | Equipment usage records synced from SiteSense |
| `timecards` | Formal timecard table (synced from SiteSense, posted as bills) |

All tables follow project conventions: TEXT PKs (UUID), entity_id, user_id, datetime triggers.

---

## Sync Protocol

### Webhook Ingest (SiteSense → Books)
- **Endpoint**: `POST /api/sync/sitesense/ingest`
- **Auth**: HMAC-SHA256 via `X-SiteSense-Signature` header (no session — machine-to-machine)
- **Events**: `job.created`, `job.updated`, `timecard.submitted`, `timecard.approved`, `cost_code.synced`, `change_order.approved`, `sov.updated`, `equipment.logged`, `contractor.updated`, `contractor_compliance.updated`, `bulk_sync`
- **Flow**: Verify signature → record to sync_events → process immediately → return result

### Manual Pull (User-triggered)
- **Endpoint**: `POST /api/sync/sitesense/pull`
- **Auth**: Session-based (NextAuth)
- **Types**: `jobs`, `timecards`, `cost_codes`, `change_orders`, `sov`, `equipment`, `contractors`, or `all`
- **Flow**: Fetch from SiteSense REST API → record events → process each

### Idempotency
- Every `processEvent` checks `sync_log.source_checksum` before writing
- Duplicate webhooks are marked `skipped`
- SHA-256 checksum of canonical JSON ensures change detection

---

## Library Files

### `src/lib/syncProtocol.ts`
- TypeScript interfaces for all SiteSense payload shapes (contract between apps)
- `verifyWebhookSignature()` — HMAC-SHA256
- `computeChecksum()` — SHA-256 of canonical JSON
- `mapSiteSense*()` — Field mapping functions for each data type
- `detectConflicts()` — Protected-fields conflict detection

### `src/lib/syncEngine.ts`
- `getOrCreateConnection()` — Connection record management
- `recordInboundEvent()` — Write raw event to sync_events
- `processEvent()` — Core idempotent processor (check/skip/upsert/conflict)
- `resolveConflict()` — Apply chosen resolution
- `getSyncStatus()` — Aggregate status for dashboard
- `runBulkSync()` — Full pull from SiteSense API

---

## API Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/sync/sitesense/ingest` | POST | Webhook receiver (HMAC auth) |
| `/api/sync/sitesense/pull` | POST | Manual full data pull (session auth) |
| `/api/sync/sitesense/status` | GET | Aggregate sync health for dashboard |
| `/api/sync/sitesense/events` | GET | Paginated event log |
| `/api/sync/sitesense/conflicts` | GET/PUT | View and resolve conflicts |
| `/api/sync/sitesense/connection` | GET/PUT/POST | Connection settings + test |
| `/api/sync/sitesense/timecards` | GET/POST | Timecard management + "Post to Payroll" |
| `/api/sync/sitesense/sov` | GET/PUT/POST | SOV lines + "Generate Progress Invoice" |

---

## Sync Dashboard: `/dashboard/sync/page.tsx`

### 4 Tabs

**Overview**
- Connection health badge (green/yellow/red)
- 6 data-type stat cards: Jobs, Timecards, Cost Codes, Change Orders, SOV Lines, Equipment
- Each card: count synced, last sync time, "Sync Now" button
- Alert strip for open conflicts

**Events Log**
- Filter by status, object type, date range
- Table: timestamp, type, external ID, event type, status badge, error message
- Pagination

**Conflicts**
- Side-by-side local vs remote values
- "Keep Local" / "Use SiteSense" buttons per conflict
- Bulk dismiss option

**Settings**
- Connection URL, webhook secret (masked), API key
- Auto-sync toggle, pull frequency selector

---

## Data Flows

### Timecard → Bill (Post to Payroll)
1. Select approved timecards → `POST /api/sync/sitesense/timecards { action: 'post_to_payroll' }`
2. Group by job, sum costs, create bill per job group
3. Create bill_items (one per timecard), link timecards to bill

### SOV → Progress Invoice
1. `POST /api/sync/sitesense/sov { action: 'generate_invoice', job_id, period_end_date }`
2. Calculate per-line amounts with retainage
3. Create AIA-style progress billing invoice

---

## Build Sequence

### 5.1 — Database + Protocol Foundation
- [ ] `turso/migrations/007_sync_layer.sql` (7 tables + triggers + indexes)
- [ ] Run migration
- [ ] `src/lib/syncProtocol.ts` (interfaces + pure functions)
- [ ] `src/lib/syncEngine.ts` (engine functions)
- [ ] Add `SITESENSE_WEBHOOK_SECRET` and `SITESENSE_API_KEY` to `.env.local`

### 5.2 — Core API Endpoints
- [ ] `/api/sync/sitesense/ingest/route.ts`
- [ ] `/api/sync/sitesense/pull/route.ts`
- [ ] `/api/sync/sitesense/status/route.ts`
- [ ] `/api/sync/sitesense/connection/route.ts`

### 5.3 — Data-Type Specific Endpoints
- [ ] `/api/sync/sitesense/timecards/route.ts`
- [ ] `/api/sync/sitesense/sov/route.ts`
- [ ] `/api/sync/sitesense/events/route.ts`
- [ ] `/api/sync/sitesense/conflicts/route.ts`

### 5.4 — Conflict Resolution
- [ ] `detectConflicts()` with protected-fields per object type
- [ ] Conflict resolution PUT handler

### 5.5 — Sync Status Dashboard
- [ ] `/dashboard/sync/page.tsx` (4 tabs)
- [ ] Add "Sync Status" to Job Costing nav in `DashboardLayout.tsx`
- [ ] Update `/dashboard/sitesense/page.tsx` with sync dashboard link

---

## Contractor Compliance (from SiteSense)

SiteSense manages contractor compliance (insurance certs, W-9s, licenses, safety docs). Books Made Easy consumes this data to:

- **Sync contractor/vendor records** — SiteSense contractors become vendors in Books
- **Block payments** to non-compliant contractors (expired insurance, missing W-9)
- **Feed AP** — Contractor invoices/timecards from SiteSense create bills in Books
- **1099 tracking** — Aggregate contractor payments for year-end 1099-NEC generation
- **Compliance status display** — Show compliance badges on vendor detail pages

### New Sync Data Types
- `contractor.updated` — Contractor master record (name, EIN, W-9 status, payment terms)
- `contractor_compliance.updated` — Insurance certs, license status, expiration dates
- `contractor_invoice.submitted` — Contractor payment requests → bills in Books

### New DB Table: `contractor_compliance` (in sync migration)
- Links to `vendors` table via `external_id`
- Fields: `w9_on_file`, `w9_date`, `insurance_gl_expiry`, `insurance_wc_expiry`, `license_expiry`, `safety_cert_expiry`, `compliance_status` (compliant/expiring/expired/missing), `last_verified_at`

### Contractor → AP Flow
1. SiteSense submits contractor invoice → sync ingest
2. Books creates bill linked to vendor + job + cost codes
3. Payment blocked if `compliance_status != 'compliant'`
4. Year-end: aggregate payments per contractor for 1099-NEC threshold ($600+)

---

## Expense Tracker App Sync

A third companion app (Expense Tracker / Expenses Made Easy) will also sync into Books Made Easy.

### Sync Architecture
- Same `sync_connections` table with `source = 'expenses_made_easy'`
- Same protocol (webhook + pull) and conflict resolution
- Existing `/api/sync/expenses/route.ts` will be migrated to the new sync engine

### Data Types
- `expense.created` / `expense.updated` — Individual expense records
- `receipt.scanned` — OCR receipt data
- `mileage.logged` — Mileage entries
- `expense_report.submitted` — Grouped expense reports for approval

### Integration Points
- Expenses sync into `expenses` table with `external_source = 'expenses_made_easy'`
- Expense reports can auto-create bills or journal entries
- Entity-aware: expenses tagged to correct entity
- Category mapping between Expense Tracker categories and Books chart of accounts

---

## AWS Database Migration (Upcoming)

Current: Turso (SQLite/libSQL)
Target: AWS (likely RDS PostgreSQL or Aurora)

### Migration Considerations
- All `execSql` calls in `src/lib/turso.ts` will need a database adapter layer
- SQLite-specific syntax to address: `datetime('now')`, `INSERT OR REPLACE`, `GENERATED ALWAYS AS ... STORED`
- Plan: Create `src/lib/db/adapter.ts` with a provider interface so we can swap Turso → AWS without rewriting every API route
- Migration scripts will need SQL dialect conversion (SQLite → PostgreSQL)
- Benefits of AWS: proper concurrent connections, LISTEN/NOTIFY for real-time sync, better scalability for multi-entity

### Preparation (do now to ease migration later)
- Keep business logic in `src/lib/` engine files (already doing this)
- Avoid SQLite-specific functions in new code where possible
- Use parameterized queries consistently (already doing this)
- New migrations should note PostgreSQL equivalents in comments

---

## Critical Notes

- **HMAC**: Read body as `request.text()` BEFORE parsing JSON (signature verification requires raw bytes)
- **Secret storage**: Use AES-256 encryption (not bcrypt) since HMAC needs plaintext secret
- **No background jobs on Vercel**: Process synchronously, use pagination for bulk syncs (50 records per request with continuation token)
- **Entity isolation**: Every operational table carries `entity_id` — multi-entity companies can have separate SiteSense connections per entity
- **Existing sync route**: Leave `/api/sync/sitesense/route.ts` intact for backward compatibility, add comment noting new traffic should use `/api/sync/sitesense/ingest`
