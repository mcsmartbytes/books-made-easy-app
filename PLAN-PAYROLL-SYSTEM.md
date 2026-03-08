# Payroll System — Architecture Plan

## Overview

Configuration-driven payroll system with embedded federal tax tables and extensible state tax engine. All tax rates, brackets, and rules live in database tables — adding a new state or updating brackets requires only a SQL insert/update with no code deployment.

**Processing Pipeline**: `draft → calculated → reviewed → approved → posted → paid`

---

## Architecture Decisions

- **Tax tables in DB**: Seeded via migration, updated annually via new migration files
- **State tax engine**: `calculation_type` enum (`bracket`, `flat_rate`, `none`, `formula`) — new states added as DB rows
- **Supplemental programs** (CA SDI, NY PFL, NJ TDI/FLI, WA PFML): Stored as JSON config in `tax_state_rules.supplemental_programs`
- **Multi-entity**: Employees belong to an organization, assigned to entities. Inter-entity labor creates `intercompany_transactions`
- **Multi-state**: `work_state` tracked per timecard entry. Reciprocity handled via DB config. `ytd_state_wages` JSON on checks
- **Construction-specific**: Prevailing wage rates by state/county/trade, certified payroll (WH-347), union fringe rates, job cost allocation
- **Security**: SSN and bank accounts encrypted with AES-256 (`PAYROLL_ENCRYPTION_KEY`), only last 4 displayed

---

## Database Schema: `turso/migrations/008_payroll.sql`

### Tables (20 total)

**Core Employee**
| Table | Purpose |
|-------|---------|
| `payroll_entity_config` | Per-entity payroll settings (EIN, frequency, GL accounts, workers comp) |
| `entity_state_tax_ids` | State registrations per entity (state EIN, SUTA rate) |
| `employees` | Master employee records (W-4 data, pay type, union/prevailing wage flags) |
| `employee_entity_assignments` | Which entities an employee can work for |
| `employee_pay_rates` | Job/cost-code-specific rates with effective dates |
| `unions` | Union configuration with fringe rates (health, pension, training, dues) |
| `deduction_types` | Pre-tax/post-tax deduction categories (Section 125, 401k, garnishments) |
| `employee_deductions` | Recurring deductions per employee with employer match |
| `employee_direct_deposits` | Bank account info for direct deposit |

**Time & Pay Periods**
| Table | Purpose |
|-------|---------|
| `pay_periods` | Pay period records with status workflow |
| `timecards` | Weekly time entry per employee per pay period |
| `timecard_entries` | Daily detail rows (job, cost code, hours by type, work state, per diem) |

**Tax Engine**
| Table | Purpose |
|-------|---------|
| `tax_federal_brackets` | Federal income tax brackets by year/filing status |
| `tax_federal_standard_deductions` | Standard deductions by year/filing status |
| `tax_federal_limits` | FICA rates, SS wage base, FUTA rate (annual) |
| `tax_state_rules` | Per-state config: calculation type, deductions, supplemental programs JSON |
| `tax_state_brackets` | State income tax brackets |
| `prevailing_wage_rates` | Davis-Bacon rates by state/county/trade/classification |

**Payroll Processing**
| Table | Purpose |
|-------|---------|
| `payroll_runs` | One per pay period per entity (totals, status, workflow timestamps) |
| `payroll_checks` | One per employee per run (full earnings/tax/deduction breakdown + YTD) |
| `payroll_check_lines` | Itemized lines for check stub (earnings, taxes, deductions) |
| `payroll_job_allocations` | Maps check earnings → jobs/cost codes (labor cost routing) |
| `payroll_tax_deposits` | Tax deposit records (941, FUTA, state) with confirmation tracking |
| `w2_records` | Annual W-2 data (all box values) generated from payroll checks |

---

## Tax Engine: `src/lib/payroll/taxEngine.ts`

Pure TypeScript — no DB calls, no HTTP. Inputs typed, outputs typed.

