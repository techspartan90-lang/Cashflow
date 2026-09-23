/**
 * Deterministic Forecast API Route Handlers
 * CashFlow Intelligence — Phase 4: Deterministic 30-Day Cash-Flow Forecasting Engine
 */

import { ForecastEngine, ForecastEngineInput, ForecastScenario } from '../src/services/forecast-engine';
import { inMemoryStore } from './import-handler';
import type { Database } from '../src/types/database';

type BankAccountRow = Database['public']['Tables']['bank_accounts']['Row'];
type RecurringFlowRow = Database['public']['Tables']['recurring_cash_flows']['Row'];
type ForecastRunRow = Database['public']['Tables']['forecast_runs']['Row'];
type ForecastDailyRow = Database['public']['Tables']['forecast_daily_projections']['Row'];
type ForecastItemRow = Database['public']['Tables']['forecast_items']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type SupplierRow = Database['public']['Tables']['suppliers']['Row'];

const DEFAULT_ORG_ID = '11111111-1111-1111-1111-111111111111';

// Extended tenant store for Phase 4
export const forecastStore = {
  bankAccounts: new Map<string, BankAccountRow[]>(),
  recurringFlows: new Map<string, RecurringFlowRow[]>(),
  forecastRuns: new Map<string, ForecastRunRow[]>(),
  forecastDaily: new Map<string, ForecastDailyRow[]>(),
  forecastItems: new Map<string, ForecastItemRow[]>(),
  customers: new Map<string, CustomerRow[]>(),
  suppliers: new Map<string, SupplierRow[]>(),
  nextVersionByOrg: new Map<string, number>(),
};

/**
 * Seed initial sample operational data for an organization if empty
 */
