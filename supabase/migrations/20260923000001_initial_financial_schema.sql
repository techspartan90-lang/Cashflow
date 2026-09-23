-- ==============================================================================
-- MIGRATION: 20260923000001_initial_financial_schema.sql
-- DESCRIPTION: Initial production schema for CashFlow Intelligence
-- PHASE: 2 — Database Schema, Data Model, and Financial Data Foundation
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. UTILITY FUNCTIONS & TRIGGERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. TABLE DEFINITIONS
-- ==============================================================================

-- A. organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  business_type TEXT NOT NULL CHECK (char_length(trim(business_type)) > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (char_length(currency) = 3),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  minimum_cash_threshold NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (minimum_cash_threshold >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- B. organization_members
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_organization_member UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- C. bank_accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL CHECK (char_length(trim(account_name)) > 0),
  account_type TEXT NOT NULL CHECK (char_length(trim(account_type)) > 0),
  opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL CHECK (char_length(currency) = 3),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_org ON bank_accounts(organization_id);
CREATE TRIGGER update_bank_accounts_updated_at
BEFORE UPDATE ON bank_accounts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- D. financial_transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('inflow', 'outflow')),
  category TEXT NOT NULL CHECK (char_length(trim(category)) > 0),
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0.00),
  transaction_date DATE NOT NULL,
  settlement_date DATE,
  counterparty TEXT NOT NULL CHECK (char_length(trim(counterparty)) > 0),
  reference_number TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv_import', 'bank_integration', 'system_generated')),
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_transaction_settlement_date CHECK (settlement_date IS NULL OR settlement_date >= transaction_date)
);

CREATE INDEX IF NOT EXISTS idx_transactions_org_date ON financial_transactions(organization_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_bank_acc ON financial_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON financial_transactions(organization_id, transaction_type, status);
CREATE TRIGGER update_financial_transactions_updated_at
BEFORE UPDATE ON financial_transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- E. customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  email TEXT,
  payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  average_payment_delay_days NUMERIC(6, 2) NOT NULL DEFAULT 0.00 CHECK (average_payment_delay_days >= -365 AND average_payment_delay_days <= 365),
  reliability_score NUMERIC(4, 2) NOT NULL DEFAULT 1.00 CHECK (reliability_score >= 0.00 AND reliability_score <= 1.00),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- F. accounts_receivable
CREATE TABLE IF NOT EXISTS accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL CHECK (char_length(trim(invoice_number)) > 0),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  invoice_amount NUMERIC(15, 2) NOT NULL CHECK (invoice_amount > 0.00),
  outstanding_amount NUMERIC(15, 2) NOT NULL CHECK (outstanding_amount >= 0.00),
  expected_collection_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ar_due_date CHECK (due_date >= invoice_date),
  CONSTRAINT chk_ar_outstanding_le_invoice CHECK (outstanding_amount <= invoice_amount),
  CONSTRAINT uq_ar_org_invoice UNIQUE (organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_ar_org_status_due ON accounts_receivable(organization_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_ar_customer ON accounts_receivable(customer_id);
CREATE TRIGGER update_accounts_receivable_updated_at
BEFORE UPDATE ON accounts_receivable
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- G. suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  average_payment_delay_days NUMERIC(6, 2) NOT NULL DEFAULT 0.00 CHECK (average_payment_delay_days >= -365 AND average_payment_delay_days <= 365),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- H. accounts_payable
CREATE TABLE IF NOT EXISTS accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL CHECK (char_length(trim(invoice_number)) > 0),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  invoice_amount NUMERIC(15, 2) NOT NULL CHECK (invoice_amount > 0.00),
  outstanding_amount NUMERIC(15, 2) NOT NULL CHECK (outstanding_amount >= 0.00),
  expected_payment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ap_due_date CHECK (due_date >= invoice_date),
  CONSTRAINT chk_ap_outstanding_le_invoice CHECK (outstanding_amount <= invoice_amount),
  CONSTRAINT uq_ap_org_invoice UNIQUE (organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_ap_org_status_due ON accounts_payable(organization_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_ap_supplier ON accounts_payable(supplier_id);
CREATE TRIGGER update_accounts_payable_updated_at
BEFORE UPDATE ON accounts_payable
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- I. recurring_cash_flows
CREATE TABLE IF NOT EXISTS recurring_cash_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  flow_type TEXT NOT NULL CHECK (flow_type IN ('inflow', 'outflow')),
  category TEXT NOT NULL CHECK (char_length(trim(category)) > 0),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0.00),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
  next_occurrence_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_recurring_end_date CHECK (end_date IS NULL OR end_date >= next_occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_recurring_org_active ON recurring_cash_flows(organization_id, is_active, next_occurrence_date);
CREATE TRIGGER update_recurring_cash_flows_updated_at
BEFORE UPDATE ON recurring_cash_flows
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- J. cash_flow_forecasts
CREATE TABLE IF NOT EXISTS cash_flow_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  forecast_version TEXT NOT NULL CHECK (char_length(trim(forecast_version)) > 0),
  beginning_cash NUMERIC(15, 2) NOT NULL,
  predicted_inflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  predicted_outflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  predicted_net_cash_flow NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  predicted_ending_cash NUMERIC(15, 2) NOT NULL,
  minimum_cash_threshold NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (minimum_cash_threshold >= 0),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_forecast_org_date_version UNIQUE (organization_id, forecast_date, forecast_version)
);

CREATE INDEX IF NOT EXISTS idx_forecasts_org_version_date ON cash_flow_forecasts(organization_id, forecast_version, forecast_date);

-- K. forecast_assumptions
CREATE TABLE IF NOT EXISTS forecast_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id UUID NOT NULL REFERENCES cash_flow_forecasts(id) ON DELETE CASCADE,
  assumption_type TEXT NOT NULL CHECK (char_length(trim(assumption_type)) > 0),
  description TEXT NOT NULL,
  value JSONB NOT NULL,
  source TEXT NOT NULL CHECK (char_length(trim(source)) > 0),
  confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0.00 AND confidence <= 1.00),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assumptions_forecast ON forecast_assumptions(forecast_id);

-- L. forecast_scenarios
CREATE TABLE IF NOT EXISTS forecast_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  forecast_version TEXT NOT NULL CHECK (char_length(trim(forecast_version)) > 0),
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('optimistic', 'expected', 'pessimistic')),
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_org_version ON forecast_scenarios(organization_id, forecast_version);

-- M. financial_alerts
CREATE TABLE IF NOT EXISTS financial_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (char_length(trim(alert_type)) > 0),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  description TEXT NOT NULL,
  related_date DATE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_org_read ON financial_alerts(organization_id, is_read, created_at);

-- N. audit_logs (append-only ledger)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL CHECK (char_length(trim(action)) > 0),
  entity_type TEXT NOT NULL CHECK (char_length(trim(entity_type)) > 0),
  entity_id UUID NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_entity ON audit_logs(organization_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(organization_id, created_at DESC);
