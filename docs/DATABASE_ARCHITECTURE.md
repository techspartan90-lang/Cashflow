# Database Architecture & Financial Data Foundation (Phase 2)
**Project:** CashFlow Intelligence — AI-Powered 30-Day Cash-Flow Forecasting System for Small Businesses  
**Phase:** 2 — Database Schema, Data Model, and Financial Data Foundation  
**Version:** 1.0.0 (Production-Ready)

---

## 1. Database Entity Relationship Overview

The database is built on PostgreSQL with strict relational integrity, UUID primary keys, and multi-tenant isolation anchored to the `organizations` entity.

```
                          +------------------------+
                          |     organizations      |
                          +-----------+------------+
                                      |
       +------------------------------+-------------------------------+
       |             |                |               |               |
       v             v                v               v               v
+--------------+ +---------+    +-----------+   +-----------+  +-------------+
| org_members  | | bank_   |    | customers |   | suppliers |  |  recurring_ |
|              | | accounts|    |           |   |           |  |  cash_flows |
+--------------+ +----+----+    +-----+-----+   +-----+-----+  +-------------+
                      |               |               |
                      v               v               v
             +--------+---------+   +-+-------------+ +-------------+
             |   financial_     |   |   accounts_   | |  accounts_  |
             |  transactions    |   |  receivable   | |   payable   |
             +------------------+   +---------------+ +-------------+
                      |
                      v
             +------------------+   +---------------+  +-------------+
             |   audit_logs     |   | cash_flow_    |  | financial_  |
             | (append-only)    |   | forecasts     |  | alerts      |
             +------------------+   +-------+-------+  +-------------+
                                            |
                                            v
                                    +-------+-------+
                                    | forecast_     |
                                    | assumptions   |
                                    +---------------+
```

---

## 2. Table Descriptions & Schema Specification

| Table | Description | Primary Key | Key Foreign Keys & Constraints |
| :--- | :--- | :--- | :--- |
| `organizations` | Tenant account record defining business profile, base currency, and minimum liquidity threshold. | `id UUID` | `minimum_cash_threshold >= 0`, `currency CHAR(3)` |
| `organization_members` | Role-based tenant membership table linking user UUIDs to organizations. | `id UUID` | `FK -> organizations(id)`, `role IN ('owner','admin','accountant','viewer')`, `UNIQUE(organization_id, user_id)` |
| `bank_accounts` | Depository and credit accounts holding operational cash balances. | `id UUID` | `FK -> organizations(id)`, `currency CHAR(3)` |
| `financial_transactions` | Authoritative ledger of actual inflow and outflow cash movements. | `id UUID` | `FK -> organizations(id)`, `FK -> bank_accounts(id)`, `amount > 0`, `settlement_date >= transaction_date` |
| `customers` | Client entities with historical payment terms and reliability metrics. | `id UUID` | `FK -> organizations(id)`, `reliability_score BETWEEN 0.0 AND 1.0` |
| `accounts_receivable` | Invoices issued to customers awaiting collection. | `id UUID` | `FK -> organizations(id)`, `FK -> customers(id)`, `outstanding_amount <= invoice_amount`, `due_date >= invoice_date` |
| `suppliers` | Vendors and service providers with agreed credit terms. | `id UUID` | `FK -> organizations(id)` |
| `accounts_payable` | Supplier bills and mandatory vendor obligations awaiting settlement. | `id UUID` | `FK -> organizations(id)`, `FK -> suppliers(id)`, `outstanding_amount <= invoice_amount`, `due_date >= invoice_date` |
| `recurring_cash_flows` | Systematic scheduled inflows and outflows (e.g. rent, payroll, software subscriptions). | `id UUID` | `FK -> organizations(id)`, `frequency IN ('daily','weekly','biweekly','monthly','quarterly','annually')`, `end_date >= next_occurrence_date` |
| `cash_flow_forecasts` | Daily projected cash positions across versions and scenarios. | `id UUID` | `FK -> organizations(id)`, `UNIQUE(organization_id, forecast_date, forecast_version)` |
| `forecast_assumptions` | Parameter inputs, DSO coefficients, and drivers underpinning forecast points. | `id UUID` | `FK -> cash_flow_forecasts(id)`, `confidence BETWEEN 0.0 AND 1.0` |
| `forecast_scenarios` | Scenario matrix definitions (expected, optimistic, pessimistic) and scenario weights. | `id UUID` | `FK -> organizations(id)`, `scenario_type IN ('optimistic','expected','pessimistic')` |
| `financial_alerts` | Risk breach notifications, liquidity alerts, and covenant warning events. | `id UUID` | `FK -> organizations(id)`, `severity IN ('low','medium','high','critical')` |
| `audit_logs` | Immutable tamper-evident ledger recording all state mutations. | `id UUID` | `FK -> organizations(id)`. **Protected by trigger blocking UPDATE and DELETE.** |

---

## 3. Financial Terminology & Precision Rules

1. **Decimal-Safe Monetary Storage:**
   - In PostgreSQL: All monetary values are typed as `NUMERIC(15, 2)`. IEEE-754 floating point numbers (`float`, `double precision`) are strictly prohibited in the database schema to eliminate rounding artifacts.
   - In TypeScript calculation service: Operations use fixed-point cents scaling via `MonetaryMath` (`amount * 100` rounded to nearest integer) before performing arithmetic, guaranteeing zero binary floating-point drift.
