/**
 * Deterministic 30-Day Cash-Flow Forecasting Engine
 * CashFlow Intelligence — Phase 4: Deterministic 30-Day Cash-Flow Forecasting Engine
 *
 * Implements authoritative mathematical cash-flow projection, AR/AP scheduling,
 * recurring flow occurrences, threshold monitoring, risk indicators, and explanation audits.
 *
 * Authoritative Formulas:
 *   Ending Cash(t) = Beginning Cash(t) + Expected Inflows(t) - Expected Outflows(t)
 *   Beginning Cash(t + 1) = Ending Cash(t)
 *   Net Cash Flow(t) = Expected Inflows(t) - Expected Outflows(t)
 */

import { MonetaryMath } from './financial-calculator';
import { RecurringFlowGenerator, parseIsoDateUtc, toIsoDate, RecurringFlowRow } from './recurring-generator';
import type { Database } from '../types/database';

export type BankAccountRow = Database['public']['Tables']['bank_accounts']['Row'];
export type TransactionRow = Database['public']['Tables']['financial_transactions']['Row'];
export type ReceivableRow = Database['public']['Tables']['accounts_receivable']['Row'];
export type PayableRow = Database['public']['Tables']['accounts_payable']['Row'];
export type CustomerRow = Database['public']['Tables']['customers']['Row'];
export type SupplierRow = Database['public']['Tables']['suppliers']['Row'];

export type ForecastScenario = 'expected' | 'optimistic' | 'pessimistic';
export type CertaintyLevel = 'CONFIRMED' | 'EXPECTED' | 'ASSUMED';
export type ThresholdStatus = 'above_threshold' | 'approaching_threshold' | 'below_threshold';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ForecastItem {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'inflow' | 'outflow';
  category: string;
  amount: number;
  source: 'accounts_receivable' | 'accounts_payable' | 'recurring_cash_flow' | 'future_transaction' | 'assumption';
  description: string;
  certainty: CertaintyLevel;
  entityId: string | null;
  schedulingMethod: string;
  metadata: Record<string, any>;
}

export interface DailyForecastDay {
  date: string; // YYYY-MM-DD
  dayIndex: number;
  dayOfWeek: string;
  beginningCash: number;
  expectedInflows: number;
  expectedOutflows: number;
  netCashFlow: number;
  endingCash: number;
  thresholdStatus: ThresholdStatus;
  shortfallDeficit: number;
  riskFactors: string[];
  items: ForecastItem[];
}

export interface ForecastRiskIndicator {
  code: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  affectedDate?: string;
  metricValue?: number;
}

export interface ForecastSummary {
  totalExpectedInflows: number;
  totalExpectedOutflows: number;
  netCashFlow: number;
  minimumProjectedCash: number;
  shortfallDays: number;
  riskLevel: RiskSeverity;
  riskIndicators: ForecastRiskIndicator[];
}

export interface ForecastEngineInput {
  organizationId: string;
  startDate: string; // YYYY-MM-DD
  horizonDays?: number; // default 30
  timezone?: string; // default UTC
  scenario?: ForecastScenario; // default 'expected'
  minimumCashThreshold?: number; // default 50000
  openingCashOverride?: number;
  bankAccounts?: readonly BankAccountRow[];
  historicalTransactions?: readonly TransactionRow[];
  futureTransactions?: readonly TransactionRow[];
  receivables?: readonly ReceivableRow[];
  payables?: readonly PayableRow[];
  recurringFlows?: readonly RecurringFlowRow[];
  customers?: readonly CustomerRow[];
  suppliers?: readonly SupplierRow[];
  assumptions?: Record<string, any>;
}

export interface ForecastEngineOutput {
  forecastId: string;
  organizationId: string;
  forecastVersion: number;
  scenario: ForecastScenario;
  startDate: string;
  endDate: string;
  horizonDays: number;
  timezone: string;
  openingCash: number;
  minimumCashThreshold: number;
  summary: ForecastSummary;
  dailyForecast: DailyForecastDay[];
  allForecastItems: ForecastItem[];
  generationTimestamp: string;
  assumptionsSnapshot: Record<string, any>;
  explanation: {
    inflowBreakdownByCategory: Record<string, number>;
    outflowBreakdownByCategory: Record<string, number>;
    inflowBreakdownBySource: Record<string, number>;
    outflowBreakdownBySource: Record<string, number>;
    certaintyDistribution: Record<CertaintyLevel, number>;
    overdueReceivablesCount: number;
    overduePayablesCount: number;
    shortfallDates: string[];
  };
}

