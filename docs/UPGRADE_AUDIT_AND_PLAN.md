# Books Your Way — Upgrade Audit & Implementation Plan
**Date:** March 7, 2026
**Project:** Books Your Way (books-made-easy-app)
**Related:** SiteSense (sitesense) — Job Costing App

---

## Table of Contents

1. [Feature Audit](#feature-audit)
2. [Multi-Entity & Multi-Location Analysis](#multi-entity--multi-location-analysis)
3. [Architecture Recommendations](#architecture-recommendations)
4. [Implementation Plan](#implementation-plan)

---

## Feature Audit

### Source Document: "Books Your Way Upgrades.docx"

The following features were recommended to take Books Your Way to construction-grade accounting, surpassing QuickBooks. Each was audited against both codebases.

---

### Upgrade Requirements from Document

#### Retainage Engine
**Requirement:**
- Per invoice: Retainage %, Retainage withheld, Retainage released
- Retainage receivable aging
- Retainage payable aging
- Construction cash flow revolves around retainage

#### Change Order Financial Impact
**Requirement:**
- Approved CO: Revenue impact, Margin impact, Completion date impact
- Pending CO: Risk exposure, Projected margin shift
- Change orders may exist operationally but not financially modeled

#### Cost Code Variance Engine
**Requirement:**
- Budget per cost code
- Actual per cost code
- Variance per cost code
- % complete per cost code
- Trend direction
- Creates: Project Manager dashboard, Owner dashboard

#### Cash Flow Forecast by Project
**Requirement:**
- Expected billing schedule
- Expected payables
- Payroll burn
- Retainage timing
- Output: Projected cash position per job

#### Phased Rollout (from document)
- **Phase 1 (Critical):** Project Financial Summary Object, Cost Code Variance Calculator, Cost-to-Complete Logic, Margin Forecasting Engine
- **Phase 2:** WIP Calculation Engine, Over/Under Billing Detection, Retainage Tracking
- **Phase 3:** Cash Flow Forecasting, Burn Rate Modeling, Risk Alerts

---

### Audit Results: What Exists vs What Needs Building

| Feature | Books Your Way | SiteSense | Status |
|---------|---------------|-----------|--------|
| **WIP Calculation Engine** | YES (Complete) | NO | DONE |
| **Over/Under Billing Detection** | YES (in WIP report) | NO | DONE |
| **Cost Codes (CSI)** | NO | YES (Complete) | EXISTS in SiteSense |
| **Schedule of Values (SOV)** | NO | YES (Complete) | EXISTS in SiteSense |
| **Retainage Tracking** | NO | Schema only (fields exist, no API/UI) | NEEDS BUILD |
| **Change Orders** | NO | Schema only (table exists, no API/UI) | NEEDS BUILD |
| **Cost Code Variance Engine** | NO | Cost codes exist, variance tracking NO | NEEDS BUILD |
| **Cash Flow Forecast by Project** | NO | NO | NEEDS BUILD |
| **Project Financial Summary Object** | Partial (WIP data) | Partial (Estimate structure) | NEEDS BUILD |
| **Cost-to-Complete Logic** | NO | NO | NEEDS BUILD |
| **Margin Forecasting Engine** | Partial (gross margin in WIP) | NO | NEEDS BUILD |
| **Burn Rate Modeling** | Partial (`forecasting.ts`, `analytics.ts`) | NO | NEEDS ENHANCEMENT |
| **Risk Alerts** | Partial (`PredictiveAlerts.tsx`) | NO | NEEDS ENHANCEMENT |
| **Budgets** | YES (category-based) | YES (category-based) | EXISTS (not per cost code) |
| **Financial Reports** | YES (P&L, Balance Sheet, Cash Flow, AR/AP Aging) | YES (Basic) | EXISTS |

---

### Detailed Findings: What Already Exists

#### Books Your Way — Existing Features

**WIP Calculation Engine** (Just Built)
- Files: `src/app/api/reports/wip/route.ts`, `src/app/dashboard/reports/wip/page.tsx`
- % complete (cost-to-cost and phase-based methods)
- Revenue recognized = % Complete x Contract Value
- Overbilling / Underbilling detection
- Earned revenue and remaining backlog
- Gross profit and margin per job
- Summary totals across all jobs
- Sortable table with expandable detail rows
- Billing position panel (overbilling as liability, underbilling as asset)

**Burn Rate / Spending Analysis** (Partial)
- Files: `src/lib/forecasting.ts`, `src/lib/analytics.ts`
- Files: `src/app/api/expenses/analytics/forecast/route.ts`, `src/app/api/expenses/analytics/spending-change/route.ts`
- Average daily spending calculation
- Month-to-month variance analysis
- Spending trend detection
- Upcoming recurring expense tracking
- Limitation: Not per-project, only aggregate

**Risk Alerts** (Partial)
- Files: `src/components/PredictiveAlerts.tsx`, `src/lib/forecasting.ts`, `src/app/api/expenses/insights/route.ts`
- Budget warning alerts
- Spending spike detection
- Upcoming bill notifications
- Month tightness alerts
- Limitation: No construction-specific alerts (retainage, CO exposure, cost overruns)

**Budget Tracking** (Basic)
- Files: `src/app/dashboard/expenses/budgets/page.tsx`
- Category-based spending limits
- Monthly/quarterly/yearly periods
- Alert threshold configuration
- Limitation: Not per cost code or per project

---

#### SiteSense — Existing Features

**Cost Codes (CSI MasterFormat)** (Complete)
- Database: `cost_codes` table in `db/schema.ts`
- 16 CSI divisions (00-33): Procurement, Concrete, Masonry, Metals, Wood, Thermal, Openings, Finishes, Specialties, Equipment, Furnishings, Special Construction, Conveying, Fire Suppression, Plumbing, HVAC, Electrical, Communications, Electronic Safety, Earthwork, Exterior Improvements, Utilities
- Hierarchical structure: Division > Section > Subsection
- API: `app/api/cost-codes/route.ts` (full CRUD)
- Seed: `app/api/cost-codes/seed/route.ts`
- UI: `app/(sitesense)/cost-codes/page.tsx`

**Schedule of Values (SOV)** (Complete)
- Database: `schedule_of_values` and `sov_line_items` tables
- API: `app/api/sov/route.ts` (full CRUD, generate from estimate)
- API: `app/api/sov/[id]/items/route.ts`
- UI: `app/(sitesense)/sov/page.tsx`, `app/(sitesense)/sov/[id]/page.tsx`
- Features: Line item cost tracking, previous/current/total billed, % complete per line, balance to finish

**Retainage** (Schema Only)
- Database fields exist in `sov_line_items`:
  - `retainage_percent` (default 10%)
  - `retainage_held`
- No API routes for retainage management
- No UI for retainage tracking
- No retainage aging reports

**Change Orders** (Schema Only)
- Database: `change_orders` table exists in `db/schema.ts`
- Fields: title, description, amount, status (draft/proposed/approved/rejected/invoiced/paid)
- No API routes
- No UI pages
- No financial impact modeling

**Estimates** (Complete)
- Database tables: `estimates`, `estimate_items`, `estimate_sections`, `estimate_allowances`, `estimate_alternates`, `estimate_contingency`, `estimate_overhead_profit`
- Cost breakdown per item: labor, material, equipment, subcontractor
- Full CRUD API routes
- UI for creating and managing estimates

**Financial Reports** (Basic)
- API: `app/api/reports/financial/route.ts` (expense summary by category/job/vendor)
- API: `app/api/reports/estimates/route.ts`
- API: `app/api/reports/labor/route.ts`
- API: `app/api/reports/subcontractors/route.ts`
- 7 report tabs with recharts visualizations

---

## Multi-Entity & Multi-Location Analysis

### Current State: Single-User, Single-Company

Both applications use a **single-user tenant model**:
- All data scoped to `user_id` — no `company_id`, `organization_id`, or `tenant_id`
- `company_settings` table is 1:1 per user (UNIQUE constraint on `user_id`)
- All API routes require and filter by `user_id`
- No cross-user queries exist
- No team member implementation (Settings page has placeholder UI only)
- No role-based access control
- No consolidated reporting across entities

### Why This Matters (QuickBooks Pain Points)

QuickBooks forces users to:
- Buy **separate subscriptions** for each entity ($50-200/month each)
- Maintain **separate logins** for each company
- **No consolidated reporting** across entities
- Location tracking is a "class" workaround, not a first-class feature
- Team access is all-or-nothing per company
- No inter-company transactions
- No cross-entity job costing

### What Multi-Entity + Multi-Location Means

A typical construction company owner has:

```
Organization (MC Holdings LLC)
|
+-- Entity 1 (MC Construction LLC)        <- own CoA, invoices, P&L, tax_id
|   +-- Location A (Seattle HQ)
|   +-- Location B (Portland Branch)
|
+-- Entity 2 (MC Residential LLC)         <- own CoA, invoices, P&L, tax_id
|   +-- Location A (Seattle)
|
+-- Entity 3 (MC Property Mgmt LLC)       <- own CoA, invoices, P&L, tax_id
    +-- Location A (Apartment Complex 1)
    +-- Location B (Office Building 2)

Users (team members)
+-- Owner         -> access to all entities
+-- PM            -> access to Entity 1 only
+-- Bookkeeper    -> access to Entity 1 & 2
```

Each entity needs:
- Its own chart of accounts
- Its own invoices, bills, and payments
- Its own P&L, Balance Sheet, and Cash Flow reports
- Its own tax ID (EIN)
- Its own bank accounts

The owner needs:
- Consolidated P&L across all entities
- Consolidated Balance Sheet
- Inter-company transaction tracking and eliminations
- Cross-entity job costing (sub from sister company)
- Single dashboard with entity switcher

### Competitive Advantage Over QuickBooks

| QuickBooks | Books Your Way |
|------------|----------------|
| Separate subscription per entity | One account, unlimited entities |
| No consolidated P&L | Consolidated P&L, Balance Sheet, Cash Flow across all entities |
| No inter-company transactions | Built-in inter-company billing and eliminations |
| Location tracking is a "class" hack | First-class location support with per-location reporting |
| No cross-entity job costing | Job costs flow across entities |
| Team access is all-or-nothing | Role-based access per entity |
| No construction-grade features | WIP, retainage, change orders, cost codes, SOV |

---

## Architecture Recommendations

### Multi-Entity Data Model

New tables required:

```
organizations
  id, name, type (holding/operating), parent_org_id, tax_id, created_at

entities
  id, organization_id, name, legal_name, entity_type (llc/corp/sole_prop/partnership),
  tax_id, address, city, state, zip, industry, fiscal_year_start, currency, is_active

locations
  id, entity_id, name, type (headquarters/branch/job_site/warehouse),
  address, city, state, zip, is_active

user_entity_roles
  id, user_id, entity_id, role (owner/admin/manager/accountant/viewer),
  permissions (JSON), is_active

inter_company_transactions
  id, from_entity_id, to_entity_id, transaction_type, amount,
  source_invoice_id, target_bill_id, status, created_at
```

All existing tables (invoices, bills, customers, vendors, accounts, etc.) would gain an `entity_id` column alongside `user_id`. The `entity_id` becomes the primary data isolation key, while `user_id` + `user_entity_roles` controls access.

### Key Architectural Decision

**Option A: Build multi-entity foundation first, then construction financials on top**
- Pro: Construction features are multi-entity aware from day one
- Pro: No rework later
- Con: Longer time to ship construction features

**Option B: Build construction financials now (single-entity), retrofit multi-entity later**
- Pro: Ship construction features faster
- Pro: Validates the product with real users sooner
- Con: Requires touching every table and API route twice

**Recommendation: Option B** — Ship construction financials in the current single-entity model. The multi-entity layer can be added as a wrapper around the existing `user_id` pattern by introducing `entity_id` alongside it. The construction financial engines (retainage, cost codes, WIP, etc.) won't need significant rework because they already operate "per job" — adding entity scoping is additive.

---

## Implementation Plan

### Phase 1: Construction Financial Foundation (Critical)
**Priority: Highest — This is what makes you construction-grade**

#### 1.1 Project Financial Summary Object
- Consolidated API endpoint per job combining: contract value, costs, invoices, bills, WIP status, margin, change orders
- Single source of truth for project financial health
- Used by all other financial engines
- **Build in:** Books Your Way API (`/api/jobs/[id]/financial-summary`)

#### 1.2 Cost Code Variance Engine
- Leverage SiteSense's existing CSI cost codes
- Add budget-per-cost-code tracking
- Calculate: budget vs actual vs variance per cost code
- % complete per cost code
- Trend direction (over/under/on track)
- Project Manager dashboard view
- Owner dashboard view (across all projects)
- **Build in:** Books Your Way (calculation engine) + SiteSense (cost code data source)

#### 1.3 Cost-to-Complete Logic
- Remaining Cost = Estimated Cost - Actual Cost (simple)
- Adjusted Remaining Cost = Remaining Cost * (1 + trend factor) (smart)
- Trend factor derived from burn rate analysis
- Feeds into margin forecasting
- **Build in:** Books Your Way API

#### 1.4 Margin Forecasting Engine
- Extend WIP gross profit with trend-based projections
- Current margin vs projected margin at completion
- Early warning when margin is trending below threshold
- Factor in pending change orders
- **Build in:** Books Your Way API + WIP report enhancement

---

### Phase 2: Construction Cash Management
**Priority: High — This separates you from QuickBooks**

#### 2.1 Retainage Engine (Full Lifecycle)
- Extend SiteSense's existing schema fields into full API + UI
- Per-invoice retainage % (configurable, default 10%)
- Track retainage withheld per billing period
- Track retainage released (typically at substantial completion)
- Retainage receivable aging report (what customers owe you)
- Retainage payable aging report (what you owe subs)
- Impact on cash flow projections
- **Build in:** SiteSense (operational tracking) + Books Your Way (financial reporting)

#### 2.2 Change Order Financial Impact
- Build API routes for SiteSense's existing `change_orders` table
- Financial modeling in Books Your Way:
  - Approved CO: revenue impact, margin impact, completion date impact
  - Pending CO: risk exposure, projected margin shift
  - Revised contract value = Original + Approved COs
  - Feeds into WIP (Revenue Recognized uses Revised Contract Value)
- **Build in:** SiteSense (operational CRUD) + Books Your Way (financial modeling)

#### 2.3 Over/Under Billing Detection (Enhancement)
- Already built in WIP report
- Enhance with: threshold alerts, trend tracking, historical comparison
- Add to dashboard as key metric
- **Enhance in:** Books Your Way

---

### Phase 3: Advanced Analytics & Forecasting
**Priority: Medium — Competitive advantage features**

#### 3.1 Cash Flow Forecast by Project
- Model expected billing schedule (from SOV or invoice schedule)
- Model expected payables (from committed costs, POs, sub contracts)
- Factor in payroll burn rate
- Factor in retainage timing (hold and release schedule)
- Output: Projected cash position per job by week/month
- Aggregate: Company-wide cash flow projection
- **Build in:** Books Your Way

#### 3.2 Burn Rate Modeling (Enhancement)
- Extend existing `forecasting.ts` to per-project level
- Daily/weekly/monthly burn rate per job
- Burn rate vs plan comparison
- Projected completion date based on burn rate
- **Enhance in:** Books Your Way

#### 3.3 Risk Alerts (Enhancement)
- Extend existing `PredictiveAlerts.tsx` with construction-specific triggers:
  - Cost overrun warning (actual > budget by threshold)
  - Retainage accumulation alert
  - Change order exposure (pending COs exceed % of contract)
  - Underbilling threshold exceeded
  - Cash flow shortfall projected
  - Margin erosion detected
  - Cost-to-complete exceeds remaining budget
- **Enhance in:** Books Your Way

---

### Phase 4: Multi-Entity & Multi-Location
**Priority: Medium-High — Enterprise differentiator**

#### 4.1 Organization & Entity Layer
- New tables: `organizations`, `entities`, `locations`
- Add `entity_id` to all existing tables
- Entity switcher in UI (dropdown in header)
- Per-entity settings (CoA, tax ID, fiscal year)

#### 4.2 User Roles & Permissions
- New table: `user_entity_roles`
- Roles: Owner, Admin, Manager, Accountant, Viewer
- Per-entity access control
- Team invitation system
- Implement the existing placeholder Team Members UI

#### 4.3 Consolidated Reporting
- Consolidated P&L across selected entities
- Consolidated Balance Sheet
- Consolidated Cash Flow
- Inter-company elimination entries
- Entity comparison reports

#### 4.4 Inter-Company Transactions
- New table: `inter_company_transactions`
- One entity invoices another (auto-creates matching bill)
- Elimination entries for consolidated reporting
- Transfer pricing support

#### 4.5 Multi-Location Reporting
- Revenue, expenses, and profitability per location
- Location-based filtering on all reports
- Location hierarchy within entities
- Crew/staff assignment per location

---

### Phase 5: SiteSense Sync Layer
**Priority: Medium — Connects the ecosystem**

#### 5.1 Data Sync API
- Real-time or scheduled sync between SiteSense and Books Your Way
- Job data flows from SiteSense to Books Your Way
- Cost code actuals sync for variance engine
- SOV billing data syncs for WIP calculations
- Change order data syncs for financial impact modeling

#### 5.2 Unified Dashboard
- Books Your Way dashboard shows SiteSense job health
- SiteSense shows Books Your Way financial summary per job
- Single sign-on across both apps
- Deep links between related data

---

## Summary: What's Done, What's Next

### Already Complete
- WIP Calculation Engine (revenue recognized, over/under billing, backlog)
- Basic financial reports (P&L, Balance Sheet, Cash Flow, AR/AP Aging)
- Job costing with phases and budget vs actual
- Expense tracking with burn rate analysis
- Predictive alerts (basic)
- Cost codes and SOV (in SiteSense)
- Estimate system with cost breakdown (in SiteSense)

### Immediate Priority (Phase 1)
- Project Financial Summary Object
- Cost Code Variance Engine
- Cost-to-Complete Logic
- Margin Forecasting Engine

### Next Up (Phase 2)
- Retainage Engine (full lifecycle)
- Change Order Financial Impact
- Over/Under Billing enhancements

### Then (Phase 3)
- Cash Flow Forecast by Project
- Burn Rate Modeling per project
- Construction Risk Alerts

### Foundation for Scale (Phase 4)
- Multi-Entity support
- Multi-Location support
- User Roles & Permissions
- Consolidated Reporting
- Inter-Company Transactions

### Ecosystem (Phase 5)
- SiteSense sync layer
- Unified dashboard
- Single sign-on

---

## Files Reference

### Books Your Way — Key Files
| Area | Files |
|------|-------|
| WIP Report | `src/app/api/reports/wip/route.ts`, `src/app/dashboard/reports/wip/page.tsx` |
| Jobs | `src/app/api/jobs/route.ts`, `src/app/dashboard/jobs/[id]/page.tsx` |
| Invoices | `src/app/api/invoices/route.ts`, `src/app/dashboard/invoices/` |
| Bills | `src/app/api/bills/route.ts`, `src/app/dashboard/bills/` |
| Reports | `src/app/dashboard/reports/page.tsx`, `src/app/dashboard/reports/*/page.tsx` |
| Forecasting | `src/lib/forecasting.ts`, `src/lib/analytics.ts` |
| Alerts | `src/components/PredictiveAlerts.tsx` |
| Dashboard | `src/app/api/dashboard/route.ts`, `src/app/dashboard/page.tsx` |
| Settings | `src/app/dashboard/settings/page.tsx` |
| Company | `src/app/api/company_settings/route.ts` |
| Schema | `turso/schema.sql` |
| Navigation | `src/components/DashboardLayout.tsx` |

### SiteSense — Key Files
| Area | Files |
|------|-------|
| Cost Codes | `app/api/cost-codes/route.ts`, `app/(sitesense)/cost-codes/page.tsx` |
| SOV | `app/api/sov/route.ts`, `app/(sitesense)/sov/page.tsx` |
| Change Orders | `db/schema.ts` (table definition only) |
| Estimates | `app/api/estimates/`, `app/(sitesense)/estimates/` |
| Jobs | `app/api/jobs/route.ts`, `app/(sitesense)/jobs/` |
| Schema | `db/schema.ts` |
| Reports | `app/api/reports/financial/route.ts`, `app/(sitesense)/reports/` |
