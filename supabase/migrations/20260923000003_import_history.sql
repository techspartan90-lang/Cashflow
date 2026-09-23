-- ==============================================================================
-- MIGRATION: 20260923000003_import_history.sql
-- DESCRIPTION: Import History Ledger and Ingestion Tracking
-- PHASE: 3 — Transaction Import, Data Processing, and Financial Data Quality
-- ==============================================================================

CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID,
  file_name TEXT NOT NULL CHECK (char_length(trim(file_name)) > 0),
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  import_type TEXT NOT NULL CHECK (import_type IN ('transactions', 'accounts_receivable', 'accounts_payable')),
  upload_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_rows INTEGER NOT NULL CHECK (total_rows >= 0),
  imported_rows INTEGER NOT NULL CHECK (imported_rows >= 0),
  rejected_rows INTEGER NOT NULL CHECK (rejected_rows >= 0),
  duplicate_rows INTEGER NOT NULL CHECK (duplicate_rows >= 0),
  warning_rows INTEGER NOT NULL DEFAULT 0 CHECK (warning_rows >= 0),
  total_inflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_outflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  net_cash_flow NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (
    status IN (
      'uploaded',
      'validating',
      'awaiting_confirmation',
      'processing',
      'completed',
      'partially_completed',
      'failed',
      'cancelled'
    )
  ),
  error_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_history_org_time ON import_history(organization_id, upload_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_import_history_status ON import_history(organization_id, status);

-- Enable Row Level Security
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

-- RLS: Tenant isolation — members of organization can view import history
CREATE POLICY "import_history_select" ON import_history
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

-- RLS: Admins and accountants can insert or modify import records
CREATE POLICY "import_history_modify" ON import_history
  FOR ALL
  USING (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']));