function initializeOrgDefaults(orgId: string) {
  if (!forecastStore.bankAccounts.has(orgId)) {
    forecastStore.bankAccounts.set(orgId, [
      {
        id: 'acc-hdfc-01',
        organization_id: orgId,
        account_name: 'HDFC Bank - Primary Operating',
        account_type: 'checking',
        opening_balance: 200000.0,
        current_balance: 200000.0,
        currency: 'INR',
        is_active: true,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: 'acc-icici-02',
        organization_id: orgId,
        account_name: 'ICICI Bank - Reserve & Payroll',
        account_type: 'savings',
        opening_balance: 50000.0,
        current_balance: 50000.0,
        currency: 'INR',
        is_active: true,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ]);
  }

  if (!forecastStore.recurringFlows.has(orgId)) {
    forecastStore.recurringFlows.set(orgId, [
      {
        id: 'rec-01',
        organization_id: orgId,
        name: 'Warehouse & Office Lease',
        flow_type: 'outflow',
        category: 'Rent',
        amount: 45000.0,
        frequency: 'monthly',
        next_occurrence_date: '2026-10-01',
        end_date: null,
        is_active: true,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: 'rec-02',
        organization_id: orgId,
        name: 'Staff Payroll Disbursement',
        flow_type: 'outflow',
        category: 'Salaries',
        amount: 95000.0,
        frequency: 'monthly',
        next_occurrence_date: '2026-09-30',
        end_date: null,
        is_active: true,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: 'rec-03',
        organization_id: orgId,
        name: 'Commercial Fleet Fuel & Logistics',
        flow_type: 'outflow',
        category: 'Transportation',
        amount: 8500.0,
        frequency: 'weekly',
        next_occurrence_date: '2026-09-26',
        end_date: null,
        is_active: true,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: 'rec-04',
        organization_id: orgId,
        name: 'ERP & Cloud Subscriptions',
        flow_type: 'outflow',
        category: 'Software Subscription',
        amount: 12000.0,
        frequency: 'monthly',
        next_occurrence_date: '2026-10-05',
        end_date: null,
        is_active: true,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: 'rec-05',
        organization_id: orgId,
        name: 'Working Capital Loan EMI',
        flow_type: 'outflow',
        category: 'Loan Repayment',
        amount: 28500.0,
        frequency: 'monthly',
        next_occurrence_date: '2026-10-10',
        end_date: null,
        is_active: true,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ]);
  }

  // Seed sample AR if empty
  if (!inMemoryStore.receivables.has(orgId) || inMemoryStore.receivables.get(orgId)!.length === 0) {
    inMemoryStore.receivables.set(orgId, [
      {
        id: 'ar-101',
        organization_id: orgId,
        customer_id: 'cust-01',
        invoice_number: 'INV-2026-8841',
        invoice_date: '2026-08-25',
        due_date: '2026-09-24',
        invoice_amount: 145000.0,
        outstanding_amount: 145000.0,
        expected_collection_date: '2026-09-27',
        status: 'open',
        created_at: '2026-08-25T00:00:00Z',
        updated_at: '2026-08-25T00:00:00Z',
      },
      {
        id: 'ar-102',
        organization_id: orgId,
        customer_id: 'cust-02',
        invoice_number: 'INV-2026-8842',
        invoice_date: '2026-09-05',
        due_date: '2026-09-26',
        invoice_amount: 88000.0,
        outstanding_amount: 58000.0, // partial payment
        expected_collection_date: '2026-10-02',
        status: 'partially_paid',
        created_at: '2026-09-05T00:00:00Z',
        updated_at: '2026-09-05T00:00:00Z',
      },
      {
        id: 'ar-103',
        organization_id: orgId,
        customer_id: 'cust-03',
        invoice_number: 'INV-2026-8843',
        invoice_date: '2026-09-10',
        due_date: '2026-10-10',
        invoice_amount: 120000.0,
        outstanding_amount: 120000.0,
        expected_collection_date: '2026-10-12',
        status: 'open',
        created_at: '2026-09-10T00:00:00Z',
        updated_at: '2026-09-10T00:00:00Z',
      },
      {
        id: 'ar-104',
        organization_id: orgId,
        customer_id: 'cust-04',
        invoice_number: 'INV-2026-8800',
        invoice_date: '2026-08-01',
        due_date: '2026-08-31',
        invoice_amount: 62000.0,
        outstanding_amount: 62000.0,
        expected_collection_date: '2026-08-31',
        status: 'overdue',
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
    ]);
  }

  // Seed sample AP if empty
  if (!inMemoryStore.payables.has(orgId) || inMemoryStore.payables.get(orgId)!.length === 0) {
    inMemoryStore.payables.set(orgId, [
      {
        id: 'ap-201',
        organization_id: orgId,
        supplier_id: 'supp-01',
        invoice_number: 'BILL-APEX-441',
        invoice_date: '2026-08-20',
        due_date: '2026-09-25',
        invoice_amount: 110000.0,
        outstanding_amount: 110000.0,
        expected_payment_date: '2026-09-25',
        status: 'open',
        created_at: '2026-08-20T00:00:00Z',
        updated_at: '2026-08-20T00:00:00Z',
      },
      {
        id: 'ap-202',
        organization_id: orgId,
        supplier_id: 'supp-02',
        invoice_number: 'BILL-METRO-902',
        invoice_date: '2026-09-02',
        due_date: '2026-10-02',
        invoice_amount: 65000.0,
        outstanding_amount: 40000.0, // partial payment
        expected_payment_date: '2026-10-02',
        status: 'partially_paid',
        created_at: '2026-09-02T00:00:00Z',
        updated_at: '2026-09-02T00:00:00Z',
      },
      {
        id: 'ap-203',
        organization_id: orgId,
        supplier_id: 'supp-03',
        invoice_number: 'BILL-DELTA-102',
        invoice_date: '2026-09-15',
        due_date: '2026-10-15',
        invoice_amount: 45000.0,
        outstanding_amount: 45000.0,
        expected_payment_date: '2026-10-15',
        status: 'open',
        created_at: '2026-09-15T00:00:00Z',
        updated_at: '2026-09-15T00:00:00Z',
      },
    ]);
  }

  if (!forecastStore.forecastRuns.has(orgId)) {
    forecastStore.forecastRuns.set(orgId, []);
  }
  if (!forecastStore.forecastDaily.has(orgId)) {
    forecastStore.forecastDaily.set(orgId, []);
  }
  if (!forecastStore.forecastItems.has(orgId)) {
    forecastStore.forecastItems.set(orgId, []);
  }
  if (!forecastStore.nextVersionByOrg.has(orgId)) {
    forecastStore.nextVersionByOrg.set(orgId, 1);
  }
}

/**
 * Build engine input state for an organization
 */
function buildEngineInput(
  orgId: string,
  overrides?: {
    startDate?: string;
    horizonDays?: number;
    scenario?: ForecastScenario;
    minimumCashThreshold?: number;
    openingCashOverride?: number;
    assumptions?: Record<string, any>;
  }
): ForecastEngineInput {
  initializeOrgDefaults(orgId);

  const bankAccounts = forecastStore.bankAccounts.get(orgId) || [];
  const recurringFlows = forecastStore.recurringFlows.get(orgId) || [];
  const receivables = inMemoryStore.receivables.get(orgId) || [];
  const payables = inMemoryStore.payables.get(orgId) || [];
  const allTxs = inMemoryStore.transactions.get(orgId) || [];
  const customers = forecastStore.customers.get(orgId) || [];
  const suppliers = forecastStore.suppliers.get(orgId) || [];

  const startDate = overrides?.startDate || '2026-09-23';

  // Future-dated transactions
  const futureTransactions = allTxs.filter((tx) => tx.transaction_date >= startDate);
  const historicalTransactions = allTxs.filter((tx) => tx.transaction_date < startDate);

  return {
    organizationId: orgId,
    startDate,
    horizonDays: overrides?.horizonDays || 30,
    timezone: 'UTC',
    scenario: overrides?.scenario || 'expected',
    minimumCashThreshold: overrides?.minimumCashThreshold ?? 100000,
    openingCashOverride: overrides?.openingCashOverride,
    bankAccounts,
    historicalTransactions,
    futureTransactions,
    receivables,
    payables,
    recurringFlows,
    customers,
    suppliers,
    assumptions: overrides?.assumptions,
  };
}

/**
 * 1. POST /api/forecasts/generate
 * Executes forecast, increments version, persists audit records
 */
export async function handleForecastGenerate(payload: {
  organizationId?: string;
  startDate?: string;
  horizonDays?: number;
  scenario?: ForecastScenario;
  minimumCashThreshold?: number;
  openingCashOverride?: number;
  assumptions?: Record<string, any>;
  userRole?: string;
}) {
  if (payload.userRole === 'viewer') {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Viewer role cannot generate new authoritative forecast versions.' },
    };
  }

  const orgId = payload.organizationId || DEFAULT_ORG_ID;
  const input = buildEngineInput(orgId, payload);
  const result = ForecastEngine.runForecast(input);

  // Increment version
  const currentVer = forecastStore.nextVersionByOrg.get(orgId) || 1;
  result.forecastVersion = currentVer;
  forecastStore.nextVersionByOrg.set(orgId, currentVer + 1);

  // Persist Run record
  const runRow: ForecastRunRow = {
    id: result.forecastId,
    organization_id: orgId,
    forecast_version: result.forecastVersion,
    scenario_type: result.scenario,
    start_date: result.startDate,
    end_date: result.endDate,
    horizon_days: result.horizonDays,
    timezone: result.timezone,
    opening_cash: result.openingCash,
    minimum_cash_threshold: result.minimumCashThreshold,
    total_expected_inflows: result.summary.totalExpectedInflows,
    total_expected_outflows: result.summary.totalExpectedOutflows,
    net_cash_flow: result.summary.netCashFlow,
    minimum_projected_cash: result.summary.minimumProjectedCash,
    shortfall_days: result.summary.shortfallDays,
    risk_level: result.summary.riskLevel,
    assumptions_snapshot: result.assumptionsSnapshot,
    calculation_status: 'completed',
    created_by: null,
    created_at: result.generationTimestamp,
  };

  const orgRuns = forecastStore.forecastRuns.get(orgId) || [];
  orgRuns.unshift(runRow);
  forecastStore.forecastRuns.set(orgId, orgRuns);

  // Persist Daily Projections
  const orgDaily = forecastStore.forecastDaily.get(orgId) || [];
  for (const day of result.dailyForecast) {
    const dailyRow: ForecastDailyRow = {
      id: `dp-${result.forecastId}-${day.dayIndex}`,
      forecast_run_id: result.forecastId,
      organization_id: orgId,
      day_index: day.dayIndex,
      projection_date: day.date,
      beginning_cash: day.beginningCash,
      expected_inflows: day.expectedInflows,
      expected_outflows: day.expectedOutflows,
      net_cash_flow: day.netCashFlow,
      ending_cash: day.endingCash,
      minimum_threshold: result.minimumCashThreshold,
      threshold_status: day.thresholdStatus,
      shortfall_deficit: day.shortfallDeficit,
      risk_factors: day.riskFactors,
      created_at: result.generationTimestamp,
    };
    orgDaily.push(dailyRow);
  }
  forecastStore.forecastDaily.set(orgId, orgDaily);

  // Persist Granular Items
  const orgItems = forecastStore.forecastItems.get(orgId) || [];
  for (const item of result.allForecastItems) {
    const itemRow: ForecastItemRow = {
      id: item.id,
      forecast_run_id: result.forecastId,
      organization_id: orgId,
      scheduled_date: item.date,
      flow_type: item.type,
      category: item.category,
      amount: item.amount,
      source: item.source,
      description: item.description,
      certainty: item.certainty,
      entity_id: item.entityId,
      scheduling_method: item.schedulingMethod,
      metadata: item.metadata,
      created_at: result.generationTimestamp,
    };
    orgItems.push(itemRow);
  }
  forecastStore.forecastItems.set(orgId, orgItems);

  // Audit log entry
  inMemoryStore.auditLogs.unshift({
    id: `audit-${Date.now()}`,
    organization_id: orgId,
    action: 'FORECAST_GENERATED',
    entity_type: 'forecast_runs',
    entity_id: result.forecastId,
    previous_value: null,
    new_value: {
      version: result.forecastVersion,
      scenario: result.scenario,
      netCashFlow: result.summary.netCashFlow,
      shortfallDays: result.summary.shortfallDays,
    },
    created_at: result.generationTimestamp,
  });

  return {
    success: true,
    data: result,
  };
}

/**
 * 2. POST /api/forecasts/preview
 * Computes forecast on-the-fly without incrementing version or saving to historical log
 */
export async function handleForecastPreview(payload: {
  organizationId?: string;
  startDate?: string;
  horizonDays?: number;
  scenario?: ForecastScenario;
  minimumCashThreshold?: number;
  openingCashOverride?: number;
  assumptions?: Record<string, any>;
}) {
  const orgId = payload.organizationId || DEFAULT_ORG_ID;
  const input = buildEngineInput(orgId, payload);
  const result = ForecastEngine.runForecast(input);

  return {
    success: true,
    data: result,
  };
}

/**
 * 3. GET /api/forecasts
 * Returns historical forecast runs list
 */
export async function handleGetForecastRuns(query: { organizationId?: string }) {
  const orgId = query.organizationId || DEFAULT_ORG_ID;
  initializeOrgDefaults(orgId);
  const runs = forecastStore.forecastRuns.get(orgId) || [];

  return {
    success: true,
    data: runs,
  };
}

/**
 * 4. GET /api/forecasts/details
 * Returns detailed forecast with daily projections and explanation
 */
export async function handleGetForecastDetails(query: {
  organizationId?: string;
  forecastId?: string;
  scenario?: ForecastScenario;
}) {
  const orgId = query.organizationId || DEFAULT_ORG_ID;
  initializeOrgDefaults(orgId);

  // If forecastId is provided, attempt to locate run; otherwise run live baseline
  if (query.forecastId) {
    const runs = forecastStore.forecastRuns.get(orgId) || [];
    const run = runs.find((r) => r.id === query.forecastId);
    if (run) {
      // Reconstitute from stored daily
      const allDaily = (forecastStore.forecastDaily.get(orgId) || []).filter(
        (d) => d.forecast_run_id === query.forecastId
      );
      const allItems = (forecastStore.forecastItems.get(orgId) || []).filter(
        (i) => i.forecast_run_id === query.forecastId
      );

      return {
        success: true,
        data: {
          run,
          daily: allDaily,
          items: allItems,
        },
      };
    }
  }

  // Default: compute fresh forecast for active org
  const input = buildEngineInput(orgId, { scenario: query.scenario || 'expected' });
  const fresh = ForecastEngine.runForecast(input);
  return {
    success: true,
    data: fresh,
  };
}

/**
 * 5. GET /api/forecasts/shortfalls
 * Returns days where ending cash breaches minimum threshold
 */
export async function handleGetForecastShortfalls(query: {
  organizationId?: string;
  scenario?: ForecastScenario;
}) {
  const orgId = query.organizationId || DEFAULT_ORG_ID;
  const input = buildEngineInput(orgId, { scenario: query.scenario || 'expected' });
  const result = ForecastEngine.runForecast(input);

  const shortfalls = result.dailyForecast.filter((d) => d.thresholdStatus === 'below_threshold');

  return {
    success: true,
    data: {
      minimumCashThreshold: result.minimumCashThreshold,
      shortfallDaysCount: shortfalls.length,
      shortfallDates: shortfalls.map((s) => s.date),
      dailyShortfalls: shortfalls.map((s) => ({
        date: s.date,
        dayOfWeek: s.dayOfWeek,
        endingCash: s.endingCash,
        deficit: s.shortfallDeficit,
        riskFactors: s.riskFactors,
      })),
    },
  };
}

/**
 * 6. GET /api/forecasts/explanation
 * Returns comprehensive explanation breakdown
 */
export async function handleGetForecastExplanation(query: {
  organizationId?: string;
  scenario?: ForecastScenario;
}) {
  const orgId = query.organizationId || DEFAULT_ORG_ID;
  const input = buildEngineInput(orgId, { scenario: query.scenario || 'expected' });
  const result = ForecastEngine.runForecast(input);

  return {
    success: true,
    data: {
      forecastId: result.forecastId,
      scenario: result.scenario,
      summary: result.summary,
      assumptionsSnapshot: result.assumptionsSnapshot,
      explanation: result.explanation,
    },
  };
}

/**
 * 7. POST /api/forecasts/refresh
 * Re-runs forecast with latest imported ledger data
 */
export async function handleForecastRefresh(payload: {
  organizationId?: string;
  scenario?: ForecastScenario;
  userRole?: string;
}) {
  return handleForecastGenerate(payload);
}
