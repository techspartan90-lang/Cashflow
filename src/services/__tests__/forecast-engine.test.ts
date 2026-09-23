/**
 * Deterministic Forecast Engine Test Suite
 * Validates 30-day projection continuity, AR/AP scheduling,
 * threshold violation detection, and reproducible forecast generation.
 */
import { describe, it, expect } from 'vitest';
import { ForecastEngine } from '../forecast-engine';
import type { BankAccountRow } from '../forecast-engine';

describe('ForecastEngine', () => {
  const mockOrgId = 'org-test-uuid-001';
  const mockStartDate = '2026-09-24';

  const mockBankAccounts: BankAccountRow[] = [
    {
      id: 'acc-1',
      organization_id: mockOrgId,
      account_name: 'Operating Account',
      account_type: 'checking',
      currency: 'INR',
      opening_balance: 500000,
      current_balance: 500000,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-09-23T00:00:00Z',
    },
  ];

  it('generates an exact 30-day projection horizon', () => {
    const forecast = ForecastEngine.runForecast({
      organizationId: mockOrgId,
      startDate: mockStartDate,
      bankAccounts: mockBankAccounts,
      receivables: [],
      payables: [],
      recurringFlows: [],
      horizonDays: 30,
    });

    expect(forecast.horizonDays).toBe(30);
    expect(forecast.dailyForecast.length).toBe(30);
    expect(forecast.dailyForecast[0].date).toBe(mockStartDate);
  });

  it('ensures BeginningCash(t + 1) === EndingCash(t) across all 30 days', () => {
    const forecast = ForecastEngine.runForecast({
      organizationId: mockOrgId,
      startDate: mockStartDate,
      bankAccounts: mockBankAccounts,
      receivables: [],
      payables: [],
      recurringFlows: [],
      horizonDays: 30,
    });

    for (let i = 0; i < forecast.dailyForecast.length - 1; i++) {
      const currentDay = forecast.dailyForecast[i];
      const nextDay = forecast.dailyForecast[i + 1];
      expect(nextDay.beginningCash).toBe(currentDay.endingCash);
    }
  });

  it('accurately schedules receivables as inflows and payables as outflows', () => {
    const forecast = ForecastEngine.runForecast({
      organizationId: mockOrgId,
      startDate: mockStartDate,
      bankAccounts: mockBankAccounts,
      receivables: [
        {
          id: 'rec-1',
          organization_id: mockOrgId,
          customer_id: 'cust-1',
          invoice_number: 'INV-2026-001',
          invoice_date: '2026-09-01',
          invoice_amount: 50000,
          outstanding_amount: 50000,
          due_date: '2026-09-26',
          expected_collection_date: '2026-09-26',
          status: 'open',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
      payables: [
        {
          id: 'pay-1',
          organization_id: mockOrgId,
          supplier_id: 'supp-1',
          invoice_number: 'BILL-2026-001',
          invoice_date: '2026-09-01',
          invoice_amount: 20000,
          outstanding_amount: 20000,
          due_date: '2026-09-28',
          expected_payment_date: '2026-09-28',
          status: 'open',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
      recurringFlows: [],
      horizonDays: 10,
    });

    const day26 = forecast.dailyForecast.find((d) => d.date === '2026-09-26');
    const day28 = forecast.dailyForecast.find((d) => d.date === '2026-09-28');

    expect(day26?.expectedInflows).toBe(50000);
    expect(day28?.expectedOutflows).toBe(20000);
  });

  it('detects minimum cash reserve threshold breaches', () => {
    const lowBalanceAccounts: BankAccountRow[] = [
      {
        id: 'acc-low',
        organization_id: mockOrgId,
        account_name: 'Low Balance Account',
        account_type: 'checking',
        currency: 'INR',
        opening_balance: 30000,
        current_balance: 30000,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-09-23T00:00:00Z',
      },
    ];

    const forecast = ForecastEngine.runForecast({
      organizationId: mockOrgId,
      startDate: mockStartDate,
      bankAccounts: lowBalanceAccounts,
      receivables: [],
      payables: [],
      recurringFlows: [],
      minimumCashThreshold: 50000,
      horizonDays: 5,
    });

    expect(forecast.summary.shortfallDays).toBeGreaterThan(0);
    expect(forecast.dailyForecast[0].thresholdStatus).toBe('below_threshold');
  });
});
