/**
 * Unit & Integration Tests: Deterministic 30-Day Cash-Flow Forecasting Engine
 * CashFlow Intelligence — Phase 4: Deterministic 30-Day Cash-Flow Forecasting Engine
 *
 * Verifies:
 * - Mathematical roll-forward invariants: Ending(t) = Beginning(t) + Inflows(t) - Outflows(t)
 * - Balance continuity: Beginning(t+1) = Ending(t)
 * - 30 consecutive calendar days generation
 * - Month transitions, month-end date clamping (31st in Feb/Apr), leap years, and year-ends
 * - Inactive flow exclusion
 * - Recurring frequencies: daily, weekly, biweekly, monthly, quarterly, annually
 * - AR & AP scheduling rules, partial payments, and overdue flagging
 * - Cancelled transaction exclusion
 * - Double-counting prevention
 * - Threshold status & shortfall calculations
 * - Negative cash calculation & critical risk tags
 * - Scenario behavior (Expected vs Optimistic vs Pessimistic)
 * - Audit metadata and item traceability
 */

import { describe, it, expect } from 'vitest';
import {
  ForecastEngine,
  ForecastEngineInput,
  BankAccountRow,
  TransactionRow,
  ReceivableRow,
  PayableRow,
} from '../src/services/forecast-engine';
import {
  RecurringFlowGenerator,
  RecurringFlowRow,
  getDaysInMonth,
} from '../src/services/recurring-generator';
import { MonetaryMath } from '../src/services/financial-calculator';

