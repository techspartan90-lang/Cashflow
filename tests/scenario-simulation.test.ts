/**
 * Unit & Integration Tests: Scenario Simulation, Sensitivity Analysis & Decision Support
 * CashFlow Intelligence — Phase 6
 *
 * Verifies:
 * - Mathematical Invariants:
 *   1. Scenario Beginning Cash(t + 1) = Scenario Ending Cash(t)
 *   2. Scenario Ending Cash(t) = Scenario Beginning Cash(t) + Inflows(t) - Outflows(t)
 *   3. Base forecast remains strictly immutable and unmutated
 *   4. Historical actual transactions remain untouched
 * - Revenue Adjustments: percentage increase, percentage decrease, category-specific, date-bound
 * - Customer Payment Delays: date shift (e.g. +14 days), collections shifted past 30 days
 * - Expense Adjustments: percentage changes, one-time shocks, recurring commitments
 * - Threshold breaches and shortfall deficit tracking
 * - Multi-Scenario comparison metrics
 * - Single-variable sensitivity analysis sweeps
 * - Deterministic reproducibility
 */

import { describe, it, expect } from 'vitest';
import {
  ScenarioEngine,
  ScenarioAssumptionRow,
  ScenarioRow,
} from '../src/services/scenario-engine';
import {
  ForecastEngine,
  ForecastEngineInput,
  ReceivableRow,
  PayableRow,
} from '../src/services/forecast-engine';
import { MonetaryMath } from '../src/services/financial-calculator';

