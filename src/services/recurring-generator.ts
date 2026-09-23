/**
 * Recurring Cash Flow Generation Engine
 * CashFlow Intelligence — Phase 4: Deterministic 30-Day Cash-Flow Forecasting Engine
 *
 * Generates deterministic occurrences for recurring flows across daily, weekly,
 * biweekly, monthly, quarterly, and annual intervals with month-end boundary clamping.
 */

import type { Database } from '../types/database';

export type RecurringFlowRow = Database['public']['Tables']['recurring_cash_flows']['Row'];
export type RecurringFrequency = RecurringFlowRow['frequency'];

export interface RecurringOccurrence {
  recurringFlowId: string;
  name: string;
  flowType: 'inflow' | 'outflow';
  category: string;
  amount: number;
  scheduledDate: string; // YYYY-MM-DD
  frequency: RecurringFrequency;
}

/**
 * Return days in a given year and month (1-indexed month: 1=Jan, 12=Dec)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Format Date to UTC 'YYYY-MM-DD'
 */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Parse 'YYYY-MM-DD' into UTC Date at 00:00:00
 */
export function parseIsoDateUtc(isoStr: string): Date {
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export class RecurringFlowGenerator {
  /**
   * Generates all occurrences of a recurring flow within the forecast window [startDate, endDate]
   */
  static generateOccurrencesForFlow(
    flow: RecurringFlowRow,
    forecastStartDate: string,
    forecastEndDate: string
  ): RecurringOccurrence[] {
    if (!flow.is_active || flow.amount <= 0) {
      return [];
    }

    const occurrences: RecurringOccurrence[] = [];
    const scheduledDatesSet = new Set<string>();

    const nextDate = flow.next_occurrence_date.slice(0, 10);
    const flowEndDate = flow.end_date ? flow.end_date.slice(0, 10) : null;

    // Window boundaries
    const winStart = forecastStartDate;
    const winEnd = flowEndDate && flowEndDate < forecastEndDate ? flowEndDate : forecastEndDate;

    if (nextDate > winEnd) {
      return [];
    }

    const baseDate = parseIsoDateUtc(nextDate);
    const anchorDayOfMonth = baseDate.getUTCDate();

    switch (flow.frequency) {
      case 'daily': {
        const curr = new Date(baseDate);
        while (toIsoDate(curr) <= winEnd) {
          const iso = toIsoDate(curr);
          if (iso >= winStart && !scheduledDatesSet.has(iso)) {
            scheduledDatesSet.add(iso);
            occurrences.push(this.buildOccurrence(flow, iso));
          }
          curr.setUTCDate(curr.getUTCDate() + 1);
        }
        break;
      }

      case 'weekly': {
        const curr = new Date(baseDate);
        while (toIsoDate(curr) <= winEnd) {
          const iso = toIsoDate(curr);
          if (iso >= winStart && !scheduledDatesSet.has(iso)) {
            scheduledDatesSet.add(iso);
            occurrences.push(this.buildOccurrence(flow, iso));
          }
          curr.setUTCDate(curr.getUTCDate() + 7);
        }
        break;
      }

      case 'biweekly': {
        const curr = new Date(baseDate);
        while (toIsoDate(curr) <= winEnd) {
          const iso = toIsoDate(curr);
          if (iso >= winStart && !scheduledDatesSet.has(iso)) {
            scheduledDatesSet.add(iso);
            occurrences.push(this.buildOccurrence(flow, iso));
          }
          curr.setUTCDate(curr.getUTCDate() + 14);
        }
        break;
      }

      case 'monthly': {
        let year = baseDate.getUTCFullYear();
        let month = baseDate.getUTCMonth(); // 0-indexed

        for (let step = 0; step < 24; step++) {
          const maxDays = getDaysInMonth(year, month + 1);
          const clampedDay = Math.min(anchorDayOfMonth, maxDays);
          const curr = new Date(Date.UTC(year, month, clampedDay));
          const iso = toIsoDate(curr);

          if (iso >= nextDate && iso <= winEnd) {
            if (iso >= winStart && !scheduledDatesSet.has(iso)) {
              scheduledDatesSet.add(iso);
              occurrences.push(this.buildOccurrence(flow, iso));
            }
          } else if (iso > winEnd) {
            break;
          }

          month += 1;
          if (month > 11) {
            month = 0;
            year += 1;
          }
        }
        break;
      }

      case 'quarterly': {
        let year = baseDate.getUTCFullYear();
        let month = baseDate.getUTCMonth();

        for (let step = 0; step < 8; step++) {
          const maxDays = getDaysInMonth(year, month + 1);
          const clampedDay = Math.min(anchorDayOfMonth, maxDays);
          const curr = new Date(Date.UTC(year, month, clampedDay));
          const iso = toIsoDate(curr);

          if (iso >= nextDate && iso <= winEnd) {
            if (iso >= winStart && !scheduledDatesSet.has(iso)) {
              scheduledDatesSet.add(iso);
              occurrences.push(this.buildOccurrence(flow, iso));
            }
          } else if (iso > winEnd) {
            break;
          }

          month += 3;
          while (month > 11) {
            month -= 12;
            year += 1;
          }
        }
        break;
      }

      case 'annually': {
        let year = baseDate.getUTCFullYear();
        const month = baseDate.getUTCMonth();

        for (let step = 0; step < 3; step++) {
          const maxDays = getDaysInMonth(year, month + 1);
          const clampedDay = Math.min(anchorDayOfMonth, maxDays);
          const curr = new Date(Date.UTC(year, month, clampedDay));
          const iso = toIsoDate(curr);

          if (iso >= nextDate && iso <= winEnd) {
            if (iso >= winStart && !scheduledDatesSet.has(iso)) {
              scheduledDatesSet.add(iso);
              occurrences.push(this.buildOccurrence(flow, iso));
            }
          } else if (iso > winEnd) {
            break;
          }

          year += 1;
        }
        break;
      }
    }

    return occurrences;
  }

  /**
   * Generates occurrences for a batch of recurring flows within the forecast window
   */
  static generateBatchOccurrences(
    flows: readonly RecurringFlowRow[],
    forecastStartDate: string,
    forecastEndDate: string
  ): RecurringOccurrence[] {
    const results: RecurringOccurrence[] = [];
    for (const flow of flows) {
      const occs = this.generateOccurrencesForFlow(flow, forecastStartDate, forecastEndDate);
      results.push(...occs);
    }
    // Sort chronologically
    return results.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }

  private static buildOccurrence(flow: RecurringFlowRow, scheduledDate: string): RecurringOccurrence {
    return {
      recurringFlowId: flow.id,
      name: flow.name,
      flowType: flow.flow_type,
      category: flow.category,
      amount: flow.amount,
      scheduledDate,
      frequency: flow.frequency,
    };
  }
}