### Federal Income Tax (2020+ W-4 Method)
```
Adjusted Annual Wage = (Gross × PayPeriods) + W4OtherIncome - W4Deductions
Tentative Tax = bracketLookup(AdjustedAnnualWage - StandardDeduction, filingStatus)
Annual Tax = Tentative Tax - W4DependentsAmount
Per-period = max(0, AnnualTax / PayPeriods) + W4ExtraWithholding
```

### FICA
```
SS Employee = min(grossWages, max(0, ssWageBase - ytdSsWages)) × 6.2%
Medicare = grossWages × 1.45%
Additional Medicare = max(0, ytdMedicareWages + gross - $200k) × 0.9% (employee only)
```

### FUTA
```
FUTAWages = min(grossWages, max(0, $7000 - ytdFutaWages))
FUTA = FUTAWages × (6.0% - stateCredit)  → typically 0.6%
```

### State Tax
```
if 'none': return 0 (TX, FL, WA, NV, SD, WY, AK, NH, TN)
if 'flat_rate': taxableWages × flatRate / payPeriods (IL, IN, MI, PA, etc.)
if 'bracket': annualize → deductions → bracket lookup → de-annualize
```

### Supplemental Programs (JSON-driven)
```json
CA: {"SDI": {"rate": 0.009, "wageBase": null, "eeOnly": true}}
NY: {"PFL": {"rate": 0.00126, "wageBase": 89835, "eeOnly": true}}
NJ: {"TDI": {"rate": 0.0009, "wageBase": 161400}, "FLI": {"rate": 0.0006, "wageBase": 161400}}
WA: {"PFML": {"rate": 0.0074, "wageBase": 168600, "eeOnly": false}}
```

---

## API Endpoints

### Employee Management (6 routes)
- `GET/POST /api/payroll/employees` — List + create
- `GET/PUT/DELETE /api/payroll/employees/[id]` — CRUD
- Sub-routes: `/pay-rates`, `/deductions`, `/direct-deposits`, `/ytd`

### Timecards (8 routes)
- `GET/POST /api/payroll/pay-periods` + `[id]`
- `GET/POST /api/payroll/timecards` + `[id]`
- `POST .../[id]/entries`, `PUT/DELETE .../entries/[eid]`
- `POST .../[id]/submit`, `PUT .../[id]/approve`, `PUT .../[id]/reject`

### Payroll Processing (10 routes)
- `GET/POST /api/payroll/runs` + `[id]`
- `POST .../[id]/calculate` — Run tax engine, create checks
- `POST .../[id]/approve` — Owner/admin only
- `POST .../[id]/post` — Create journal entry, post to GL
- `POST .../[id]/void` — Void entire run
- `GET .../[id]/register` — Payroll register
- `GET .../[id]/checks` + `[cid]` — Check detail
- `POST .../[id]/checks/[cid]/void` — Void individual check

### Configuration (8 routes)
- `GET/PUT /api/payroll/config` — Entity payroll config
- `GET/POST /api/payroll/config/state-ids` — State registrations
- `GET/POST/PUT /api/payroll/unions` — Union management
- `GET/POST /api/payroll/deduction-types`

### Tax Configuration (4 routes)
- `GET /api/payroll/tax/federal` — Brackets + limits
- `GET /api/payroll/tax/states` + `[state_code]` — State rules
- `GET/POST /api/payroll/tax/prevailing-wages`

### Reports (12 routes)
- `/api/payroll/reports/register` — Payroll register
- `/api/payroll/reports/941` — Quarterly 941 data
- `/api/payroll/reports/940` — Annual FUTA data
- `/api/payroll/reports/w2` + `/generate` — W-2 records
- `/api/payroll/reports/certified-payroll` — WH-347 data
- `/api/payroll/reports/tax-deposits` — Deposit schedule/history
- `/api/payroll/reports/labor-cost` — By job/cost code
- `/api/payroll/reports/consolidated` — Cross-entity summary
- `/api/payroll/reports/ytd` — YTD per employee

---

## UI Pages

