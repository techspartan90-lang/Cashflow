-- Migration: 20260923000006_alerts_variance_recommendations.sql
-- Phase 7: Alerts, Recommendations, Variance Monitoring, and Automated Forecast Monitoring

-- 1. Alert Rules Table (Configurable organization-level thresholds)
CREATE TABLE IF NOT EXISTS public.alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'cash_shortfall',
        'negative_cash',
        'approaching_threshold',
        'overdue_receivable',
        'overdue_payable',
        'large_outflow',
        'forecast_deviation',
        'data_quality_warning'
    )),
    threshold_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    threshold_method VARCHAR(50) NOT NULL DEFAULT 'absolute_value' CHECK (threshold_method IN (
        'absolute_value',
        'percentage_buffer',
        'days_overdue',
        'standard_deviations'
    )),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_alert_type UNIQUE (organization_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON public.alert_rules(organization_id);

-- 2. Enhanced Financial Alerts Table
-- Note: Extends base columns if table existed, or creates fully structured schema
ALTER TABLE public.financial_alerts ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'acknowledged',
    'resolved',
    'dismissed',
    'expired'
));

ALTER TABLE public.financial_alerts ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE public.financial_alerts ADD COLUMN IF NOT EXISTS related_entity_type VARCHAR(50);
ALTER TABLE public.financial_alerts ADD COLUMN IF NOT EXISTS related_entity_id TEXT;
ALTER TABLE public.financial_alerts ADD COLUMN IF NOT EXISTS forecast_id TEXT;
ALTER TABLE public.financial_alerts ADD COLUMN IF NOT EXISTS trigger_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.financial_alerts ADD COLUMN IF NOT EXISTS recommended_review_action TEXT;
ALTER TABLE public.financial_alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.financial_alerts ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
ALTER TABLE public.financial_alerts ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ;
ALTER TABLE public.financial_alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_alerts_fingerprint ON public.financial_alerts(organization_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_alerts_status_severity ON public.financial_alerts(organization_id, status, severity);

-- 3. Alert Events (Audit Trail for Status Changes & Reactivations)
CREATE TABLE IF NOT EXISTS public.alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES public.financial_alerts(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'created',
        'acknowledged',
        'resolved',
        'dismissed',
        'reactivated',
        'threshold_updated'
    )),
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    user_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_alert ON public.alert_events(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_org ON public.alert_events(organization_id, created_at DESC);

-- 4. Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    minimum_severity VARCHAR(50) NOT NULL DEFAULT 'informational' CHECK (minimum_severity IN (
        'informational',
        'warning',
        'critical'
    )),
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_org_alert_pref UNIQUE (organization_id, user_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON public.notification_preferences(organization_id, user_id);

-- 5. Forecast Variances (Historical Tracking of Forecast vs Actual Outcomes)
CREATE TABLE IF NOT EXISTS public.forecast_variances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    forecast_id TEXT NOT NULL,
    forecast_date DATE NOT NULL,
    forecast_inflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    actual_inflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    forecast_outflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    actual_outflows NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    forecast_net_cash_flow NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    actual_net_cash_flow NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    forecast_ending_cash NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    actual_ending_cash NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    absolute_variance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    signed_variance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_material_deviation BOOLEAN NOT NULL DEFAULT FALSE,
    category_variances JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_forecast_date UNIQUE (organization_id, forecast_id, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_variances_org_date ON public.forecast_variances(organization_id, forecast_date DESC);
CREATE INDEX IF NOT EXISTS idx_variances_material ON public.forecast_variances(organization_id, is_material_deviation);

-- 6. Actionable Recommendations Table
CREATE TABLE IF NOT EXISTS public.actionable_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN (
        'review_overdue_receivables',
        'stagger_large_outflows',
        'adjust_recurring_obligations',
        'calibrate_minimum_threshold',
        'investigate_forecast_deviation',
        'simulate_delayed_collections'
    )),
    title TEXT NOT NULL,
    rationale TEXT NOT NULL,
    evidence_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    related_alert_id UUID REFERENCES public.financial_alerts(id) ON DELETE SET NULL,
    related_entity_type VARCHAR(50),
    related_entity_id TEXT,
    projected_impact_amount NUMERIC(15, 2),
    urgency VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'applied', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_org ON public.actionable_recommendations(organization_id, status);

-- 7. Automated Forecast Refresh Lock & Monitoring Status
CREATE TABLE IF NOT EXISTS public.monitoring_job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('alert_evaluation', 'variance_calculation', 'forecast_refresh', 'full_monitoring')),
    trigger_source VARCHAR(50) NOT NULL CHECK (trigger_source IN ('manual', 'scheduled', 'transaction_imported', 'material_deviation', 'overdue_invoice')),
    status VARCHAR(50) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    alerts_evaluated INTEGER NOT NULL DEFAULT 0,
    alerts_raised INTEGER NOT NULL DEFAULT 0,
    variances_recorded INTEGER NOT NULL DEFAULT 0,
    execution_time_ms INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_monitoring_runs_org ON public.monitoring_job_runs(organization_id, started_at DESC);