export class ForecastEngine {
  /**
   * Helper: Add calendar days to an ISO string
   */
  static addDays(dateStr: string, days: number): string {
    const d = parseIsoDateUtc(dateStr);
    d.setUTCDate(d.getUTCDate() + days);
    return toIsoDate(d);
  }

  /**
   * Helper: Get weekday name
   */
  static getDayOfWeek(dateStr: string): string {
    const d = parseIsoDateUtc(dateStr);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames[d.getUTCDay()];
  }

  /**
   * Determine opening cash balance safely without double-counting
   */
  static calculateOpeningCash(
    accounts?: readonly BankAccountRow[],
    overrideCash?: number
  ): number {
    if (typeof overrideCash === 'number' && isFinite(overrideCash)) {
      return MonetaryMath.round(overrideCash);
    }

    if (!accounts || accounts.length === 0) {
      return 0.00;
    }

    let totalCents = 0;
    for (const acc of accounts) {
      if (acc.is_active) {
        // Use current_balance if populated, else opening_balance
        const bal = typeof acc.current_balance === 'number' ? acc.current_balance : (acc.opening_balance || 0);
        totalCents += MonetaryMath.toCents(bal);
      }
    }

    return MonetaryMath.fromCents(totalCents);
  }

  /**
   * Core 17-Step Forecast Pipeline Execution
   */
  static runForecast(input: ForecastEngineInput): ForecastEngineOutput {
    const horizonDays = input.horizonDays && input.horizonDays > 0 ? input.horizonDays : 30;
    const startDate = input.startDate.slice(0, 10);
    const endDate = this.addDays(startDate, horizonDays - 1);
    const timezone = input.timezone || 'UTC';
    const scenario: ForecastScenario = input.scenario || 'expected';
    const minimumThreshold = typeof input.minimumCashThreshold === 'number' ? input.minimumCashThreshold : 50000;
    const generationTimestamp = new Date().toISOString();

    // 1 & 2: Determine opening cash balance
    const openingCash = this.calculateOpeningCash(input.bankAccounts, input.openingCashOverride);

    // 3: Generate 30 date slots
    const forecastDates: string[] = [];
    for (let i = 0; i < horizonDays; i++) {
      forecastDates.push(this.addDays(startDate, i));
    }

    // Customer & Supplier maps for quick lookup of payment behavior
    const customerMap = new Map<string, CustomerRow>();
    if (input.customers) {
      for (const c of input.customers) customerMap.set(c.id, c);
    }

    const supplierMap = new Map<string, SupplierRow>();
    if (input.suppliers) {
      for (const s of input.suppliers) supplierMap.set(s.id, s);
    }

    const forecastItems: ForecastItem[] = [];
    let overdueReceivablesCount = 0;
    let overduePayablesCount = 0;

    // 4 & 5: Load eligible future transactions
    if (input.futureTransactions && input.futureTransactions.length > 0) {
      for (const tx of input.futureTransactions) {
        if (tx.status === 'cancelled') continue;
        const txDate = tx.transaction_date.slice(0, 10);

        if (txDate >= startDate && txDate <= endDate) {
          const certainty: CertaintyLevel = tx.status === 'completed' ? 'CONFIRMED' : 'EXPECTED';
          forecastItems.push({
            id: `tx-${tx.id}`,
            date: txDate,
            type: tx.transaction_type,
            category: tx.category || (tx.transaction_type === 'inflow' ? 'Cash Sales' : 'Operating Expense'),
            amount: tx.amount,
            source: 'future_transaction',
            description: tx.description || `${tx.counterparty} - Future Transaction`,
            certainty,
            entityId: tx.id,
            schedulingMethod: 'scheduled_transaction_date',
            metadata: {
              counterparty: tx.counterparty,
              referenceNumber: tx.reference_number,
              status: tx.status,
            },
          });
        }
      }
    }

    // 6: Schedule Accounts Receivable collections
    if (input.receivables && input.receivables.length > 0) {
      for (const ar of input.receivables) {
        if (ar.status === 'paid' || ar.status === 'cancelled' || ar.outstanding_amount <= 0) {
          continue;
        }

        const customer = ar.customer_id ? customerMap.get(ar.customer_id) : undefined;
        let scheduledDate: string;
        let schedulingMethod: string;

        // Priority 1: Explicit expected collection date
        if (ar.expected_collection_date) {
          scheduledDate = ar.expected_collection_date.slice(0, 10);
          schedulingMethod = 'expected_collection_date';
        } else if (customer && typeof customer.average_payment_delay_days === 'number') {
          // Priority 2: Customer historical delay
          const delayDays = Math.round(customer.average_payment_delay_days);
          scheduledDate = this.addDays(ar.due_date.slice(0, 10), delayDays);
          schedulingMethod = 'customer_historical_delay';
        } else {
          // Priority 3: Invoice due date
          scheduledDate = ar.due_date.slice(0, 10);
          schedulingMethod = 'invoice_due_date';
        }

        // Apply Scenario Adjustments
        if (scenario === 'optimistic') {
          // Collected 3 days earlier, but not before invoice date
          const invoiceDate = ar.invoice_date.slice(0, 10);
          const candidateDate = this.addDays(scheduledDate, -3);
          scheduledDate = candidateDate < invoiceDate ? invoiceDate : candidateDate;
        } else if (scenario === 'pessimistic') {
          // Delayed by 7 days
          scheduledDate = this.addDays(scheduledDate, 7);
        }

        // Handle overdue receivables
        const isOverdue = scheduledDate < startDate;
        if (isOverdue) {
          overdueReceivablesCount++;
          // In deterministic scheduling, overdue collections are scheduled for immediate collection attempt on Day 0 (startDate)
          scheduledDate = startDate;
          schedulingMethod = `${schedulingMethod}_overdue_realigned`;
        }

        // If scheduled within the forecast window, add forecast item
        if (scheduledDate >= startDate && scheduledDate <= endDate) {
          forecastItems.push({
            id: `ar-${ar.id}`,
            date: scheduledDate,
            type: 'inflow',
            category: 'Accounts Receivable Collection',
            amount: ar.outstanding_amount,
            source: 'accounts_receivable',
            description: `Collection for ${ar.invoice_number} (${isOverdue ? 'Overdue' : 'Outstanding'})`,
            certainty: isOverdue ? 'ASSUMED' : 'EXPECTED',
            entityId: ar.id,
            schedulingMethod,
            metadata: {
              invoiceNumber: ar.invoice_number,
              invoiceDate: ar.invoice_date,
              dueDate: ar.due_date,
              originalExpectedDate: ar.expected_collection_date,
              isOverdue,
              customerName: customer?.name || 'Customer',
            },
          });
        }
      }
    }

    // 7: Schedule Accounts Payable obligations
    if (input.payables && input.payables.length > 0) {
      for (const ap of input.payables) {
        if (ap.status === 'paid' || ap.status === 'cancelled' || ap.outstanding_amount <= 0) {
          continue;
        }

        const supplier = ap.supplier_id ? supplierMap.get(ap.supplier_id) : undefined;
        let scheduledDate: string;
        let schedulingMethod: string;

        // Priority 1: Explicit expected payment date
        if (ap.expected_payment_date) {
          scheduledDate = ap.expected_payment_date.slice(0, 10);
          schedulingMethod = 'expected_payment_date';
        } else {
          // Priority 2: Invoice due date
          scheduledDate = ap.due_date.slice(0, 10);
          schedulingMethod = 'invoice_due_date';
        }

        // Apply Scenario Adjustments
        if (scenario === 'optimistic') {
          // Supplier gives grace period: +3 days delay before cash leaves
          scheduledDate = this.addDays(scheduledDate, 3);
        } else if (scenario === 'pessimistic') {
          // Strict on-time or immediate payment (no delay)
          scheduledDate = scheduledDate;
        }

        const isOverdue = scheduledDate < startDate;
        if (isOverdue) {
          overduePayablesCount++;
          scheduledDate = startDate;
          schedulingMethod = `${schedulingMethod}_overdue_urgent`;
        }

        if (scheduledDate >= startDate && scheduledDate <= endDate) {
          forecastItems.push({
            id: `ap-${ap.id}`,
            date: scheduledDate,
            type: 'outflow',
            category: 'Supplier Payment',
            amount: ap.outstanding_amount,
            source: 'accounts_payable',
            description: `Payment for AP ${ap.invoice_number} (${isOverdue ? 'Overdue' : 'Pending'})`,
            certainty: 'CONFIRMED', // verified legal obligation
            entityId: ap.id,
            schedulingMethod,
            metadata: {
              invoiceNumber: ap.invoice_number,
              dueDate: ap.due_date,
              isOverdue,
              supplierName: supplier?.name || 'Supplier',
            },
          });
        }
      }
    }

    // 8: Generate recurring cash-flow occurrences
    if (input.recurringFlows && input.recurringFlows.length > 0) {
      const occurrences = RecurringFlowGenerator.generateBatchOccurrences(
        input.recurringFlows,
        startDate,
        endDate
      );

      for (const occ of occurrences) {
        let amount = occ.amount;
        // In pessimistic scenario, operational expenses increase by 5%
        if (scenario === 'pessimistic' && occ.flowType === 'outflow') {
          amount = MonetaryMath.round(amount * 1.05);
        }

        forecastItems.push({
          id: `rec-${occ.recurringFlowId}-${occ.scheduledDate}`,
          date: occ.scheduledDate,
          type: occ.flowType,
          category: occ.category,
          amount,
          source: 'recurring_cash_flow',
          description: `${occ.name} (${occ.frequency})`,
          certainty: 'EXPECTED',
          entityId: occ.recurringFlowId,
          schedulingMethod: 'recurring_schedule_rule',
          metadata: {
            frequency: occ.frequency,
            originalAmount: occ.amount,
          },
        });
      }
    }

    // 9, 10, 11, 12, 13: Group by date and roll daily balance
    const itemsByDate = new Map<string, ForecastItem[]>();
    for (const d of forecastDates) {
      itemsByDate.set(d, []);
    }
    for (const item of forecastItems) {
      if (itemsByDate.has(item.date)) {
        itemsByDate.get(item.date)!.push(item);
      }
    }

    const dailyForecast: DailyForecastDay[] = [];
    let rollingBeginningCash = openingCash;
    let minProjectedCash = openingCash;
    let shortfallDaysCount = 0;
    const shortfallDates: string[] = [];

    let grandInflowsCents = 0;
    let grandOutflowsCents = 0;

    for (let dayIdx = 0; dayIdx < forecastDates.length; dayIdx++) {
      const dateStr = forecastDates[dayIdx];
      const dayItems = itemsByDate.get(dateStr) || [];

      let dayInflowsCents = 0;
      let dayOutflowsCents = 0;

      for (const item of dayItems) {
        const cents = MonetaryMath.toCents(item.amount);
        if (item.type === 'inflow') {
          dayInflowsCents += cents;
        } else {
          dayOutflowsCents += cents;
        }
      }

      grandInflowsCents += dayInflowsCents;
      grandOutflowsCents += dayOutflowsCents;

      const expectedInflows = MonetaryMath.fromCents(dayInflowsCents);
      const expectedOutflows = MonetaryMath.fromCents(dayOutflowsCents);
      const netCashFlow = MonetaryMath.subtract(expectedInflows, expectedOutflows);
      const endingCash = MonetaryMath.add(rollingBeginningCash, netCashFlow);

      if (endingCash < minProjectedCash) {
        minProjectedCash = endingCash;
      }

      // Threshold check
      let thresholdStatus: ThresholdStatus = 'above_threshold';
      let shortfallDeficit = 0.00;

      if (endingCash < minimumThreshold) {
        thresholdStatus = 'below_threshold';
        shortfallDeficit = MonetaryMath.subtract(minimumThreshold, endingCash);
        shortfallDaysCount++;
        shortfallDates.push(dateStr);
      } else if (endingCash < minimumThreshold * 1.15) {
        thresholdStatus = 'approaching_threshold';
      }

      // Daily risk factors
      const dailyRisks: string[] = [];
      if (endingCash < 0) {
        dailyRisks.push('NEGATIVE_CASH_BALANCE');
      }
      if (thresholdStatus === 'below_threshold') {
        dailyRisks.push(`MINIMUM_THRESHOLD_BREACH (Deficit: ${shortfallDeficit})`);
      }
      if (expectedOutflows > 0 && rollingBeginningCash > 0 && expectedOutflows > rollingBeginningCash * 0.25) {
        dailyRisks.push('LARGE_OUTFLOW_SPIKE (>25% of starting cash)');
      }

      dailyForecast.push({
        date: dateStr,
        dayIndex: dayIdx,
        dayOfWeek: this.getDayOfWeek(dateStr),
        beginningCash: rollingBeginningCash,
        expectedInflows,
        expectedOutflows,
        netCashFlow,
        endingCash,
        thresholdStatus,
        shortfallDeficit,
        riskFactors: dailyRisks,
        items: dayItems,
      });

      // Roll forward to next calendar day
      rollingBeginningCash = endingCash;
    }

    // 14: Assign Comprehensive Risk Indicators
    const riskIndicators: ForecastRiskIndicator[] = [];

    if (minProjectedCash < 0) {
      riskIndicators.push({
        code: 'NEGATIVE_CASH_PROJECTED',
        severity: 'critical',
        title: 'Projected Cash Deficit (Insolvency Risk)',
        description: `Cash balance is projected to fall below zero (minimum: ${minProjectedCash.toLocaleString()}) within the next 30 days.`,
        metricValue: minProjectedCash,
      });
    }

    if (shortfallDaysCount > 0) {
      riskIndicators.push({
        code: 'LIQUIDITY_BUFFER_BREACH',
        severity: shortfallDaysCount > 7 ? 'high' : 'medium',
        title: 'Minimum Operating Cash Breach',
        description: `Projected cash drops below the required minimum threshold of ${minimumThreshold.toLocaleString()} on ${shortfallDaysCount} days. First breach on ${shortfallDates[0]}.`,
        affectedDate: shortfallDates[0],
        metricValue: shortfallDaysCount,
      });
    }

    if (overduePayablesCount > 0) {
      riskIndicators.push({
        code: 'OVERDUE_PAYABLES_PRESSURE',
        severity: 'high',
        title: 'Urgent Overdue Supplier Obligations',
        description: `${overduePayablesCount} accounts payable are overdue and scheduled for immediate disbursement.`,
        metricValue: overduePayablesCount,
      });
    }

    if (overdueReceivablesCount > 0) {
      riskIndicators.push({
        code: 'OVERDUE_RECEIVABLES_UNCERTAINTY',
        severity: 'medium',
        title: 'Overdue Receivables Delayed',
        description: `${overdueReceivablesCount} receivables have exceeded their original due dates, increasing collection uncertainty.`,
        metricValue: overdueReceivablesCount,
      });
    }

    // Overall Risk Level
    let overallRisk: RiskSeverity = 'low';
    if (minProjectedCash < 0) {
      overallRisk = 'critical';
    } else if (shortfallDaysCount > 5 || overduePayablesCount > 2) {
      overallRisk = 'high';
    } else if (shortfallDaysCount > 0 || overdueReceivablesCount > 0) {
      overallRisk = 'medium';
    }

    // 15, 16, 17: Summaries & Explanation Breakdown
    const totalExpectedInflows = MonetaryMath.fromCents(grandInflowsCents);
    const totalExpectedOutflows = MonetaryMath.fromCents(grandOutflowsCents);
    const netCashFlow = MonetaryMath.subtract(totalExpectedInflows, totalExpectedOutflows);

    const inflowBreakdownByCategory: Record<string, number> = {};
    const outflowBreakdownByCategory: Record<string, number> = {};
    const inflowBreakdownBySource: Record<string, number> = {};
    const outflowBreakdownBySource: Record<string, number> = {};
    const certaintyDistribution: Record<CertaintyLevel, number> = {
      CONFIRMED: 0,
      EXPECTED: 0,
      ASSUMED: 0,
    };

    for (const item of forecastItems) {
      certaintyDistribution[item.certainty] = (certaintyDistribution[item.certainty] || 0) + item.amount;
      if (item.type === 'inflow') {
        inflowBreakdownByCategory[item.category] = MonetaryMath.add(inflowBreakdownByCategory[item.category] || 0, item.amount);
        inflowBreakdownBySource[item.source] = MonetaryMath.add(inflowBreakdownBySource[item.source] || 0, item.amount);
      } else {
        outflowBreakdownByCategory[item.category] = MonetaryMath.add(outflowBreakdownByCategory[item.category] || 0, item.amount);
        outflowBreakdownBySource[item.source] = MonetaryMath.add(outflowBreakdownBySource[item.source] || 0, item.amount);
      }
    }

    const assumptionsSnapshot = {
      scenario,
      minimumCashThreshold: minimumThreshold,
      openingCashBalance: openingCash,
      arScenarioShiftDays: scenario === 'optimistic' ? -3 : scenario === 'pessimistic' ? 7 : 0,
      apScenarioGraceDays: scenario === 'optimistic' ? 3 : 0,
      recurringExpenseMultiplier: scenario === 'pessimistic' ? 1.05 : 1.0,
      userAssumptions: input.assumptions || {},
    };

    return {
      forecastId: `fc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      organizationId: input.organizationId,
      forecastVersion: 1, // Will be incremented on persistence
      scenario,
      startDate,
      endDate,
      horizonDays,
      timezone,
      openingCash,
      minimumCashThreshold: minimumThreshold,
      summary: {
        totalExpectedInflows,
        totalExpectedOutflows,
        netCashFlow,
        minimumProjectedCash: minProjectedCash,
        shortfallDays: shortfallDaysCount,
        riskLevel: overallRisk,
        riskIndicators,
      },
      dailyForecast,
      allForecastItems: forecastItems,
      generationTimestamp,
      assumptionsSnapshot,
      explanation: {
        inflowBreakdownByCategory,
        outflowBreakdownByCategory,
        inflowBreakdownBySource,
        outflowBreakdownBySource,
        certaintyDistribution,
        overdueReceivablesCount,
        overduePayablesCount,
        shortfallDates,
      },
    };
  }
}
