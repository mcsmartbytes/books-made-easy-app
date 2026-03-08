# Changes — March 7, 2026

## Sidebar Category Dropdowns
- Replaced flat navigation with 6 collapsible category dropdowns
- Categories: Sales & Revenue, Purchasing & Costs, Job Costing, Accounting, Reports & Tools
- Auto-expands category matching current route
- Dashboard pinned at top, Entities + Settings pinned at bottom
- Chevron animation on expand/collapse

## Phase 4: Multi-Entity & Multi-Location (COMPLETE)

### Database Migration (`turso/migrations/006_multi_entity.sql`) — APPLIED
- `organizations` — top-level grouping
- `entities` — companies/divisions/branches/departments within an org
- `locations` — physical locations per entity (office, warehouse, jobsite, shop, yard)
- `user_entity_roles` — RBAC per entity (owner/admin/manager/accountant/viewer)
- `intercompany_transactions` — transfers between entities
- Added `entity_id` column to 11 existing tables (jobs, invoices, bills, expenses, accounts, customers, vendors, payments, bank_accounts, journal_entries)

### Also Applied Pending Migrations
- `004_cost_codes.sql` — cost codes and budgets (Phase 1)
- `005_retainage_change_orders.sql` — retainage fields + change orders table (Phase 2)

### API Routes Created
- `/api/organizations` — CRUD with auto-entity + owner role creation
- `/api/entities` — CRUD with permission checks, prevents deleting last entity
- `/api/locations` — CRUD for physical locations
- `/api/intercompany` — Create/approve/post/void inter-company transactions
- `/api/reports/consolidated` — Cross-entity P&L comparison

### UI Pages Created
- `/dashboard/settings/entities` — Entity management (orgs, entities, locations, user roles)
- `/dashboard/settings/entities/intercompany` — Inter-company transaction management
- `/dashboard/reports/consolidated` — Cross-entity financial comparison with revenue bars

### Infrastructure
- `EntityContext.tsx` — React context provider with `useEntity()` hook, localStorage persistence
- `EntitySwitcher.tsx` — Sidebar dropdown below logo for switching entities
- Updated `Providers.tsx` — Added EntityProvider
- Updated `DashboardLayout.tsx` — Added EntitySwitcher + category dropdowns
- Updated `tursoAdmin.ts` — Relation map for new tables
- Updated `reports/page.tsx` — Added Consolidated Report entry

### Bug Fixes
- Fixed EntityContext blocking render (changed from `loading: true` default to `false`, use `useSession()` instead of `supabase.auth.getUser()`)
- Fixed expired Turso auth token in `.env.local`
- Reset user password in database

---

## TODO — Next Session

### Phase 5: SiteSense Sync Layer
- 5.1 Define sync protocol between SiteSense and Books Your Way
- 5.2 Create sync API endpoints
- 5.3 Job/timecard/equipment data flow
- 5.4 Conflict resolution strategy
- 5.5 Sync status dashboard

### Other Items
- **Turso token expiration**: The new token has no explicit expiry but monitor for 401 errors. Use `turso db tokens create books-made-easy` to regenerate if needed.
- **Git push**: Password auth disabled on GitHub. Use inline token push:
  ```
  git push https://mcsmartbytes:<TOKEN>@github.com/mcsmartbytes/books-made-easy-app.git
  ```
- **Entity testing**: Create an organization via Settings > Entities, add multiple entities, test the entity switcher and consolidated report
- **Existing data migration**: Consider a one-time script to assign existing jobs/invoices/bills to a default entity once the user creates their first organization
