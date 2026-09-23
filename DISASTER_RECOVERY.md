# Disaster Recovery & Business Continuity Plan

## 1. Objectives & Metrics
- **Recovery Point Objective (RPO):** Maximum acceptable data loss window is **1 hour** for automated point-in-time recovery (PITR) and daily automated database snapshots.
- **Recovery Time Objective (RTO):** Maximum acceptable downtime to restore full operational service is **2 hours**.

---

## 2. Backup Architecture & Policies
1. **Supabase Managed Automated Backups:**
   - Daily automated logical backups retained for 30 rolling days.
   - Continuous WAL (Write-Ahead Logging) archiving enabling Point-In-Time Recovery (PITR) up to the second.
2. **Immutable Audit Logs:**
   - Audit trail records in `audit_logs` are protected by database triggers that reject `UPDATE` and `DELETE` queries.
   - In disaster investigation, all state modifications prior to incident timestamp are forensically intact.
3. **Application Configuration & Code:**
   - Versioned in Git repository.
   - Environment variables documented in `.env.example` and backed up securely in production secret management (e.g. Google Cloud Secret Manager / AWS Secrets Manager).

---

## 3. Disaster Scenarios & Recovery Procedures

### Scenario A: Accidental Data Corruption or Erroneous Migration
1. Freeze application traffic by routing `/api/*` to maintenance response mode.
2. Access Supabase Management Console -> Database -> Backups.
3. Identify the last known good transaction timestamp prior to corruption.
4. Execute Point-in-Time Recovery to a restored instance or point in time.
5. Verify Row Level Security (RLS) policies and execute validation test suite.
6. Re-route live traffic.

### Scenario B: AI Microservice Outage or Network Failure
1. If the Python FastAPI service becomes unreachable, the forecasting system **automatically engages the deterministic financial calculation baseline**.
2. No user requests fail or return 500; the UI clearly displays "Deterministic Baseline Mode" with full 30-day mathematical projection.
3. AI deep advisory returns graceful fallback messages without hallucinating predictions.

### Scenario C: Cloud Region Failure
1. Spin up Docker containers in backup secondary region (e.g., Cloud Run or AWS ECS).
2. Point environment variables to the multi-region read-replica or promoted Supabase primary.
3. Verify `/health` and `/ready` probes return 200 OK.
4. Update DNS records (Route53 / Cloudflare) to failover to the secondary region endpoint.