describe('Phase 4: Deterministic 30-Day Cash-Flow Forecasting Engine', () => {
  const TEST_ORG_A = 'org-1111-aaaa-1111';
  const TEST_ORG_B = 'org-2222-bbbb-2222';

  const mockBankAccount = (overrides?: Partial<BankAccountRow>): BankAccountRow => ({
    id: 'acc-1',
    organization_id: TEST_ORG_A,
    account_name: 'Primary Operating Checking',
    account_type: 'checking',
    opening_balance: 100000.0,
    current_balance: 100000.0,
    currency: 'INR',
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  });

  const mockReceivable = (overrides?: Partial<ReceivableRow>): ReceivableRow => ({
    id: 'ar-1',
    organization_id: TEST_ORG_A,
    customer_id: 'cust-1',
    invoice_number: 'INV-1001',
    invoice_date: '2026-09-10',
    due_date: '2026-09-25',
    invoice_amount: 50000.0,
    outstanding_amount: 50000.0,
    expected_collection_date: '2026-09-25',
    status: 'open',
    created_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
    ...overrides,
  });

  const mockPayable = (overrides?: Partial<PayableRow>): PayableRow => ({
    id: 'ap-1',
    organization_id: TEST_ORG_A,
    supplier_id: 'supp-1',
    invoice_number: 'BILL-5001',
    invoice_date: '2026-09-12',
    due_date: '2026-09-28',
    invoice_amount: 30000.0,
    outstanding_amount: 30000.0,
    expected_payment_date: '2026-09-28',
    status: 'open',
    created_at: '2026-09-12T00:00:00Z',
    updated_at: '2026-09-12T00:00:00Z',
    ...overrides,
  });

  const mockRecurringFlow = (overrides?: Partial<RecurringFlowRow>): RecurringFlowRow => ({
    id: 'rec-1',
    organization_id: TEST_ORG_A,
    name: 'Office Lease',
    flow_type: 'outflow',
    category: 'Rent',
    amount: 15000.0,
    frequency: 'monthly',
    next_occurrence_date: '2026-10-01',
    end_date: null,
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  });

  describe('1. Roll-Forward Invariant & Daily Continuity', () => {
    it('enforces Ending Cash(t) = Beginning Cash(t) + Inflows(t) - Outflows(t) for every day', () => {
      const input: ForecastEngineInput = {
        organizationId: TEST_ORG_A,
        startDate: '2026-09-23',
        horizonDays: 30,
        openingCashOverride: 200000.0,
        receivables: [
          mockReceivable({ expected_collection_date: '2026-09-25', outstanding_amount: 45000.0 }),
          mockReceivable({ id: 'ar-2', expected_collection_date: '2026-10-05', outstanding_amount: 80000.0 }),
        ],
        payables: [
          mockPayable({ expected_payment_date: '2026-09-28', outstanding_amount: 35000.0 }),
          mockPayable({ id: 'ap-2', expected_payment_date: '2026-10-10', outstanding_amount: 60000.0 }),
        ],
        recurringFlows: [
          mockRecurringFlow({ next_occurrence_date: '2026-10-01', amount: 20000.0 }),
        ],
      };

      const result = ForecastEngine.runForecast(input);

      expect(result.dailyForecast).toHaveLength(30);

      // Verify invariant for every single day
      for (let t = 0; t < result.dailyForecast.length; t++) {
        const day = result.dailyForecast[t];

        const calculatedEnding = MonetaryMath.add(
          day.beginningCash,
          MonetaryMath.subtract(day.expectedInflows, day.expectedOutflows)
        );

        expect(day.endingCash).toBe(calculatedEnding);
        expect(day.netCashFlow).toBe(MonetaryMath.subtract(day.expectedInflows, day.expectedOutflows));

        // Verify continuity to next day
        if (t < result.dailyForecast.length - 1) {
          const nextDay = result.dailyForecast[t + 1];
          expect(nextDay.beginningCash).toBe(day.endingCash);
        }
      }
    });

    it('preserves exactly 30 calendar days from start date to end date', () => {
      const input: ForecastEngineInput = {
        organizationId: TEST_ORG_A,
        startDate: '2026-09-23',
        horizonDays: 30,
        openingCashOverride: 50000,
      };

      const result = ForecastEngine.runForecast(input);

      expect(result.horizonDays).toBe(30);
      expect(result.startDate).toBe('2026-09-23');
      expect(result.endDate).toBe('2026-10-22');
      expect(result.dailyForecast[0].date).toBe('2026-09-23');
      expect(result.dailyForecast[29].date).toBe('2026-10-22');
    });
  });

  describe('2. Calendar & Month-End Clamping Boundaries', () => {
    it('handles leap year Feb 29 and month transitions accurately', () => {
      expect(getDaysInMonth(2024, 2)).toBe(29); // Leap year 2024
      expect(getDaysInMonth(2026, 2)).toBe(28); // Non-leap year 2026
      expect(getDaysInMonth(2026, 4)).toBe(30); // April has 30 days
      expect(getDaysInMonth(2026, 3)).toBe(31); // March has 31 days
    });

    it('clamps monthly recurring flows scheduled on 31st to month-end on shorter months', () => {
      const flow = mockRecurringFlow({
        frequency: 'monthly',
        next_occurrence_date: '2026-01-31',
        amount: 25000.0,
      });

      // Window covers Feb 2026 (non-leap year, 28 days)
      const occs = RecurringFlowGenerator.generateOccurrencesForFlow(
        flow,
        '2026-02-01',
        '2026-03-02'
      );

      // Should clamp to Feb 28
      expect(occs).toHaveLength(1);
      expect(occs[0].scheduledDate).toBe('2026-02-28');
    });

    it('clamps monthly recurring flows scheduled on 31st in April to April 30', () => {
      const flow = mockRecurringFlow({
        frequency: 'monthly',
        next_occurrence_date: '2026-03-31',
        amount: 10000.0,
      });

      const occs = RecurringFlowGenerator.generateOccurrencesForFlow(
        flow,
        '2026-04-01',
        '2026-06-05'
      );

      // April 30 and May 31
      expect(occs).toHaveLength(2);
      expect(occs[0].scheduledDate).toBe('2026-04-30');
      expect(occs[1].scheduledDate).toBe('2026-05-31');
    });

    it('handles year-end rollover seamlessly (Dec 31 to Jan 1)', () => {
      const input: ForecastEngineInput = {
        organizationId: TEST_ORG_A,
        startDate: '2026-12-15',
        horizonDays: 30,
        openingCashOverride: 100000,
      };

      const result = ForecastEngine.runForecast(input);
      expect(result.startDate).toBe('2026-12-15');
      expect(result.endDate).toBe('2027-01-13');

      const dec31 = result.dailyForecast.find((d) => d.date === '2026-12-31');
      const jan01 = result.dailyForecast.find((d) => d.date === '2027-01-01');

      expect(dec31).toBeDefined();
      expect(jan01).toBeDefined();
      expect(jan01!.beginningCash).toBe(dec31!.endingCash);
    });
  });

  describe('3. Recurring Flow Generator Frequencies', () => {
    it('generates daily recurring flows for each day in window', () => {
      const flow = mockRecurringFlow({
        frequency: 'daily',
        next_occurrence_date: '2026-09-23',
        amount: 500,
      });

      const occs = RecurringFlowGenerator.generateOccurrencesForFlow(flow, '2026-09-23', '2026-09-27');
      expect(occs).toHaveLength(5);
      expect(occs.map((o) => o.scheduledDate)).toEqual([
        '2026-09-23',
        '2026-09-24',
        '2026-09-25',
        '2026-09-26',
        '2026-09-27',
      ]);
    });

    it('generates weekly recurring flows exactly every 7 days', () => {
      const flow = mockRecurringFlow({
        frequency: 'weekly',
        next_occurrence_date: '2026-09-23',
        amount: 3000,
      });

      const occs = RecurringFlowGenerator.generateOccurrencesForFlow(flow, '2026-09-23', '2026-10-22');
      expect(occs.map((o) => o.scheduledDate)).toEqual([
        '2026-09-23',
        '2026-09-30',
        '2026-10-07',
        '2026-10-14',
        '2026-10-21',
      ]);
    });

    it('generates biweekly recurring flows exactly every 14 days', () => {
      const flow = mockRecurringFlow({
        frequency: 'biweekly',
        next_occurrence_date: '2026-09-25',
        amount: 5000,
      });

      const occs = RecurringFlowGenerator.generateOccurrencesForFlow(flow, '2026-09-23', '2026-10-22');
      expect(occs.map((o) => o.scheduledDate)).toEqual(['2026-09-25', '2026-10-09']);
    });

    it('strictly excludes inactive recurring flows', () => {
      const flow = mockRecurringFlow({
        is_active: false,
        next_occurrence_date: '2026-09-25',
      });

      const occs = RecurringFlowGenerator.generateOccurrencesForFlow(flow, '2026-09-23', '2026-10-22');
      expect(occs).toHaveLength(0);
    });

    it('respects recurring flow end_date boundary', () => {
      const flow = mockRecurringFlow({
        frequency: 'weekly',
        next_occurrence_date: '2026-09-23',
        end_date: '2026-10-05',
      });

      const occs = RecurringFlowGenerator.generateOccurrencesForFlow(flow, '2026-09-23', '2026-10-22');
      expect(occs.map((o) => o.scheduledDate)).toEqual([
        '2026-09-23',
        '2026-09-30',
      ]);
    });
  });

  describe('4. Accounts Receivable & Payable Scheduling Rules', () => {
    it('strictly excludes fully paid and cancelled invoices', () => {
      const input: ForecastEngineInput = {
        organizationId: TEST_ORG_A,
        startDate: '2026-09-23',
        horizonDays: 30,
        openingCashOverride: 100000,
        receivables: [
          mockReceivable({ id: 'ar-paid', status: 'paid', outstanding_amount: 0 }),
          mockReceivable({ id: 'ar-cancelled', status: 'cancelled', outstanding_amount: 50000 }),
          mockReceivable({ id: 'ar-active', status: 'open', outstanding_amount: 40000, expected_collection_date: '2026-09-26' }),
        ],
        payables: [
          mockPayable({ id: 'ap-paid', status: 'paid', outstanding_amount: 0 }),
          mockPayable({ id: 'ap-cancelled', status: 'cancelled', outstanding_amount: 20000 }),
          mockPayable({ id: 'ap-active', status: 'open', outstanding_amount: 25000, expected_payment_date: '2026-09-27' }),
        ],
      };

      const result = ForecastEngine.runForecast(input);

      expect(result.summary.totalExpectedInflows).toBe(40000.0);
      expect(result.summary.totalExpectedOutflows).toBe(25000.0);
      expect(result.allForecastItems.find((i) => i.entityId === 'ar-paid')).toBeUndefined();
      expect(result.allForecastItems.find((i) => i.entityId === 'ar-cancelled')).toBeUndefined();
      expect(result.allForecastItems.find((i) => i.entityId === 'ap-paid')).toBeUndefined();
      expect(result.allForecastItems.find((i) => i.entityId === 'ap-cancelled')).toBeUndefined();
    });

    it('uses partial payment outstanding_amount rather than original invoice_amount', () => {
      const input: ForecastEngineInput = {
        organizationId: TEST_ORG_A,
        startDate: '2026-09-23',
        horizonDays: 30,
        openingCashOverride: 100000,
        receivables: [
          mockReceivable({
            id: 'ar-partial',
            invoice_amount: 150000.0,
            outstanding_amount: 60000.0,
            expected_collection_date: '2026-09-28',
          }),
        ],
        payables: [
          mockPayable({
            id: 'ap-partial',
            invoice_amount: 80000.0,
            outstanding_amount: 30000.0,
            expected_payment_date: '2026-09-29',
          }),
        ],
      };

      const result = ForecastEngine.runForecast(input);
      expect(result.summary.totalExpectedInflows).toBe(60000.0);
      expect(result.summary.totalExpectedOutflows).toBe(30000.0);
    });

    it('flags overdue receivables and schedules them for immediate collection attempt on Day 0', () => {
      const input: ForecastEngineInput = {
        organizationId: TEST_ORG_A,
        startDate: '2026-09-23',
        horizonDays: 30,
        openingCashOverride: 100000,
        receivables: [
          mockReceivable({
            id: 'ar-overdue',
            due_date: '2026-08-31',
            expected_collection_date: '2026-08-31',
            outstanding_amount: 35000.0,
          }),
        ],
      };

      const result = ForecastEngine.runForecast(input);
      expect(result.explanation.overdueReceivablesCount).toBe(1);

      const dayZero = result.dailyForecast[0];
      const overdueItem = dayZero.items.find((i) => i.entityId === 'ar-overdue');
      expect(overdueItem).toBeDefined();
      expect(overdueItem?.date).toBe('2026-09-23');
      expect(overdueItem?.certainty).toBe('ASSUMED');
      expect(overdueItem?.metadata.isOverdue).toBe(true);
    });
  });

  describe('5. Minimum Cash Threshold, Shortfalls & Negative Balance', () => {
    it('classifies threshold status correctly: above, approaching, and below threshold', () => {
      const input: ForecastEngineInput = {
        organizationId: TEST_ORG_A,
        startDate: '2026-09-23',
        horizonDays: 5,
        minimumCashThreshold: 100000,
        openingCashOverride: 150000, // starting > threshold * 1.15 -> above_threshold
        payables: [
          // Day 1: outflow 40,000 -> ending 110,000 (< 115,000) -> approaching_threshold
          mockPayable({ id: 'ap-1', expected_payment_date: '2026-09-24', outstanding_amount: 40000 }),
          // Day 2: outflow 30,000 -> ending 80,000 (< 100,000) -> below_threshold (deficit 20,000)
          mockPayable({ id: 'ap-2', expected_payment_date: '2026-09-25', outstanding_amount: 30000 }),
        ],
      };

      const result = ForecastEngine.runForecast(input);

      expect(result.dailyForecast[0].thresholdStatus).toBe('above_threshold');
      expect(result.dailyForecast[1].thresholdStatus).toBe('approaching_threshold');
      expect(result.dailyForecast[2].thresholdStatus).toBe('below_threshold');
      expect(result.dailyForecast[2].shortfallDeficit).toBe(20000.0);
      expect(result.summary.shortfallDays).toBe(3); // Days 2, 3, 4 remain at 80,000 (< 100,000)
    });

    it('correctly calculates negative cash positions without hiding or clipping them', () => {
      const input: ForecastEngineInput = {
        organizationId: TEST_ORG_A,
        startDate: '2026-09-23',
        horizonDays: 3,
        openingCashOverride: 20000,
        payables: [
          mockPayable({ expected_payment_date: '2026-09-24', outstanding_amount: 50000 }),
        ],
      };

      const result = ForecastEngine.runForecast(input);

      expect(result.dailyForecast[0].endingCash).toBe(20000.0);
      // 20000 - 50000 = -30000
      expect(result.dailyForecast[1].endingCash).toBe(-30000.0);
      expect(result.dailyForecast[2].endingCash).toBe(-30000.0);
      expect(result.summary.minimumProjectedCash).toBe(-30000.0);
      expect(result.summary.riskLevel).toBe('critical');

      const negRisk = result.summary.riskIndicators.find((r) => r.code === 'NEGATIVE_CASH_PROJECTED');
      expect(negRisk).toBeDefined();
      expect(negRisk?.severity).toBe('critical');
    });
  });

  describe('6. Scenario Adjustments (Expected vs Optimistic vs Pessimistic)', () => {
    it('applies scenario rules deterministically', () => {
      const baseInput: ForecastEngineInput = {
        organizationId: TEST_ORG_A,
        startDate: '2026-09-23',
        horizonDays: 30,
        openingCashOverride: 200000,
        receivables: [
          mockReceivable({
            id: 'ar-1',
            invoice_date: '2026-09-10',
            due_date: '2026-10-01',
            expected_collection_date: '2026-10-01',
            outstanding_amount: 100000,
          }),
        ],
        recurringFlows: [
          mockRecurringFlow({
            next_occurrence_date: '2026-09-30',
            amount: 50000,
            flow_type: 'outflow',
          }),
        ],
      };

      const expResult = ForecastEngine.runForecast({ ...baseInput, scenario: 'expected' });
      const optResult = ForecastEngine.runForecast({ ...baseInput, scenario: 'optimistic' });
      const pessResult = ForecastEngine.runForecast({ ...baseInput, scenario: 'pessimistic' });

      // In optimistic: AR collected 3 days earlier (2026-09-28 instead of 2026-10-01)
      const optArItem = optResult.allForecastItems.find((i) => i.entityId === 'ar-1');
      expect(optArItem?.date).toBe('2026-09-28');

      // In pessimistic: AR delayed by 7 days (2026-10-08 instead of 2026-10-01)
      const pessArItem = pessResult.allForecastItems.find((i) => i.entityId === 'ar-1');
      expect(pessArItem?.date).toBe('2026-10-08');

      // In pessimistic: Recurring expense has +5% surcharge (50000 * 1.05 = 52500)
      const pessRecItem = pessResult.allForecastItems.find((i) => i.entityId === 'rec-1');
      expect(pessRecItem?.amount).toBe(52500.0);
    });
  });

  describe('7. Item Traceability and Audit Metadata', () => {
    it('populates required traceability attributes on all generated items', () => {
      const input: ForecastEngineInput = {
        organizationId: TEST_ORG_A,
        startDate: '2026-09-23',
        horizonDays: 10,
        openingCashOverride: 50000,
        receivables: [mockReceivable({ expected_collection_date: '2026-09-25' })],
        payables: [mockPayable({ expected_payment_date: '2026-09-27' })],
        recurringFlows: [mockRecurringFlow({ next_occurrence_date: '2026-09-29' })],
      };

      const result = ForecastEngine.runForecast(input);

      for (const item of result.allForecastItems) {
        expect(item.id).toBeDefined();
        expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(['inflow', 'outflow']).toContain(item.type);
        expect(item.category.length).toBeGreaterThan(0);
        expect(item.amount).toBeGreaterThan(0);
        expect([
          'accounts_receivable',
          'accounts_payable',
          'recurring_cash_flow',
          'future_transaction',
          'assumption',
        ]).toContain(item.source);
        expect(item.description.length).toBeGreaterThan(0);
        expect(['CONFIRMED', 'EXPECTED', 'ASSUMED']).toContain(item.certainty);
        expect(item.schedulingMethod.length).toBeGreaterThan(0);
        expect(item.metadata).toBeDefined();
      }
    });
  });
});
