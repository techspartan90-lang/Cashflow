-- Migration: 20260923000004_forecast_engine_tables.sql
-- Description: Deterministic 30-Day Forecast Runs, Daily Projections, Forecast Items, and Explanations
-- Phase 4: Deterministic 30-Day Cash-Flow Forecasting Engine

-- 1. forecast_runs (stores each executed forecast generation run with audit versioning)
CREATE TABLE IF NOT EXISTS public.forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  forecast_version INTEGER NOT NULL CHECK (forecast_version > 0),
  scenario_type TEXT NOT NULL DEFAULT 'expected' CHECK (scenario_type IN ('expected', 'optimistic', 'pessimistic')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  horizon_days INTEGER NOT NULL DEFAULT 30 CHECK (horizon_days > 0),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  opening_cash NUMERIC(15, 2) NOT NULL,
  minimum_cash_threshold NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (minimum_cash_threshold >= 0),
  total_expected_inflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total_expected_outflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  net_cash_flow NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  minimum_projected_cash NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  shortfall_days INTEGER NOT NULL DEFAULT 0 CHECK (shortfall_days >= 0),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  assumptions_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculation_status TEXT NOT NULL DEFAULT 'completed' CHECK (calculation_status IN ('pending', 'completed', 'failed', 'stale')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_forecast_org_version_scenario UNIQUE (organization_id, forecast_version, scenario_type),
  CONSTRAINT chk_forecast_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_org_ver ON public.forecast_runs(organization_id, forecast_version DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_runs_date ON public.forecast_runs(organization_id, start_date);

-- 2. forecast_daily_projections (stores daily rolled cash position per forecast run)
CREATE TABLE IF NOT EXISTS public.forecast_daily_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_run_id UUID NOT NULL REFERENCES public.forecast_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL CHECK (day_index >= 0 AND day_index < 365),
  projection_date DATE NOT NULL,
  beginning_cash NUMERIC(15, 2) NOT NULL,
  expected_inflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  expected_outflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  net_cash_flow NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  ending_cash NUMERIC(15, 2) NOT NULL,
  minimum_threshold NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  threshold_status TEXT NOT NULL DEFAULT 'above_threshold' CHECK (threshold_status IN ('above_threshold', 'approaching_threshold', 'below_threshold')),
  shortfall_deficit NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (shortfall_deficit >= 0.00),
  risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_daily_run_date UNIQUE (forecast_run_id, projection_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_proj_run_date ON public.forecast_daily_projections(forecast_run_id, projection_date);
CREATE INDEX IF NOT EXISTS idx_daily_proj_org_date ON public.forecast_daily_projections(organization_id, projection_date);

-- 3. forecast_items (granular auditable line items contributing to inflows/outflows)
CREATE TABLE IF NOT EXISTS public.forecast_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_run_id UUID NOT NULL REFERENCES public.forecast_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('inflow', 'outflow')),
  category TEXT NOT NULL CHECK (char_length(trim(category)) > 0),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0.00),
  source TEXT NOT NULL CHECK (source IN ('accounts_receivable', 'accounts_payable', 'recurring_cash_flow', 'future_transaction', 'assumption')),
  description TEXT NOT NULL,
  certainty TEXT NOT NULL DEFAULT 'EXPECTED' CHECK (certainty IN ('CONFIRMED', 'EXPECTED', 'ASSUMED')),
  entity_id UUID,
  scheduling_method TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_forecast_items_run_date ON public.forecast_items(forecast_run_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_forecast_items_source ON public.forecast_items(organization_id, source);

-- Enable Row Level Security
ALTER TABLE public.forecast_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_daily_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_items ENABLE ROW LEVEL SECURITY;

-- RLS: Tenant Isolation Policies
CREATE POLICY "Users can read forecast runs of their organizations"
  ON public.forecast_runs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Privileged members can create forecast runs"
  ON public.forecast_runs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'accountant')
    )
  );

CREATE POLICY "Users can read daily projections of their organizations"
  ON public.forecast_daily_projections FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read forecast items of their organizations"
  ON public.forecast_items FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations
      WHERE user_id = auth.uid()
    )
  );
