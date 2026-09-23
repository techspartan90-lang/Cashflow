-- ==============================================================================
-- MIGRATION: 20260923000002_rls_and_audit_policies.sql
-- DESCRIPTION: Row Level Security (RLS) policies and immutable audit triggers
-- PHASE: 2 — Database Schema, Data Model, and Financial Data Foundation
-- ==============================================================================

-- ==============================================================================
-- 1. HELPER SECURITY FUNCTIONS
-- ==============================================================================

-- Safely get authenticated user ID from Supabase auth.uid()
CREATE OR REPLACE FUNCTION current_auth_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user is an active member of organization with specific role(s)
CREATE OR REPLACE FUNCTION has_org_role(target_org_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_has_role BOOLEAN;
BEGIN
  v_user_id := current_auth_user_id();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = target_org_id
      AND user_id = v_user_id
      AND role = ANY(allowed_roles)
  ) INTO v_has_role;

  RETURN v_has_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get all organization IDs current user has membership in
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := current_auth_user_id();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT organization_id
  FROM organization_members
  WHERE user_id = v_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ==============================================================================
-- 2. IMMUTABLE AUDIT LOG PROTECTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. Updates and deletions are strictly prohibited for financial compliance.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- ==============================================================================
-- 3. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ==============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_cash_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ==============================================================================

-- A. organizations
-- Select: user is a member of the organization
CREATE POLICY "org_select_members" ON organizations
  FOR SELECT
  USING (id IN (SELECT get_user_org_ids()));

-- Insert: any authenticated user can create an organization (they become owner)
CREATE POLICY "org_insert_authenticated" ON organizations
  FOR INSERT
  WITH CHECK (current_auth_user_id() IS NOT NULL);

-- Update: only owners and admins can update organization settings
CREATE POLICY "org_update_admins" ON organizations
  FOR UPDATE
  USING (has_org_role(id, ARRAY['owner', 'admin']))
  WITH CHECK (has_org_role(id, ARRAY['owner', 'admin']));

-- Delete: only owners can delete an organization
CREATE POLICY "org_delete_owners" ON organizations
  FOR DELETE
  USING (has_org_role(id, ARRAY['owner']));

-- B. organization_members
-- Select: members can view their organization's roster
CREATE POLICY "org_members_select" ON organization_members
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

-- Insert/Update/Delete: owners and admins manage membership
CREATE POLICY "org_members_insert_admins" ON organization_members
  FOR INSERT
  WITH CHECK (
    has_org_role(organization_id, ARRAY['owner', 'admin'])
    OR (user_id = current_auth_user_id() AND role = 'owner') -- bootstrap first owner
  );

CREATE POLICY "org_members_update_admins" ON organization_members
  FOR UPDATE
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "org_members_delete_admins" ON organization_members
  FOR DELETE
  USING (has_org_role(organization_id, ARRAY['owner', 'admin']));

-- C. bank_accounts
CREATE POLICY "bank_accounts_select" ON bank_accounts
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "bank_accounts_modify" ON bank_accounts
  FOR ALL
  USING (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']));

-- D. financial_transactions
CREATE POLICY "transactions_select" ON financial_transactions
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "transactions_modify" ON financial_transactions
  FOR ALL
  USING (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']));

-- E. customers
CREATE POLICY "customers_select" ON customers
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "customers_modify" ON customers
  FOR ALL
  USING (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']));

-- F. accounts_receivable
CREATE POLICY "ar_select" ON accounts_receivable
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "ar_modify" ON accounts_receivable
  FOR ALL
  USING (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']));

-- G. suppliers
CREATE POLICY "suppliers_select" ON suppliers
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "suppliers_modify" ON suppliers
  FOR ALL
  USING (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']));

-- H. accounts_payable
CREATE POLICY "ap_select" ON accounts_payable
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "ap_modify" ON accounts_payable
  FOR ALL
  USING (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']));

-- I. recurring_cash_flows
CREATE POLICY "recurring_select" ON recurring_cash_flows
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "recurring_modify" ON recurring_cash_flows
  FOR ALL
  USING (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']));

-- J. cash_flow_forecasts
CREATE POLICY "forecasts_select" ON cash_flow_forecasts
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "forecasts_modify" ON cash_flow_forecasts
  FOR ALL
  USING (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']));

-- K. forecast_assumptions
CREATE POLICY "assumptions_select" ON forecast_assumptions
  FOR SELECT
  USING (
    forecast_id IN (
      SELECT id FROM cash_flow_forecasts WHERE organization_id IN (SELECT get_user_org_ids())
    )
  );

CREATE POLICY "assumptions_modify" ON forecast_assumptions
  FOR ALL
  USING (
    forecast_id IN (
      SELECT id FROM cash_flow_forecasts
      WHERE has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant'])
    )
  )
  WITH CHECK (
    forecast_id IN (
      SELECT id FROM cash_flow_forecasts
      WHERE has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant'])
    )
  );

-- L. forecast_scenarios
CREATE POLICY "scenarios_select" ON forecast_scenarios
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "scenarios_modify" ON forecast_scenarios
  FOR ALL
  USING (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']))
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']));

-- M. financial_alerts
CREATE POLICY "alerts_select" ON financial_alerts
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

-- All members can update alert read/resolved status
CREATE POLICY "alerts_update_members" ON financial_alerts
  FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

-- Admins and system can insert alerts
CREATE POLICY "alerts_insert" ON financial_alerts
  FOR INSERT
  WITH CHECK (has_org_role(organization_id, ARRAY['owner', 'admin', 'accountant']));

-- N. audit_logs
-- Only organization members can read audit logs
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

-- Any authenticated member can insert audit logs for their org
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));
