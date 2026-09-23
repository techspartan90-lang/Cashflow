/**
 * Financial Calculation Service (Backend Foundation)
 * CashFlow Intelligence — Phase 2: Database Schema & Financial Foundation
 *
 * Implements deterministic, decimal-safe monetary calculations.
 * Avoids IEEE-754 binary floating-point representation drift via cents fixed-point math.
 */

import type { Database } from '../types/database';

type TransactionRow = Database['public']['Tables']['financial_transactions']['Row'];
type ReceivableRow = Database['public']['Tables']['accounts_receivable']['Row'];
type PayableRow = Database['public']['Tables']['accounts_payable']['Row'];

/**
 * Monetary Arithmetic Helper
 * Converts numbers to integer cents to avoid binary float precision anomalies (e.g. 0.1 + 0.2 = 0.30000000000000004)
 */
export const MonetaryMath = {
  toCents(amount: number): number {
    if (typeof amount !== 'number' || !isFinite(amount)) {
      throw new Error(`Invalid monetary amount: expected finite number, received ${amount}`);
    }
    return Math.round(amount * 100);
  },

  fromCents(cents: number): number {
    return Math.round(cents) / 100;
  },

  add(a: number, b: number): number {
    return this.fromCents(this.toCents(a) + this.toCents(b));
  },

  subtract(a: number, b: number): number {
    return this.fromCents(this.toCents(a) - this.toCents(b));
  },

  round(amount: number): number {
    return this.fromCents(this.toCents(amount));
  },
};

export interface DateRangeFilter {
  startDate: string; // ISO date 'YYYY-MM-DD'
  endDate: string;   // ISO date 'YYYY-MM-DD'
  includePending?: boolean; // default false (only completed count towards settled cash)
}

export interface CashBreachDay {
  date: string;
  projectedBalance: number;
  threshold: number;
  deficit: number;
}

export interface DayCashProgression {
  date: string;
  beginningCash: number;
  inflows: number;
  outflows: number;
  netCashFlow: number;
  endingCash: number;
  isBreached: boolean;
}

export class FinancialCalculatorService {
  /**
   * 1. Calculate total inflows for a given date range
   */
  static calculateTotalInflows(
    transactions: readonly TransactionRow[],
    filter: DateRangeFilter
  ): number {
    if (!transactions || transactions.length === 0) return 0.0;

    let totalCents = 0;
    for (const tx of transactions) {
      if (tx.transaction_type !== 'inflow') continue;
      if (tx.status === 'cancelled') continue;
      if (!filter.includePending && tx.status === 'pending') continue;

      const txDate = tx.transaction_date.slice(0, 10);
      if (txDate >= filter.startDate && txDate <= filter.endDate) {
        totalCents += MonetaryMath.toCents(tx.amount);
      }
    }

    return MonetaryMath.fromCents(totalCents);
  }

  /**
   * 2. Calculate total outflows for a given date range
   */
  static calculateTotalOutflows(
    transactions: readonly TransactionRow[],
    filter: DateRangeFilter
  ): number {
    if (!transactions || transactions.length === 0) return 0.0;

    let totalCents = 0;
    for (const tx of transactions) {
      if (tx.transaction_type !== 'outflow') continue;
      if (tx.status === 'cancelled') continue;
      if (!filter.includePending && tx.status === 'pending') continue;

      const txDate = tx.transaction_date.slice(0, 10);
      if (txDate >= filter.startDate && txDate <= filter.endDate) {
        totalCents += MonetaryMath.toCents(tx.amount);
      }
    }

    return MonetaryMath.fromCents(totalCents);
  }

  /**
   * 3. Calculate net cash flow: Net Cash Flow = Total Inflows - Total Outflows
   */
  static calculateNetCashFlow(
    transactions: readonly TransactionRow[],
    filter: DateRangeFilter
  ): number {
    const inflows = this.calculateTotalInflows(transactions, filter);
    const outflows = this.calculateTotalOutflows(transactions, filter);
    return MonetaryMath.subtract(inflows, outflows);
  }

  /**
   * 4. Calculate ending cash: Ending Cash = Beginning Cash + Total Inflows - Total Outflows
   */
  static calculateEndingCash(
    beginningCash: number,
    transactions: readonly TransactionRow[],
    filter: DateRangeFilter
  ): number {
    const netCashFlow = this.calculateNetCashFlow(transactions, filter);
    return MonetaryMath.add(beginningCash, netCashFlow);
  }

