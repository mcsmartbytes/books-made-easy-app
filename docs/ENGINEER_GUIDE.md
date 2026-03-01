# Books Your Way — Engineer Guide

> Summary for evaluating the codebase and database architecture.

## Quick Start

```bash
git clone https://github.com/mcsmartbytes/books-made-easy-app.git
cd books-made-easy-app
npm install
cp .env.local.example .env.local   # Add your DB credentials
npm run dev                        # http://localhost:3000
```

---

## Tech Stack

| Layer         | Technology                                       |
|---------------|--------------------------------------------------|
| Framework     | Next.js 14.2 (App Router)                        |
| Language      | TypeScript (strict mode)                         |
| Styling       | Tailwind CSS 3.4                                 |
| Database      | **Turso (libSQL / SQLite)** — hosted edge SQLite |
| Auth          | NextAuth.js 4 (credentials + Google OAuth, JWT)  |
| Monitoring    | Sentry                                           |
| Mobile        | Capacitor (iOS/Android shells)                   |
| AI            | Anthropic Claude SDK + Vercel AI SDK             |
| Deployment    | Vercel                                           |
| Cron          | Vercel Cron (daily overdue invoice check)        |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Browser (React Client Components)              │
│  src/utils/supabase.ts  ← API call wrapper      │
│     ↓ fetch('/api/{table}')                     │
├─────────────────────────────────────────────────┤
│  Next.js API Routes (44 route files)            │
│  src/app/api/*/route.ts                         │
│     ↓ import supabaseAdmin                      │
├─────────────────────────────────────────────────┤
│  ORM Layer                                      │
│  src/utils/supabaseAdmin.ts  (re-export)        │
│  src/utils/tursoAdmin.ts     (688 lines)        │
│     ↓ execSql()                                 │
├─────────────────────────────────────────────────┤
│  Database Client                                │
│  src/lib/turso.ts  (@libsql/client/web)         │
│     ↓ HTTPS                                     │
├─────────────────────────────────────────────────┤
│  Turso (libSQL) — hosted SQLite                 │
│  libsql://books-made-easy-*.turso.io            │
└─────────────────────────────────────────────────┘
```

### Key Data Flow

1. **Client** calls `supabase.from('invoices').select('*').eq('user_id', id)`
2. This builds a fetch to `GET /api/invoices?user_id=...`
3. The **API route** calls `supabaseAdmin.from('invoices').select('*').eq('user_id', id)`
4. The **ORM** (`tursoAdmin`) builds SQL: `SELECT * FROM "invoices" WHERE "user_id" = ?`
5. `execSql()` sends it to Turso over HTTPS, returns rows

---

## Database Files (What to Read)

| File | Lines | Purpose |
|------|-------|---------|
| `turso/schema.sql` | 906 | **Complete schema** — 38 tables, indexes, triggers, CHECK constraints |
| `src/lib/turso.ts` | 32 | Raw `@libsql/client/web` connection (singleton, env vars) |
| `src/utils/tursoAdmin.ts` | 688 | **Custom ORM** — Supabase-compatible query builder for SQLite |
| `src/utils/supabaseAdmin.ts` | 8 | Re-exports `tursoAdmin` as `supabaseAdmin` (alias layer) |
| `src/utils/supabase.ts` | 413 | Client-side query builder — routes all DB ops through API |
| `src/lib/db.ts` | 24 | Tagged template literal SQL helper (`sql\`SELECT...\``) |
| `src/lib/auth.ts` | 102 | NextAuth config — uses `sql` tagged template for user lookup |
| `turso/migrations/` | — | Migrations 001-005 (already applied) |

### Priority reading order:
1. `turso/schema.sql` — understand the data model
2. `src/utils/tursoAdmin.ts` — understand the ORM (this is the core abstraction)
3. Any API route (e.g., `src/app/api/invoices/route.ts`) — see the ORM in use
4. `src/lib/turso.ts` — the raw DB connection

---

## Schema Summary (38 Tables)

### Core Entities
| Table | Description | Key Fields |
|-------|-------------|------------|
| `users` | App users (NextAuth) | email, password_hash, name, business_name |
| `company_settings` | Per-user company config | company_name, industry_id, tax_id, fiscal_year_start |
| `customers` | Client contacts | name, company, balance, is_active (soft delete) |
| `vendors` | Supplier contacts | name, company, tax_id (1099), balance, is_active |
| `accounts` | Chart of accounts | code (1000-7900), type, subtype, normal_balance |
| `categories` | Income/expense categories | type, tax_deductible, irs_category |
| `products_services` | Product/service catalog | type (product/service), price, cost, tax_rate |

### Financial Documents
| Table | Description | Statuses |
|-------|-------------|----------|
| `invoices` + `invoice_items` | Customer invoices with line items | draft, sent, paid, overdue, cancelled |
| `estimates` + `estimate_items` | Quotes/proposals | draft, sent, accepted, declined, expired, converted |
| `bills` + `bill_items` | Vendor bills with line items | draft, unpaid, paid, overdue, cancelled |
| `payments` | Unified payment ledger | type: received / made |
| `payments_received` | Legacy AR payments | Links to invoices + customers |
| `payments_made` | Legacy AP payments | Links to bills + vendors |

### Job Costing
| Table | Description |
|-------|-------------|
| `jobs` | Projects linked to customers |
| `job_phases` | Task breakdown within jobs |

### Banking
| Table | Description |
|-------|-------------|
| `bank_accounts` | Checking, savings, credit cards |
| `bank_transactions` | Imported/manual transactions |
| `reconciliations` | Bank statement reconciliation |
| `deposits` + `deposit_items` | Batched payment deposits |

### Accounting
| Table | Description |
|-------|-------------|
| `journal_entries` + `journal_entry_lines` | Double-entry journal |
| `custom_reports` | User-saved report definitions |

### Expenses & Tracking
| Table | Description |
|-------|-------------|
| `expenses` | Individual expense records |
| `merchant_rules` / `item_category_rules` | Auto-categorization rules |
| `recurring_expenses` | Scheduled recurring expenses |
| `detected_subscriptions` + `subscription_price_history` | Auto-detected subscriptions |
| `budgets` | Category budget limits |
| `mileage` | Business mileage tracking |

### Reminders & Late Fees
| Table | Description |
|-------|-------------|
| `reminder_settings` | Per-user reminder config |
| `invoice_reminders` | Log of reminders sent |
| `late_fee_settings` | Per-user late fee config |
| `invoice_late_fees` | Audit trail of applied fees |

### CRM
| Table | Description |
|-------|-------------|
| `customer_notes` | Free-text notes per customer |
| `customer_todos` | Task list per customer |

---

## ORM Layer — How tursoAdmin Works

The ORM (`src/utils/tursoAdmin.ts`) provides a **Supabase-compatible API** over raw SQLite. It was built so existing Supabase-style code didn't need rewriting when migrating from Supabase/Postgres to Turso/SQLite.

### Query Patterns Used Everywhere

```typescript
import { supabaseAdmin } from '@/utils/supabaseAdmin';

// SELECT
const { data, error } = await supabaseAdmin
  .from('invoices')
  .select('*, customers(name, email)')  // relation fetching
  .eq('user_id', userId)
  .eq('status', 'sent')
  .order('due_date', { ascending: true })
  .limit(10);

// SELECT single
const { data } = await supabaseAdmin
  .from('company_settings')
  .select('*')
  .eq('user_id', userId)
  .single();

// INSERT (auto-generates UUID if no id provided)
const { data } = await supabaseAdmin
  .from('customers')
  .insert({ user_id, name, email })
  .select('*');

// UPDATE
await supabaseAdmin
  .from('invoices')
  .update({ status: 'paid', amount_paid: 5000 })
  .eq('id', invoiceId);

// UPSERT
await supabaseAdmin
  .from('company_settings')
  .upsert({ user_id, company_name }, { onConflict: 'user_id' });

// DELETE
await supabaseAdmin
  .from('invoices')
  .delete()
  .eq('id', invoiceId);
```

### Relation Fetching

The ORM supports Supabase-style relation syntax in `.select()`:

```typescript
// belongs_to: invoice → customer
.select('*, customers(name, email)')

// has_many: invoice → invoice_items
.select('*, invoice_items(description, quantity, rate, amount)')

// Inner join (filter out nulls)
.select('*, customers!inner(name)')
```

Relations are defined in a `RELATION_MAP` at the top of `tursoAdmin.ts` (lines 5-73).

### What the ORM Does NOT Support

- Transactions (no BEGIN/COMMIT wrapper)
- Complex JOINs beyond the relation map
- Aggregations (COUNT, SUM, etc.) — these use raw `execSql()` in API routes
- OR conditions — only AND chains
- Subqueries

For complex queries, API routes use raw SQL:

```typescript
import { execSql } from '@/lib/turso';

const rows = await execSql(
  'SELECT customer_id, SUM(total) as total FROM invoices WHERE user_id = ? GROUP BY customer_id',
  [userId]
);
```

---

## API Routes (44 files)

All routes follow the same pattern:

```
src/app/api/{resource}/route.ts
  - GET:    List/read (filtered by user_id + query params)
  - POST:   Create (or upsert if _upsert flag present)
  - PUT:    Update (by id)
  - DELETE: Remove (hard or soft delete)
```

### Conventions
- Every table is scoped by `user_id` (multi-tenant)
- UUIDs generated via `crypto.randomUUID()`
- Timestamps stored as ISO 8601 text strings
- Booleans stored as INTEGER (0/1) — SQLite has no boolean type
- JSON arrays stored as TEXT with `JSON.stringify()`
- Client sends `_upsert: true` and `_onConflict: 'column'` — API routes strip these before insert
- Soft deletes for customers, vendors, accounts, categories (`is_active = 0`)
- Hard deletes for transactions (invoices, bills, payments, etc.)
- Child tables use `ON DELETE CASCADE` in schema

### Notable Routes
| Route | Special Logic |
|-------|---------------|
| `/api/invoices` POST | Calculates subtotal/tax/total from line items |
| `/api/payments` POST | Updates linked invoice/bill amount_paid and status |
| `/api/deposits` POST | Batches payments, updates bank account balance |
| `/api/reconciliations` PUT | Toggle transactions, complete reconciliation |
| `/api/bank-transactions/import` POST | CSV parsing with auto-column detection |
| `/api/invoice-late-fees` POST | Reads settings, calculates fee, updates invoice total |
| `/api/cron/overdue-check` GET | Marks overdue, sends reminders, applies late fees |
| `/api/customer-statements` GET | Computes opening/closing balance from invoices+payments |
| `/api/reports` GET | P&L, balance sheet, cash flow, AR/AP aging |
| `/api/sync/expenses` POST | Maps from Expenses Made Easy companion app |
| `/api/sync/sitesense` POST | Maps from SiteSense companion app |

---

## Authentication

- **NextAuth.js v4** with JWT strategy (no database sessions)
- Providers: email/password (bcrypt) + optional Google OAuth
- Config: `src/lib/auth.ts`
- API route: `src/app/api/auth/[...nextauth]/route.ts`
- Signup: `src/app/api/auth/signup/route.ts` (creates user in `users` table)
- Session includes: `user.id`, `user.email`, `user.name`, `user.businessName`

---

## Multi-Tenancy

Every data table has a `user_id` column with a foreign key to `users(id)`. There is **no Row-Level Security** — isolation is enforced at the application layer (API routes filter by `user_id` from the session). This is the SQLite/Turso approach since SQLite doesn't support RLS.

A database with native RLS (like Postgres/Supabase) could enforce this at the DB level instead.

---

## Companion Apps

Two separate apps sync data into Books Your Way:

| App | URL | Sync Endpoint | What It Sends |
|-----|-----|---------------|---------------|
| Expenses Made Easy | expenses-made-easy-opal.vercel.app | `/api/sync/expenses` | Expenses, mileage, categories |
| SiteSense | sitesense-lilac.vercel.app | `/api/sync/sitesense` | Clients→Customers, Estimates→Invoices, Time→Bills |

Both use `external_id` and `external_source` fields for deduplication.

---

## Environment Variables

```env
# Required
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=eyJ...

# Auth
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000

# Optional
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CRON_SECRET=...
SENTRY_DSN=...
ANTHROPIC_API_KEY=...
```

---

## Database Migration Considerations

### What Would Change with a New Database

| Component | Impact | Notes |
|-----------|--------|-------|
| `src/lib/turso.ts` | **Replace** | Swap `@libsql/client` for new DB driver (e.g., `pg`, `@neondatabase/serverless`, Prisma) |
| `src/utils/tursoAdmin.ts` | **Replace or heavily modify** | 688-line custom ORM. Could replace with Prisma, Drizzle, or adapt for Postgres SQL dialect |
| `src/lib/db.ts` | **Replace** | Tagged template helper tied to Turso client |
| `src/lib/auth.ts` | **Minor change** | Uses `sql` tagged template for user lookup |
| `turso/schema.sql` | **Translate** | SQLite → target dialect (e.g., `INTEGER` → `BOOLEAN`, `TEXT` dates → `TIMESTAMP`, add `SERIAL`/`UUID` types) |
| All 44 API routes | **No change** if ORM API stays the same | They all use `supabaseAdmin.from().select().eq()` — swap the implementation, keep the interface |
| `src/utils/supabase.ts` | **No change** | Client-side wrapper only calls API routes, never touches DB directly |

### SQLite-Specific Patterns to Watch

1. **No native boolean** — uses `INTEGER` (0/1) throughout
2. **No native UUID type** — uses `TEXT` with `crypto.randomUUID()`
3. **No native timestamp** — uses `TEXT` with `datetime('now')`
4. **LIKE is case-insensitive** for ASCII by default in SQLite
5. **ON CONFLICT** syntax — SQLite-specific upsert syntax in tursoAdmin
6. **PRAGMA foreign_keys** — must be enabled per connection in SQLite
7. **No RLS** — all access control is application-layer

### Migration Strategy Options

1. **Keep the same ORM interface** — replace `tursoAdmin` internals to generate Postgres SQL instead of SQLite SQL. API routes stay untouched.
2. **Switch to an established ORM** (Prisma, Drizzle) — more work upfront but better long-term tooling. Requires updating all 44 API routes.
3. **Use Supabase directly** — the code already uses a Supabase-compatible API (`supabaseAdmin.from().select().eq()`). Migrating to actual Supabase would mostly mean replacing the ORM with the real Supabase client.

---

## File Structure

```
books-made-easy-app/
├── src/
│   ├── app/
│   │   ├── api/                    # 44 API route files
│   │   │   ├── invoices/route.ts
│   │   │   ├── bills/route.ts
│   │   │   ├── customers/route.ts
│   │   │   ├── payments/route.ts
│   │   │   ├── bank-accounts/route.ts
│   │   │   ├── reports/route.ts
│   │   │   ├── cron/overdue-check/route.ts
│   │   │   ├── sync/expenses/route.ts
│   │   │   ├── sync/sitesense/route.ts
│   │   │   └── ... (35 more)
│   │   ├── dashboard/              # 20+ dashboard pages
│   │   │   ├── page.tsx            # Main dashboard
│   │   │   ├── invoices/           # List + new + [id] detail
│   │   │   ├── bills/
│   │   │   ├── customers/
│   │   │   ├── vendors/
│   │   │   ├── banking/
│   │   │   ├── reports/
│   │   │   ├── jobs/
│   │   │   ├── settings/
│   │   │   └── ...
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── onboarding/page.tsx
│   │   └── layout.tsx              # Root layout (PWA meta, service worker)
│   ├── components/                 # 14 shared components
│   ├── contexts/                   # AuthContext, UserModeContext
│   ├── data/                       # Industry presets, account help, IRS references
│   ├── lib/                        # DB, auth, analytics, CSV parser, validation
│   └── utils/                      # supabaseAdmin, supabase client, tursoAdmin
├── turso/
│   ├── schema.sql                  # Full 38-table schema
│   └── migrations/                 # 001-005
├── public/                         # Icons, manifest, service worker
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vercel.json                     # Cron config
```

---

## Demo Data

The app includes a comprehensive seed API at `/api/seed-demo`:

```bash
# Seed all 38 tables with realistic data
curl -X POST http://localhost:3000/api/seed-demo \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"YOUR_USER_ID","action":"seed","fresh":true}'
```

This creates a full demo company ("Cascade Consulting Group") with 7 customers, 7 vendors, 10 invoices, 7 bills, bank accounts, journal entries, and more — covering every feature in the app.