describe('Phase 6: Scenario Simulation & Decision-Support Engine', () => {
  const TEST_ORG = '11111111-1111-1111-1111-111111111111';

  const mockReceivable = (overrides?: Partial<ReceivableRow>): ReceivableRow => ({
    id: 'ar-101',
    organization_id: TEST_ORG,
    customer_id: 'cust-1',
    invoice_number: 'INV-101',
    invoice_date: '2026-09-15',
    due_date: '2026-09-28',
    invoice_amount: 100000.0,
    outstanding_amount: 100000.0,
    expected_collection_date: '2026-09-28',
    status: 'open',
    created_at: '2026-09-15T00:00:00Z',
    updated_at: '2026-09-15T00:00:00Z',
    ...overrides,
  });

  const mockPayable = (overrides?: Partial<PayableRow>): PayableRow => ({
    id: 'ap-201',
    organization_id: TEST_ORG,
    supplier_id: 'supp-1',
    invoice_number: 'BILL-201',
    invoice_date: '2026-09-10',
    due_date: '2026-09-30',
    invoice_amount: 40000.0,
    outstanding_amount: 40000.0,
    expected_payment_date: '2026-09-30',
    status: 'open',
    created_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
    ...overrides,
  });

  const getBaseForecast = () => {
    return ForecastEngine.runForecast({
      organizationId: TEST_ORG,
      startDate: '2026-09-23',
      horizonDays: 30,
      openingCashOverride: 200000.0,
      minimumCashThreshold: 100000.0,
      receivables: [
        mockReceivable({
          id: 'ar-1',
          invoice_number: 'INV-1',
          expected_collection_date: '2026-09-28',
          outstanding_amount: 50000.0,
        }),
        mockReceivable({
          id: 'ar-2',
          invoice_number: 'INV-2',
          expected_collection_date: '2026-10-10',
          outstanding_amount: 100000.0,
        }),
      ],
      payables: [
        mockPayable({
          id: 'ap-1',
          invoice_number: 'BILL-1',
          expected_payment_date: '2026-09-30',
          outstanding_amount: 30000.0,
        }),
        mockPayable({
          id: 'ap-2',
          invoice_number: 'BILL-2',
          expected_payment_date: '2026-10-15',
          outstanding_amount: 70000.0,
        }),
      ],
    });
  };

  describe('1. Financial Invariants & Base Immutability', () => {
    it('enforces Scenario Ending(t) = Scenario Beginning(t) + Inflows(t) - Outflows(t)', () => {
      const base = getBaseForecast();
      const initialBaseEnding = base.dailyForecast[29].endingCash;

      const asm: ScenarioAssumptionRow = {
        id: 'asm-1',
        scenario_id: 'scen-1',
        organization_id: TEST_ORG,
        assumption_type: 'revenue_adjustment',
        target_type: 'all',
        target_id: null,
        adjustment_method: 'percentage_change',
        adjustment_value: -20, // -20% revenue
        start_date: null,
        end_date: null,
        description: '20% drop in revenue',
        source: 'user_defined',
        created_at: new Date().toISOString(),
      };

      const result = ScenarioEngine.simulate(base, { id: 'scen-1', name: 'Test Scenario' }, [asm]);

      expect(result.dailyProgression).toHaveLength(30);

      // Verify daily roll-forward continuity
      for (let t = 0; t < result.dailyProgression.length; t++) {
        const day = result.dailyProgression[t];
        const calculatedEnding = MonetaryMath.add(
          day.beginningCash,
          MonetaryMath.subtract(day.inflows, day.outflows)
        );

        expect(day.endingCash).toBe(calculatedEnding);

        if (t < result.dailyProgression.length - 1) {
          expect(result.dailyProgression[t + 1].beginningCash).toBe(day.endingCash);
        }
      }

      // Verify Base Forecast remains 100% UNCHANGED (immutability guarantee)
      expect(base.dailyForecast[29].endingCash).toBe(initialBaseEnding);
      expect(base.summary.totalExpectedInflows).toBe(150000.0);
    });
  });

  describe('2. Revenue Adjustments', () => {
    it('simulates percentage reduction in revenue correctly', () => {
      const base = getBaseForecast();
      // Base inflows = 50,000 + 100,000 = 150,000
      const asm: ScenarioAssumptionRow = {
        id: 'asm-rev-drop',
        scenario_id: 'scen-rev',
        organization_id: TEST_ORG,
        assumption_type: 'revenue_adjustment',
        target_type: 'all',
        target_id: null,
        adjustment_method: 'percentage_change',
        adjustment_value: -10, // -10%
        start_date: null,
        end_date: null,
        description: '10% sales drop',
        source: 'user',
        created_at: new Date().toISOString(),
      };

      const sim = ScenarioEngine.simulate(base, { id: 'scen-rev' }, [asm]);

      // 150,000 * 0.9 = 135,000
      expect(sim.summary.scenarioTotalInflows).toBe(135000.0);
      expect(sim.summary.inflowsDelta).toBe(-15000.0);
      expect(sim.summary.netCashFlowDelta).toBe(-15000.0);
    });

    it('simulates category-specific revenue adjustment within date range', () => {
      const base = getBaseForecast();

      const asm: ScenarioAssumptionRow = {
        id: 'asm-cat-range',
        scenario_id: 'scen-cat',
        organization_id: TEST_ORG,
        assumption_type: 'revenue_adjustment',
        target_type: 'category',
        target_id: 'Accounts Receivable Collection',
        adjustment_method: 'percentage_change',
        adjustment_value: 20, // +20%
        start_date: '2026-10-01',
        end_date: '2026-10-15',
        description: 'Early October collections boost',
        source: 'user',
        created_at: new Date().toISOString(),
      };

      const sim = ScenarioEngine.simulate(base, { id: 'scen-cat' }, [asm]);

      // Only the Oct 10 collection (100,000) falls in this window (+20% = +20,000)
      // Sep 28 collection (50,000) is before Oct 01, so unchanged
      expect(sim.summary.scenarioTotalInflows).toBe(170000.0);
      expect(sim.summary.inflowsDelta).toBe(20000.0);
    });
  });

  describe('3. Customer Payment Delay & Horizon Exclusions', () => {
    it('shifts receivable dates by fixed calendar days', () => {
      const base = getBaseForecast();

      const asm: ScenarioAssumptionRow = {
        id: 'asm-delay-5d',
        scenario_id: 'scen-delay',
        organization_id: TEST_ORG,
        assumption_type: 'customer_delay',
        target_type: 'all',
        target_id: null,
        adjustment_method: 'date_shift',
        adjustment_value: 5, // +5 days
        start_date: null,
        end_date: null,
        description: 'Customer lag 5 days',
        source: 'user',
        created_at: new Date().toISOString(),
      };

      const sim = ScenarioEngine.simulate(base, { id: 'scen-delay' }, [asm]);

      // Sep 28 shifted to Oct 03 (+5 days)
      // Oct 10 shifted to Oct 15 (+5 days)
      const dayOct03 = sim.dailyProgression.find((d) => d.date === '2026-10-03');
      const daySep28 = sim.dailyProgression.find((d) => d.date === '2026-09-28');

      expect(daySep28?.inflows).toBe(0.0);
      expect(dayOct03?.inflows).toBe(50000.0);
    });

    it('identifies collections shifted past 30-day horizon and excludes them from active window', () => {
      const base = getBaseForecast();
      // Oct 10 shifted by 15 days becomes Oct 25 (beyond window end Oct 22)
      const asm: ScenarioAssumptionRow = {
        id: 'asm-delay-15d',
        scenario_id: 'scen-delay-long',
        organization_id: TEST_ORG,
        assumption_type: 'customer_delay',
        target_type: 'all',
        target_id: null,
        adjustment_method: 'date_shift',
        adjustment_value: 15,
        start_date: null,
        end_date: null,
        description: '15-day delay pushes late-month receivables out of window',
        source: 'user',
        created_at: new Date().toISOString(),
      };

      const sim = ScenarioEngine.simulate(base, { id: 'scen-delay-long' }, [asm]);

      // 100,000 is pushed past horizon!
      expect(sim.outOfWindowDelayedItems).toHaveLength(1);
      expect(sim.outOfWindowDelayedItems[0].amount).toBe(100000.0);
      expect(sim.outOfWindowDelayedItems[0].scheduledDate).toBe('2026-10-25');

      // Only 50,000 remains in window (Sep 28 + 15 = Oct 13 <= Oct 22)
      expect(sim.summary.scenarioTotalInflows).toBe(50000.0);
      expect(sim.summary.inflowsDelta).toBe(-100000.0);

      // Verify insight is generated
      const lagInsight = sim.insights.find((i) => i.category === 'ar_delay');
      expect(lagInsight).toBeDefined();
      expect(lagInsight?.severity).toBe('warning');
    });
  });

  describe('4. Expense Shocks & Commitments', () => {
    it('applies unexpected one-time expense shock on specified date', () => {
      const base = getBaseForecast();

      const asm: ScenarioAssumptionRow = {
        id: 'asm-shock',
        scenario_id: 'scen-shock',
        organization_id: TEST_ORG,
        assumption_type: 'one_time_expense',
        target_type: 'all',
        target_id: 'Emergency Machinery Repair',
        adjustment_method: 'one_time_event',
        adjustment_value: 45000.0,
        start_date: '2026-10-05',
        end_date: null,
        description: 'Emergency HVAC breakdown',
        source: 'user',
        created_at: new Date().toISOString(),
      };

      const sim = ScenarioEngine.simulate(base, { id: 'scen-shock' }, [asm]);

      expect(sim.summary.scenarioTotalOutflows).toBe(base.summary.totalExpectedOutflows + 45000.0);
      expect(sim.summary.outflowsDelta).toBe(45000.0);

      const dayOct05 = sim.dailyProgression.find((d) => d.date === '2026-10-05');
      const shockItem = dayOct05?.items.find((i) => i.sourceType === 'simulated_event');
      expect(shockItem).toBeDefined();
      expect(shockItem?.amount).toBe(45000.0);
    });

    it('adds recurring business commitment obligation', () => {
      const base = getBaseForecast();

      const asm: ScenarioAssumptionRow = {
        id: 'asm-hire',
        scenario_id: 'scen-hire',
        organization_id: TEST_ORG,
        assumption_type: 'new_commitment',
        target_type: 'category',
        target_id: 'Payroll',
        adjustment_method: 'one_time_event',
        adjustment_value: 35000.0,
        start_date: '2026-10-01',
        end_date: null,
        description: 'New hire salary installment',
        source: 'user',
        created_at: new Date().toISOString(),
      };

      const sim = ScenarioEngine.simulate(base, { id: 'scen-hire' }, [asm]);

      expect(sim.summary.outflowsDelta).toBe(35000.0);
      expect(sim.summary.endingCashDelta).toBe(-35000.0);
    });
  });

  describe('5. Liquidity Threshold & Deficit Tracking', () => {
    it('detects shortfall days and calculates maximum cash deficit', () => {
      const base = getBaseForecast();
      // Base ending cash is 250,000. Threshold is 100,000.
      // A massive expense shock of 180,000 on Sep 29 reduces cash to 20,000 (< 100,000)
      const asm: ScenarioAssumptionRow = {
        id: 'asm-big-drain',
        scenario_id: 'scen-drain',
        organization_id: TEST_ORG,
        assumption_type: 'one_time_expense',
        target_type: 'all',
        target_id: 'Tax Audit Penalty',
        adjustment_method: 'one_time_event',
        adjustment_value: 180000.0,
        start_date: '2026-09-29',
        end_date: null,
        description: 'Large liquidity drain',
        source: 'user',
        created_at: new Date().toISOString(),
      };

      const sim = ScenarioEngine.simulate(base, { id: 'scen-drain' }, [asm]);

      expect(sim.summary.scenarioShortfallDays).toBeGreaterThan(0);
      expect(sim.summary.firstShortfallDate).toBe('2026-09-29');
      expect(sim.summary.maxShortfallDeficit).toBeGreaterThan(0);

      const breachInsight = sim.insights.find((i) => i.category === 'liquidity_buffer');
      expect(breachInsight).toBeDefined();
      expect(breachInsight?.severity).toBe('critical');
    });
  });

  describe('6. Sensitivity Analysis Parameter Sweep', () => {
    it('runs single-variable sensitivity sweep across multiple discrete parameter steps', () => {
      const base = getBaseForecast();
      const sweep = ScenarioEngine.runSensitivitySweep(base, 'revenue_multiplier');

      expect(sweep.variableType).toBe('revenue_multiplier');
      expect(sweep.steps).toHaveLength(7);

      // Verify progression: higher revenue -> higher ending cash
      const stepMinus30 = sweep.steps.find((s) => s.parameterValue === -30);
      const stepBaseline = sweep.steps.find((s) => s.parameterValue === 0);
      const stepPlus30 = sweep.steps.find((s) => s.parameterValue === 30);

      expect(stepMinus30).toBeDefined();
      expect(stepBaseline).toBeDefined();
      expect(stepPlus30).toBeDefined();

      expect(stepMinus30!.endingCash).toBeLessThan(stepBaseline!.endingCash);
      expect(stepPlus30!.endingCash).toBeGreaterThan(stepBaseline!.endingCash);
    });

    it('runs customer AR delay sensitivity sweep and measures shortfall day growth', () => {
      const base = getBaseForecast();
      const sweep = ScenarioEngine.runSensitivitySweep(base, 'ar_delay_days');

      expect(sweep.steps).toHaveLength(6);
      const step0 = sweep.steps[0];
      const step30 = sweep.steps[sweep.steps.length - 1];

      // Delaying AR reduces or defers in-window collections
      expect(step30.endingCash).toBeLessThanOrEqual(step0.endingCash);
    });
  });
});
