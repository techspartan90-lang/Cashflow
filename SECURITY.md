# Security Architecture & Policies: CashFlow Intelligence System

## 1. Executive Summary & Security Posture
The **AI-Powered 30-Day Cash-Flow Forecasting System** is engineered under a strict **Zero-Trust, Security-by-Default** paradigm designed for sensitive corporate and small-business financial data. It treats all client-side requests, uploaded CSV files, and third-party integrations as untrusted inputs.

---

## 2. Authentication & Server-Side Authorization (RBAC)

### 2.1 Identity Verification
- Authentication is governed by **Supabase Auth** utilizing industry-standard JSON Web Tokens (JWT) signed with HMAC-SHA256 / Asymmetric keys.
- Client identity is extracted strictly from the cryptographic `sub` claim inside verified Bearer tokens on the server-side.
- **Client parameters (`organization_id`, `role`, `user_id`) in request bodies are NEVER trusted.**

### 2.2 Role-Based Access Control (RBAC)
The platform enforces 5 granular roles verified at the database Row Level Security (RLS) layer and backend middleware:

| Role | Financial Ledger Read | Financial Ledger Write | Forecast Generation | Scenario Modeling | Manage Team / Settings |
|---|:---:|:---:|:---:|:---:|:---:|
| **Organization Owner** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Administrator** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Finance Manager** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Analyst** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Viewer** | ✅ | ❌ | ❌ (View only) | ❌ (View only) | ❌ |

---

## 3. Multi-Tenant Database Isolation & Row Level Security (RLS)

- **PostgreSQL Row Level Security (RLS)** is enabled on all tables: `organizations`, `organization_members`, `bank_accounts`, `financial_transactions`, `accounts_receivable`, `accounts_payable`, `recurring_cash_flows`, `forecasts`, `scenarios`, `financial_alerts`, and `audit_logs`.
- Multi-tenant tenant boundaries are enforced using `auth.uid() IN (SELECT user_id FROM organization_members WHERE organization_id = table.organization_id)`.
- Direct table modifications bypass are restricted solely to the server-side service-role key; the public anonymous key cannot execute unauthorized `INSERT`, `UPDATE`, or `DELETE`.
- **Append-Only Immutability:** The `audit_logs` table has database triggers blocking `UPDATE` and `DELETE` operations, ensuring an unalterable forensic audit trail.

---

## 4. Application Hardening & Attack Mitigations

### 4.1 OWASP Secure Headers
Mounted via `src/server/security-middleware.ts`:
- `X-Content-Type-Options: nosniff` (MIME sniffing prevention)
- `X-Frame-Options: DENY` (Clickjacking mitigation)
- `X-XSS-Protection: 1; mode=block` (Browser cross-site scripting filter)
- `Referrer-Policy: strict-origin-when-cross-origin` (Information leakage mitigation)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` (Device boundary restrictions)
- `Content-Security-Policy: default-src 'self' ...` (Strict asset origin enforcement)

### 4.2 Sliding Window Rate Limiting
- IP-based sliding window rate limiter protects `/api/*` endpoints from denial-of-service and brute-force attacks.
- Default limit: 300 requests per 60 seconds per IP, returning HTTP 429 when breached with `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers.

### 4.3 CSV & Spreadsheet Formula Injection Protection
- Ingestion parsers and CSV export routines employ formula sanitation:
  Any field beginning with `= `, `+`, `-`, `@`, `|`, `%`, or tab characters is sanitized by prepending a single quote (`'`), neutralizing dynamic formula execution in Microsoft Excel, Google Sheets, or LibreOffice Calc.

---

## 5. Financial Calculation Integrity & Non-Destruction

1. **Integer Cents Fixed-Point Math (`MonetaryMath`):**  
   IEEE-754 floating-point numbers are strictly converted to integer cents before addition, subtraction, multiplication, and division, eliminating rounding drift ($0.1 + 0.2 \equiv 0.30$).
2. **Immutable Separation of Financial Realities:**  
   Actual cleared bank transactions, confirmed AR/AP invoices, deterministic forecast projections, and simulated scenarios reside in separate, isolated schemas. Scenario simulations never mutate historical ledger records.
