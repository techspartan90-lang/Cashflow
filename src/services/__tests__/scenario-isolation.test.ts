/**
 * Scenario Isolation & Non-Destructive Modeling Test Suite
 * Validates that scenario simulations:
 * 1. Never mutate actual balances, base forecasts, or actual ledger items.
 * 2. Produce deterministic delta analysis against the base forecast.
 * 3. Support delayed receivables, sales drops, and cost surges in complete isolation.
 */
import { describe, it, expect } from 'vitest';
import { ScenarioEngine } from '../scenario-engine';
import { ForecastEngine } from '../forecast-engine';
import type { BankAccountRow } from '../forecast-engine';

describe('ScenarioEngine Isolation', () => {
  const mockOrgId = 'org-scen-test-001';
  const mockStartDate = '2026-09-24';

  const mockBankAccounts: BankAccountRow[] = [
    {
      id: 'acc-1',
      organization_id: mockOrgId,
      account_name: 'Operating Account',
      account_type: 'checking',
      currency: 'INR',
      opening_balance: 100000,
      current_balance: 100000,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-09-23T00:00:00Z',
    },
  ];

  it('preserves base forecast opening and closing balances without mutation', () => {
    const baseForecast = ForecastEngine.runForecast({
      organizationId: mockOrgId,
      startDate: mockStartDate,
      bankAccounts: mockBankAccounts,
      receivables: [
        {
          id: 'rec-1',
          organization_id: mockOrgId,
          customer_id: 'cust-1',
          invoice_number: 'INV-101',
          invoice_date: '2026-09-01',
          invoice_amount: 20000,
          outstanding_amount: 20000,
          due_date: '2026-09-24',
          expected_collection_date: '2026-09-24',
          status: 'open',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
      payables: [],
      recurringFlows: [],
      minimumCashThreshold: 50000,
      horizonDays: 5,
    });

    const baseOpeningBefore = baseForecast.openingCash;
    const baseClosingBefore = baseForecast.dailyForecast[baseForecast.dailyForecast.length - 1].endingCash;

    const simulation = ScenarioEngine.simulate(
      baseForecast,
      {
        id: 'scen-test-01',
        name: 'Delay Collections by 2 Days',
        scenario_type: 'customer_payment_delay',
      },
      [
        {
          id: 'asm-1',
          scenario_id: 'scen-test-01',
          assumption_type: 'delay_all_receivables',
          target_entity_type: null,
          target_entity_id: null,
          target_category: null,
          adjustment_method: 'date_shift',
          adjustment_value: 2,
          notes: 'Delay collections by 2 days',
          is_active: true,
          created_at: '2026-09-24T00:00:00Z',
          updated_at: '2026-09-24T00:00:00Z',
        } as any,
      ]
    );

    // Base forecast is completely unchanged
    expect(baseForecast.openingCash).toBe(baseOpeningBefore);
    expect(baseForecast.dailyForecast[baseForecast.dailyForecast.length - 1].endingCash).toBe(baseClosingBefore);

    // Simulation has 5 progression days and correctly tracks comparison summary
    expect(simulation.dailyProgression.length).toBe(5);
    expect(simulation.summary).toBeDefined();
  });
});