### New Sidebar Category: "Payroll"
- Employees → `/dashboard/payroll/employees`
- Timecards → `/dashboard/payroll/timecards`
- Run Payroll → `/dashboard/payroll/runs`
- Tax Deposits → `/dashboard/payroll/tax-deposits`
- Reports → `/dashboard/payroll/reports`
- Settings → `/dashboard/payroll/settings`

### Key Pages (18 total)
- **Employee list** — searchable table with entity filter
- **New employee** — multi-step form (Personal → Pay Setup → W-4 → State Tax → Deductions → Direct Deposit)
- **Employee detail** — tabs: Overview, Pay Rates, Deductions, Direct Deposit, Time History, YTD
- **Timecards list** — filter by period/employee/job/status, bulk approval
- **Timecard detail** — weekly grid (rows=employees, cols=days, job/cost code/hours per cell)
- **Payroll runs list** — status badges, "Start New Run" button
- **New run** — select period, select employees, preview estimated gross
- **Run detail** — 4 tabs (Summary, Check Register, Job Cost Allocation, Tax Summary) + workflow action buttons
- **Check stub** — printable check stub with earnings/taxes/deductions/YTD
- **Tax deposits** — upcoming deposits, deposit history, schedule deposits
- **Reports index** — 941, 940, W-2, Certified Payroll, Labor Cost, YTD
- **941 page** — Form 941 layout pre-populated from payroll data
- **Certified payroll** — WH-347 format by job/week
- **Labor cost report** — by job/cost code with burden rates
- **Settings** — tabs: General, GL Accounts, State Registrations, Unions, Deduction Types
- **Prevailing wages** — import/manage wage determinations

---

## Integration Points

### Jobs & Cost Codes
- `payroll_job_allocations` links payroll → jobs → cost codes
- WIP report and cost code variance report extended to include payroll labor costs

### GL / Journal Entries
```
DR  Wages Expense              total_gross_wages
DR  Payroll Tax Expense (ER)   total_employer_taxes
CR  Federal Withholding        total_federal_income_tax
CR  FICA EE Payable            total_ss_ee + total_medicare_ee
CR  FICA ER Payable            total_ss_er + total_medicare_er
CR  FUTA Payable               total_futa
CR  SUTA Payable               total_suta
CR  State Withholding          total_state_income_tax
CR  Deductions Payable         total_deductions
CR  Payroll Clearing/Cash      total_net_pay
```

### Multi-Entity
- Inter-entity labor → `intercompany_transactions` records
- Consolidated payroll reports across entities
- Each entity has own payroll config, state registrations, GL mappings

### SiteSense Sync
- Import timecards from SiteSense → `timecards` + `timecard_entries`
- Match employees by `sitesense_sync_id`

---

## Library Files

| File | Purpose |
|------|---------|
| `src/lib/payroll/taxEngine.ts` | Pure tax calculation functions (federal, FICA, FUTA, state, supplemental) |
| `src/lib/payroll/overtimeCalculator.ts` | FLSA 40h/week + CA daily OT (8h=1.5x, 12h=2x) |
| `src/lib/payroll/payrollProcessor.ts` | Orchestrates full payroll run calculation |
| `src/lib/payroll/glPostingEngine.ts` | Creates journal entries from approved runs |
| `src/lib/payroll/certifiedPayrollReport.ts` | WH-347 generation |
| `src/lib/payroll/w2Generator.ts` | Annual W-2 record generation |
| `src/lib/payroll/form941.ts` | Quarterly 941 data generation |
| `src/lib/payroll/prevailingWage.ts` | Davis-Bacon rate lookup |
| `src/lib/payroll/crypto.ts` | AES-256 encrypt/decrypt for SSN and bank accounts |

---

## Build Sequence (7 Phases)

### Phase P1: Foundation
- [ ] Migration `008_payroll.sql` (all 20+ tables)
- [ ] Tax seed data: 2024/2025/2026 federal + all 50 states + DC
- [ ] `taxEngine.ts` with unit tests against IRS Publication 15-T examples
- [ ] `overtimeCalculator.ts` (FLSA + CA daily OT)