2. **Net Cash Flow (NCF):**
   $$\text{Net Cash Flow} = \text{Total Inflows} - \text{Total Outflows}$$
3. **Ending Cash Position ($E_t$):**
   $$E_t = E_{t-1} + \text{Inflows}_t - \text{Outflows}_t$$
4. **Liquidity Threshold Breach:**
   Occurs on date $t$ if $E_t < \text{Minimum Cash Threshold}$. Deficit is computed as:
   $$\text{Deficit}_t = \text{Minimum Cash Threshold} - E_t$$
5. **Outstanding Balance Invariant:**
   For all AR and AP records:
   $$0 \le \text{outstanding\_amount} \le \text{invoice\_amount}$$

---

## 4. Transaction Lifecycle State Machine

```
              +-------------------+
              |      pending      |
              +---------+---------+
                        |
            +-----------+-----------+
            |                       |
            v                       v
    +---------------+       +---------------+
    |   completed   |       |   cancelled   |
    +---------------+       +---------------+
```

- **Pending:** Transaction initiated or projected (e.g. pending bank clearance). Does not affect authoritative settled cash balance unless explicitly included in forward simulations.
- **Completed:** Cleared, settled, and reconciled against a bank account. Affects authoritative ending cash.
- **Cancelled:** Voided or refunded. Excluded from all inflow/outflow calculations, preserving audit trail.

---

## 5. Row Level Security (RLS) Strategy & Role Matrix

Row Level Security is enabled on **all 14 tables**. The authenticated user's JWT ID (`auth.uid()`) is cross-referenced with `organization_members` via the security definer function `has_org_role(org_id, allowed_roles)`.

| Role | Organization Settings | Bank Accounts & Transactions | AR & AP | Forecasts & Scenarios | Financial Alerts | Audit Logs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner** | Full (CRUD) | Full (CRUD) | Full (CRUD) | Full (CRUD) | Full (CRUD) | Read-only |
| **Admin** | Read & Update | Full (CRUD) | Full (CRUD) | Full (CRUD) | Full (CRUD) | Read-only |
| **Accountant** | Read-only | Full (CRUD) | Full (CRUD) | Full (CRUD) | Read & Acknowledge | Read-only |
| **Viewer** | Read-only | Read-only | Read-only | Read-only | Read & Acknowledge | Read-only |

### Audit Log Immutability Policy:
The `audit_logs` table has a PostgreSQL trigger `trg_audit_logs_immutable` executing `prevent_audit_log_mutation()`:
```sql
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
```
Any attempt to update or delete audit log entries raises an exception, ensuring an immutable trail for SOC-2 and financial compliance.

---

## 6. Migration Instructions

The schema and security policies are split into sequential, version-controlled SQL migrations located in `/supabase/migrations/`:

1. **Migration 1 — Core Schema & Constraints:**
   - File: `supabase/migrations/20260923000001_initial_financial_schema.sql`
   - Purpose: Creates all 14 tables, updated_at triggers, check constraints, and performance indexes.
2. **Migration 2 — Row Level Security & Audit Triggers:**
   - File: `supabase/migrations/20260923000002_rls_and_audit_policies.sql`
   - Purpose: Enables RLS across all tables, creates security helper functions, establishes tenant isolation policies, and activates immutable audit triggers.

### Running Migrations in Supabase:
- **Option A (Supabase CLI):**
  ```bash
  supabase db push
  # or
  supabase migration up
  ```
- **Option B (Supabase Dashboard SQL Editor):**
  Execute `20260923000001_initial_financial_schema.sql` followed by `20260923000002_rls_and_audit_policies.sql`.

---

## 7. Environment Variables

Create `.env.local` based on `.env.example`:
```ini
# Supabase Project URL (Public)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co

# Supabase Anonymous Public Key (Safe for browser client)
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# Supabase Service Role Secret Key (Backend/Server only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

---

## 8. Testing Instructions

Run the automated test suite using `vitest`:
```bash
npm run test
```
The test suite covers:
- Zero, positive, negative, and mixed inflow/outflow arithmetic without float drift.
- Beginning cash, net cash flow, and ending cash progression.
- Minimum liquidity threshold breach detection and deficit accounting.
- Overdue accounts receivable and payable identification with partial payment logic.
- Input validation schemas for all 8 required financial payload types.
- Multi-row duplicate detection via deterministic transaction fingerprinting.

---

## 9. Known Limitations & Future Phase 3 Integration Points

1. **Direct Bank Aggregation:** Bank feeds (Plaid, Open Banking, Finicity) are modeled via the `bank_integration` enum value and duplicate fingerprinting strategy, but live webhook listeners will be deployed in a future integration phase.
2. **AI Forecasting Trigger:** Deterministic financial calculations are implemented in `FinancialCalculatorService`; the AI forecasting layer (`gemini-3.5-flash` / `gemini-3.1-pro-preview`) will consume the output of this service in Phase 3.
3. **Multi-Currency FX Rates:** Base currency is defined per organization (`INR`, `USD`, `EUR`). Cross-currency transaction conversion rates will be introduced when multi-currency bank accounts are linked.