  /**
   * 5. Calculate total outstanding accounts receivable
   */
  static calculateOutstandingReceivables(
    receivables: readonly ReceivableRow[],
    asOfDate?: string
  ): number {
    if (!receivables || receivables.length === 0) return 0.0;

    let totalCents = 0;
    for (const ar of receivables) {
      if (ar.status === 'paid' || ar.status === 'cancelled') continue;
      if (asOfDate && ar.invoice_date.slice(0, 10) > asOfDate) continue;

      totalCents += MonetaryMath.toCents(ar.outstanding_amount);
    }

    return MonetaryMath.fromCents(totalCents);
  }

  /**
   * 6. Calculate total outstanding accounts payable
   */
  static calculateOutstandingPayables(
    payables: readonly PayableRow[],
    asOfDate?: string
  ): number {
    if (!payables || payables.length === 0) return 0.0;

    let totalCents = 0;
    for (const ap of payables) {
      if (ap.status === 'paid' || ap.status === 'cancelled') continue;
      if (asOfDate && ap.invoice_date.slice(0, 10) > asOfDate) continue;

      totalCents += MonetaryMath.toCents(ap.outstanding_amount);
    }

    return MonetaryMath.fromCents(totalCents);
  }

  /**
   * 7. Identify overdue receivables as of a reference date
   */
  static identifyOverdueReceivables(
    receivables: readonly ReceivableRow[],
    asOfDate: string
  ): ReceivableRow[] {
    if (!receivables || receivables.length === 0) return [];

    return receivables.filter((ar) => {
      if (ar.status === 'paid' || ar.status === 'cancelled') return false;
      if (ar.outstanding_amount <= 0) return false;
      const dueDate = ar.due_date.slice(0, 10);
      return dueDate < asOfDate;
    });
  }

  /**
   * 8. Identify overdue payables as of a reference date
   */
  static identifyOverduePayables(
    payables: readonly PayableRow[],
    asOfDate: string
  ): PayableRow[] {
    if (!payables || payables.length === 0) return [];

    return payables.filter((ap) => {
      if (ap.status === 'paid' || ap.status === 'cancelled') return false;
      if (ap.outstanding_amount <= 0) return false;
      const dueDate = ap.due_date.slice(0, 10);
      return dueDate < asOfDate;
    });
  }

  /**
   * 9. Identify dates where cash is below the minimum threshold over a scheduled horizon
   */
  static identifyThresholdBreaches(
    beginningCash: number,
    transactions: readonly TransactionRow[],
    startDate: string,
    horizonDays: number,
    minimumThreshold: number
  ): {
    breaches: CashBreachDay[];
    dailyProgression: DayCashProgression[];
  } {
    const breaches: CashBreachDay[] = [];
    const dailyProgression: DayCashProgression[] = [];

    let currentCash = MonetaryMath.round(beginningCash);

    for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
      const dateObj = new Date(startDate);
      dateObj.setUTCDate(dateObj.getUTCDate() + dayOffset);
      const dateStr = dateObj.toISOString().slice(0, 10);

      const dayFilter: DateRangeFilter = {
        startDate: dateStr,
        endDate: dateStr,
        includePending: false,
      };

      const dayInflows = this.calculateTotalInflows(transactions, dayFilter);
      const dayOutflows = this.calculateTotalOutflows(transactions, dayFilter);
      const dayNet = MonetaryMath.subtract(dayInflows, dayOutflows);
      const dayEndingCash = MonetaryMath.add(currentCash, dayNet);

      const isBreached = dayEndingCash < minimumThreshold;

      if (isBreached) {
        breaches.push({
          date: dateStr,
          projectedBalance: dayEndingCash,
          threshold: minimumThreshold,
          deficit: MonetaryMath.subtract(minimumThreshold, dayEndingCash),
        });
      }

      dailyProgression.push({
        date: dateStr,
        beginningCash: currentCash,
        inflows: dayInflows,
        outflows: dayOutflows,
        netCashFlow: dayNet,
        endingCash: dayEndingCash,
        isBreached,
      });

      currentCash = dayEndingCash;
    }

    return { breaches, dailyProgression };
  }
}