### Phase P2: Employee & Config Management
- [ ] Config API routes (entity config, state IDs, unions, deduction types)
- [ ] Employee CRUD API routes (with pay rates, deductions, direct deposits)
- [ ] Settings page (5 tabs)
- [ ] Employee pages (list, new, detail)
- [ ] Add Payroll nav category to DashboardLayout

### Phase P3: Timecards
- [ ] Pay period API routes
- [ ] Timecard CRUD + entries + submit/approve
- [ ] Timecard UI pages (list + weekly grid)
- [ ] SiteSense timecard sync endpoint

### Phase P4: Payroll Processing Engine
- [ ] `payrollProcessor.ts` — full calculation engine
- [ ] `prevailingWage.ts` — rate lookup
- [ ] Payroll run API routes (create, calculate, approve, register, checks)
- [ ] Payroll run UI pages (list, new, detail with 4 tabs, check stub)

### Phase P5: GL Posting & Job Costing
- [ ] `glPostingEngine.ts` — journal entry creation
- [ ] Post/void API routes
- [ ] Extend WIP report with payroll labor
- [ ] Extend cost code variance with payroll labor
- [ ] Labor cost report API + page

### Phase P6: Tax Reports & Compliance
- [ ] `form941.ts`, `w2Generator.ts`, `certifiedPayrollReport.ts`
- [ ] All report API routes (941, 940, W-2, certified payroll, tax deposits, YTD, consolidated)
- [ ] All report UI pages
- [ ] Tax config routes (federal, states, prevailing wages)
- [ ] Prevailing wages settings page

### Phase P7: Year-End & Hardening
- [ ] Year-end close procedure (finalize periods, generate W-2s, reconcile 941)
- [ ] Multi-state reciprocity logic
- [ ] Deposit schedule advisor (semi-weekly vs monthly)
- [ ] New hire reporting data export
- [ ] Audit trail (`payroll_audit_log`)
- [ ] RBAC enforcement review

---

## Contractor Payments (from SiteSense Compliance)

SiteSense tracks contractor compliance. Books Made Easy handles contractor payments:

- **Compliance gate**: Cannot pay contractor if SiteSense compliance status is not `compliant`
- **1099-NEC tracking**: Aggregate payments per contractor per year, flag when over $600 threshold
- **1099 generation**: Year-end report with all box values for 1099-NEC filing
- **Contractor vs Employee**: Clear separation — contractors go through AP (bills), employees go through payroll

### Additional Tables (in payroll migration)
- `contractor_1099_records` — Annual 1099-NEC data per vendor (box values, filing status)

### Additional API Routes
- `GET /api/payroll/reports/1099` — 1099-NEC data by entity/year
- `POST /api/payroll/reports/1099/generate` — Generate from vendor payment history

---

## AWS Migration Notes

- Tax engine (`taxEngine.ts`) is pure TypeScript — no DB dependency, migrates as-is
- All payroll DB queries should use parameterized queries (no SQLite-specific syntax)
- PostgreSQL equivalents to plan for: `datetime('now')` → `NOW()`, `INTEGER` booleans → `BOOLEAN`, `TEXT` JSON → `JSONB`
- The `payroll_entity_config` GL account references will work unchanged since `accounts` table migrates too

---

## Expense Tracker Integration

The Expense Tracker app will sync expenses that may include:
- Employee reimbursements (process through payroll as non-taxable reimbursement)
- Business expenses (post directly to GL via journal entries)
- Per diem validation (compare Expense Tracker per diem claims against payroll per diem records)

---

## Critical Notes

- **Transaction safety**: Payroll calculation wraps all inserts in SQLite transaction — if any employee fails, entire run rolls back
- **FICA mid-period**: Only tax wages up to SS wage base using `min(gross, max(0, base - ytdSsWages))`
- **Multi-state**: Check reciprocity first; if none, withhold for both work and resident state with credit tracking
- **State machine**: Every status transition validated against allowed transitions map; voided runs cannot be un-voided
- **Tax table updates**: Annual process via new migration file; `tax_year` column ensures historical correctness
- **Testing**: Tax engine validated against IRS Publication 15-T worked examples before any production use
