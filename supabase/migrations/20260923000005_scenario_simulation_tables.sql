-- Migration: 20260923000005_scenario_simulation_tables.sql
-- Phase 6: Scenario Simulation, Sensitivity Analysis, and Financial Decision Support

-- 1. Scenarios Table
CREATE TABLE IF NOT EXISTS public.scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    base_forecast_id TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    scenario_type VARCHAR(50) NOT NULL DEFAULT 'custom' CHECK (scenario_type IN (
        'revenue_change',
        'customer_payment_delay',
        'expense_change',
        'unexpected_expense',
        'new_business_commitment',
        'custom'
    )),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',
        'calculating',
        'completed',
        'failed',
        'archived'
    )),
    result_status VARCHAR(50) NOT NULL DEFAULT 'none' CHECK (result_status IN (
        'none',
        'fresh',
        'stale'
    )),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_org ON public.scenarios(organization_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_base_fc ON public.scenarios(base_forecast_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_status ON public.scenarios(status);

-- 2. Scenario Assumptions Table
CREATE TABLE IF NOT EXISTS public.scenario_assumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    assumption_type VARCHAR(50) NOT NULL CHECK (assumption_type IN (
        'revenue_adjustment',
        'customer_delay',
        'expense_adjustment',
        'one_time_expense',
        'new_commitment',
        'custom'
    )),
    target_type VARCHAR(50) NOT NULL DEFAULT 'all' CHECK (target_type IN (
        'all',
        'category',
        'customer',
        'supplier',
        'invoice',
        'recurring_flow'
    )),
    target_id TEXT,
    adjustment_method VARCHAR(50) NOT NULL CHECK (adjustment_method IN (
        'percentage_change',
        'absolute_change',
        'date_shift',
        'collection_rate_change',
        'one_time_event',
        'recurring_event'
    )),
    adjustment_value NUMERIC(15, 4) NOT NULL,
    start_date DATE,
    end_date DATE,
    description TEXT NOT NULL,
    source TEXT DEFAULT 'user_defined',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenario_assumptions_scenario ON public.scenario_assumptions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_assumptions_org ON public.scenario_assumptions(organization_id);

-- 3. Scenario Results Table
CREATE TABLE IF NOT EXISTS public.scenario_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    day_index INTEGER NOT NULL CHECK (day_index >= 0 AND day_index < 365),
    forecast_date DATE NOT NULL,
    beginning_cash NUMERIC(15, 2) NOT NULL,
    scenario_inflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    scenario_outflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    net_cash_flow NUMERIC(15, 2) NOT NULL,
    ending_cash NUMERIC(15, 2) NOT NULL,
    threshold_status VARCHAR(50) NOT NULL DEFAULT 'above_threshold' CHECK (threshold_status IN (
        'above_threshold',
        'approaching_threshold',
        'below_threshold'
    )),
    shortfall_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    base_ending_cash NUMERIC(15, 2) NOT NULL,
    cash_delta NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_scenario_day UNIQUE (scenario_id, day_index)
);

CREATE INDEX IF NOT EXISTS idx_scenario_results_scenario ON public.scenario_results(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_results_date ON public.scenario_results(forecast_date);

-- 4. Scenario Result Line Items
CREATE TABLE IF NOT EXISTS public.scenario_result_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_result_id UUID NOT NULL REFERENCES public.scenario_results(id) ON DELETE CASCADE,
    scenario_id UUID NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    flow_type VARCHAR(20) NOT NULL CHECK (flow_type IN ('inflow', 'outflow')),
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN (
        'base_item',
        'adjusted_item',
        'simulated_event',
        'delayed_receivable'
    )),
    source_id TEXT,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    base_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    amount NUMERIC(15, 2) NOT NULL,
    adjustment_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    adjustment_reason TEXT,
    certainty VARCHAR(20) NOT NULL DEFAULT 'SIMULATED' CHECK (certainty IN (
        'CONFIRMED',
        'EXPECTED',
        'ASSUMED',
        'SIMULATED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenario_result_items_res ON public.scenario_result_items(scenario_result_id);
CREATE INDEX IF NOT EXISTS idx_scenario_result_items_date ON public.scenario_result_items(scheduled_date);

-- 5. Row-Level Security
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_result_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scenarios_tenant_isolation" ON public.scenarios
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "scenario_assumptions_tenant_isolation" ON public.scenario_assumptions
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "scenario_results_tenant_isolation" ON public.scenario_results
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "scenario_result_items_tenant_isolation" ON public.scenario_result_items
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );
