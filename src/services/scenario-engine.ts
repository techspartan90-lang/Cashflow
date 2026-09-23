/**
 * Scenario Simulation & Decision-Support Engine
 * CashFlow Intelligence — Phase 6
 *
 * Implements deterministic what-if scenario modeling, assumption application,
 * sensitivity analysis parameter sweeps, and objective financial decision support.
 *
 * Core Principle:
 *   Scenario simulations must never mutate actual transactions, actual balances,
 *   or the base forecast. All scenario projections are versioned, isolated, and traceable.
 */

import { MonetaryMath } from './financial-calculator';
import { ForecastEngineOutput, ForecastItem, DailyForecastDay } from './forecast-engine';
import { parseIsoDateUtc, toIsoDate } from './recurring-generator';
import type { Database } from '../types/database';

export type ScenarioRow = Database['public']['Tables']['scenarios']['Row'];
export type ScenarioAssumptionRow = Database['public']['Tables']['scenario_assumptions']['Row'];
export type ScenarioResultRow = Database['public']['Tables']['scenario_results']['Row'];
export type ScenarioResultItemRow = Database['public']['Tables']['scenario_result_items']['Row'];

export interface SimulatedForecastItem {
  id: string;
  originalId?: string;
  scheduledDate: string; // YYYY-MM-DD
  flowType: 'inflow' | 'outflow';
  sourceType: 'base_item' | 'adjusted_item' | 'simulated_event' | 'delayed_receivable';
  sourceId: string | null;
  category: string;
  description: string;
  baseAmount: number;
  amount: number;
  adjustmentAmount: number;
  adjustmentReason: string | null;
  certainty: 'CONFIRMED' | 'EXPECTED' | 'ASSUMED' | 'SIMULATED';
}

export interface ScenarioDailyDay {
  date: string;
  dayIndex: number;
  dayOfWeek: string;
  beginningCash: number;
  inflows: number;
  outflows: number;
  netCashFlow: number;
  endingCash: number;
  baseEndingCash: number;
  cashDelta: number; // endingCash - baseEndingCash
  thresholdStatus: 'above_threshold' | 'approaching_threshold' | 'below_threshold';
  shortfallAmount: number;
  items: SimulatedForecastItem[];
}

export interface ScenarioComparisonSummary {
  scenarioId: string;
  scenarioName: string;
  scenarioType: string;
  baseForecastId: string;
  // Metrics
  baseOpeningCash: number;
  scenarioOpeningCash: number;
  baseTotalInflows: number;
  scenarioTotalInflows: number;
  inflowsDelta: number;
  baseTotalOutflows: number;
  scenarioTotalOutflows: number;
  outflowsDelta: number;
  baseNetCashFlow: number;
  scenarioNetCashFlow: number;
  netCashFlowDelta: number;
  baseEndingCash: number;
  scenarioEndingCash: number;
  endingCashDelta: number;
  baseMinProjectedCash: number;
  scenarioMinProjectedCash: number;
  minProjectedCashDelta: number;
  baseShortfallDays: number;
  scenarioShortfallDays: number;
  shortfallDaysDelta: number;
  firstShortfallDate: string | null;
  maxShortfallDeficit: number;
}

export interface DecisionSupportInsight {
  id: string;
  category: 'liquidity_buffer' | 'ar_delay' | 'expense_shock' | 'revenue_shift' | 'commitment';
  severity: 'info' | 'positive' | 'warning' | 'critical';
  title: string;
  message: string;
  affectedDates?: string[];
  impactAmount?: number;
  drivingAssumptionId?: string;
}

export interface ScenarioSimulationOutput {
  scenarioId: string;
  scenarioName: string;
  scenarioType: string;
  organizationId: string;
  baseForecastId: string;
  calculationTimestamp: string;
  summary: ScenarioComparisonSummary;
  dailyProgression: ScenarioDailyDay[];
  allSimulatedItems: SimulatedForecastItem[];
  outOfWindowDelayedItems: SimulatedForecastItem[];
  appliedAssumptionsCount: number;
  insights: DecisionSupportInsight[];
}

export interface SensitivityStepResult {
  stepIndex: number;
  stepLabel: string;
  parameterValue: number;
  endingCash: number;
  minProjectedCash: number;
  netCashFlow: number;
  shortfallDays: number;
  maxShortfallDeficit: number;
  endingCashDelta: number;
}

export interface SensitivityAnalysisResult {
  variableName: string;
  variableType: 'revenue_multiplier' | 'ar_delay_days' | 'expense_multiplier' | 'one_time_shock';
  baselineValue: number;
  steps: SensitivityStepResult[];
}

export class ScenarioEngine {
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
   * Deterministically validates an assumption before execution
   */
  static validateAssumption(
    assumption: Partial<ScenarioAssumptionRow>,
    forecastStartDate: string,
    forecastEndDate: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!assumption.assumption_type) {
      errors.push('Assumption type is required.');
    }

    if (!assumption.adjustment_method) {
      errors.push('Adjustment method is required.');
    }

    if (typeof assumption.adjustment_value !== 'number' || isNaN(assumption.adjustment_value)) {
      errors.push('Adjustment value must be a valid number.');
    }

    if (assumption.adjustment_method === 'percentage_change') {
      if (assumption.adjustment_value < -100 || assumption.adjustment_value > 500) {
        errors.push('Percentage change must be between -100% and +500%.');
      }
    }

    if (assumption.adjustment_method === 'date_shift') {
      if (assumption.adjustment_value < -30 || assumption.adjustment_value > 90) {
        errors.push('Date shift must be between -30 and +90 days.');
      }
    }

    if (assumption.adjustment_method === 'collection_rate_change') {
      if (assumption.adjustment_value < 0 || assumption.adjustment_value > 1.5) {
        errors.push('Collection rate must be between 0.0 (0%) and 1.5 (150%).');
      }
    }

    if (assumption.start_date && (assumption.start_date < '2000-01-01' || assumption.start_date > '2100-01-01')) {
      errors.push('Invalid start date format.');
    }

    if (assumption.end_date && assumption.start_date && assumption.end_date < assumption.start_date) {
      errors.push('End date cannot precede start date.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute full scenario simulation against an immutable base forecast
   */
  static simulate(
    baseForecast: ForecastEngineOutput,
    scenario: Partial<ScenarioRow>,
    assumptions: readonly ScenarioAssumptionRow[]
  ): ScenarioSimulationOutput {
    const scenarioId = scenario.id || `scen-${Date.now()}`;
    const scenarioName = scenario.name || 'Unnamed Scenario';
    const scenarioType = scenario.scenario_type || 'custom';
    const orgId = baseForecast.organizationId;
    const baseForecastId = baseForecast.forecastId;
    const startDate = baseForecast.startDate;
    const endDate = baseForecast.endDate;
    const minimumThreshold = baseForecast.minimumCashThreshold;
    const horizonDays = baseForecast.horizonDays;
    const calculationTimestamp = new Date().toISOString();

    // 1. Clone base forecast items (Never mutate original base items)
    const simulatedItems: SimulatedForecastItem[] = baseForecast.allForecastItems.map((item) => ({
      id: `sim-${item.id}`,
      originalId: item.id,
      scheduledDate: item.date,
      flowType: item.type,
      sourceType: 'base_item',
      sourceId: item.entityId,
      category: item.category,
      description: item.description,
      baseAmount: item.amount,
      amount: item.amount,
      adjustmentAmount: 0.00,
      adjustmentReason: null,
      certainty: item.certainty,
    }));

    const outOfWindowDelayedItems: SimulatedForecastItem[] = [];

    // 2. Sequentially process assumptions
    for (const asm of assumptions) {
      const asmStart = asm.start_date ? asm.start_date.slice(0, 10) : startDate;
      const asmEnd = asm.end_date ? asm.end_date.slice(0, 10) : endDate;

      switch (asm.assumption_type) {
        // A. REVENUE ADJUSTMENTS
        case 'revenue_adjustment': {
          for (const item of simulatedItems) {
            if (item.flowType !== 'inflow') continue;
            if (item.scheduledDate < asmStart || item.scheduledDate > asmEnd) continue;

            // Target check: category or all
            if (asm.target_type === 'category' && asm.target_id && item.category !== asm.target_id) {
              continue;
            }

            if (asm.adjustment_method === 'percentage_change') {
              const multiplier = 1 + asm.adjustment_value / 100;
              const newAmount = MonetaryMath.round(item.amount * multiplier);
              const delta = MonetaryMath.subtract(newAmount, item.amount);
              item.amount = newAmount;
              item.adjustmentAmount = MonetaryMath.add(item.adjustmentAmount, delta);
              item.sourceType = 'adjusted_item';
              item.certainty = 'SIMULATED';
              item.adjustmentReason = `Revenue changed by ${asm.adjustment_value}% (${asm.description})`;
            } else if (asm.adjustment_method === 'absolute_change') {
              const delta = asm.adjustment_value;
              const newAmount = Math.max(0, MonetaryMath.add(item.amount, delta));
              item.adjustmentAmount = MonetaryMath.add(item.adjustmentAmount, MonetaryMath.subtract(newAmount, item.amount));
              item.amount = newAmount;
              item.sourceType = 'adjusted_item';
              item.certainty = 'SIMULATED';
              item.adjustmentReason = `Revenue adjusted by ${delta} (${asm.description})`;
            }
          }
          break;
        }

        // B. CUSTOMER PAYMENT DELAYS
        case 'customer_delay': {
          for (let i = simulatedItems.length - 1; i >= 0; i--) {
            const item = simulatedItems[i];
            if (item.flowType !== 'inflow') continue;
            // Only apply to receivables
            if (!item.originalId?.startsWith('ar-') && item.category !== 'Accounts Receivable Collection') {
              continue;
            }

            // Target filter: customer or invoice or all
            if (asm.target_type === 'customer' && asm.target_id && item.sourceId !== asm.target_id) {
              continue;
            }
            if (asm.target_type === 'invoice' && asm.target_id && item.sourceId !== asm.target_id) {
              continue;
            }

            if (asm.adjustment_method === 'date_shift') {
              const daysShift = Math.round(asm.adjustment_value);
              const originalDate = item.scheduledDate;
              const newDate = this.addDays(originalDate, daysShift);

              // If shifted beyond horizon, remove from active 30-day projection and track in delayed
              if (newDate > endDate) {
                simulatedItems.splice(i, 1);
                outOfWindowDelayedItems.push({
                  ...item,
                  scheduledDate: newDate,
                  sourceType: 'delayed_receivable',
                  certainty: 'SIMULATED',
                  adjustmentReason: `Collection delayed by ${daysShift} days to ${newDate} (shifted beyond 30-day window)`,
                });
              } else {
                item.scheduledDate = newDate;
                item.sourceType = 'delayed_receivable';
                item.certainty = 'SIMULATED';
                item.adjustmentReason = `Payment delayed by ${daysShift} days (from ${originalDate} to ${newDate})`;
              }
            } else if (asm.adjustment_method === 'collection_rate_change') {
              const rate = asm.adjustment_value; // e.g. 0.8 for 80%
              const newAmount = MonetaryMath.round(item.amount * rate);
              const delta = MonetaryMath.subtract(newAmount, item.amount);
              item.amount = newAmount;
              item.adjustmentAmount = MonetaryMath.add(item.adjustmentAmount, delta);
              item.sourceType = 'adjusted_item';
              item.certainty = 'SIMULATED';
              item.adjustmentReason = `Collection recovery rate adjusted to ${(rate * 100).toFixed(0)}%`;
            }
          }
          break;
        }

        // C. EXPENSE ADJUSTMENTS
        case 'expense_adjustment': {
          for (const item of simulatedItems) {
            if (item.flowType !== 'outflow') continue;
            if (item.scheduledDate < asmStart || item.scheduledDate > asmEnd) continue;

            if (asm.target_type === 'category' && asm.target_id && item.category !== asm.target_id) {
              continue;
            }

            if (asm.adjustment_method === 'percentage_change') {
              const multiplier = 1 + asm.adjustment_value / 100;
              const newAmount = MonetaryMath.round(item.amount * multiplier);
              const delta = MonetaryMath.subtract(newAmount, item.amount);
              item.amount = newAmount;
              item.adjustmentAmount = MonetaryMath.add(item.adjustmentAmount, delta);
              item.sourceType = 'adjusted_item';
              item.certainty = 'SIMULATED';
              item.adjustmentReason = `Expense changed by ${asm.adjustment_value}% (${asm.description})`;
            } else if (asm.adjustment_method === 'absolute_change') {
              const delta = asm.adjustment_value;
              const newAmount = Math.max(0, MonetaryMath.add(item.amount, delta));
              item.adjustmentAmount = MonetaryMath.add(item.adjustmentAmount, MonetaryMath.subtract(newAmount, item.amount));
              item.amount = newAmount;
              item.sourceType = 'adjusted_item';
              item.certainty = 'SIMULATED';
              item.adjustmentReason = `Expense adjusted by ${delta} (${asm.description})`;
            }
          }
          break;
        }

        // D. UNEXPECTED ONE-TIME EXPENSE
        case 'one_time_expense': {
          const eventDate = asm.start_date ? asm.start_date.slice(0, 10) : startDate;
          if (eventDate >= startDate && eventDate <= endDate) {
            const expAmount = Math.abs(asm.adjustment_value);
            simulatedItems.push({
              id: `shock-${asm.id}-${eventDate}`,
              scheduledDate: eventDate,
              flowType: 'outflow',
              sourceType: 'simulated_event',
              sourceId: asm.id,
              category: asm.target_id || 'Unexpected Operational Expense',
              description: asm.description || 'One-time unexpected expense event',
              baseAmount: 0.00,
              amount: expAmount,
              adjustmentAmount: expAmount,
              adjustmentReason: `Unplanned event added on ${eventDate}`,
              certainty: 'SIMULATED',
            });
          }
          break;
        }

        // E. NEW BUSINESS COMMITMENT (e.g. new hire, new equipment lease, loan EMI)
        case 'new_commitment': {
          const commitDate = asm.start_date ? asm.start_date.slice(0, 10) : startDate;
          const commitAmount = Math.abs(asm.adjustment_value);
          const category = asm.target_id || 'Business Commitment';

          if (asm.adjustment_method === 'one_time_event') {
            if (commitDate >= startDate && commitDate <= endDate) {
              simulatedItems.push({
                id: `commit-${asm.id}-${commitDate}`,
                scheduledDate: commitDate,
                flowType: 'outflow',
                sourceType: 'simulated_event',
                sourceId: asm.id,
                category,
                description: asm.description || 'New business commitment',
                baseAmount: 0.00,
                amount: commitAmount,
                adjustmentAmount: commitAmount,
                adjustmentReason: 'New business commitment obligation',
                certainty: 'SIMULATED',
              });
            }
          } else if (asm.adjustment_method === 'recurring_event') {
            // E.g. weekly or monthly recurring commitment starting from commitDate
            let curr = parseIsoDateUtc(commitDate);
            while (toIsoDate(curr) <= endDate) {
              const iso = toIsoDate(curr);
              if (iso >= startDate) {
                simulatedItems.push({
                  id: `commit-rec-${asm.id}-${iso}`,
                  scheduledDate: iso,
                  flowType: 'outflow',
                  sourceType: 'simulated_event',
                  sourceId: asm.id,
                  category,
                  description: asm.description || 'Recurring commitment',
                  baseAmount: 0.00,
                  amount: commitAmount,
                  adjustmentAmount: commitAmount,
                  adjustmentReason: 'Recurring commitment obligation',
                  certainty: 'SIMULATED',
                });
              }
              // Weekly increment as default recurring step unless monthly
              curr.setUTCDate(curr.getUTCDate() + 7);
            }
          }
          break;
        }

        // F. CUSTOM ADJUSTMENTS
        case 'custom': {
          // Standard percentage/absolute fallback
          if (asm.adjustment_method === 'percentage_change') {
            const multiplier = 1 + asm.adjustment_value / 100;
            for (const item of simulatedItems) {
              if (item.scheduledDate >= asmStart && item.scheduledDate <= asmEnd) {
                const newAmount = MonetaryMath.round(item.amount * multiplier);
                item.adjustmentAmount = MonetaryMath.add(item.adjustmentAmount, MonetaryMath.subtract(newAmount, item.amount));
                item.amount = newAmount;
                item.sourceType = 'adjusted_item';
                item.certainty = 'SIMULATED';
                item.adjustmentReason = asm.description;
              }
            }
          }
          break;
        }
      }
    }

    // 3. Group by date and Roll Forward Day by Day
    const itemsByDate = new Map<string, SimulatedForecastItem[]>();
    for (let dayIdx = 0; dayIdx < horizonDays; dayIdx++) {
      const d = this.addDays(startDate, dayIdx);
      itemsByDate.set(d, []);
    }
    for (const item of simulatedItems) {
      if (itemsByDate.has(item.scheduledDate)) {
        itemsByDate.get(item.scheduledDate)!.push(item);
      }
    }

    const baseDaysMap = new Map<string, DailyForecastDay>();
    for (const bd of baseForecast.dailyForecast) {
      baseDaysMap.set(bd.date, bd);
    }

    const dailyProgression: ScenarioDailyDay[] = [];
    let rollingBeginningCash = baseForecast.openingCash;
    let minProjectedCash = rollingBeginningCash;
    let shortfallDaysCount = 0;
    let maxShortfallDeficit = 0.00;
    let firstShortfallDate: string | null = null;

    let grandInflowsCents = 0;
    let grandOutflowsCents = 0;

    for (let dayIdx = 0; dayIdx < horizonDays; dayIdx++) {
      const dateStr = this.addDays(startDate, dayIdx);
      const dayItems = itemsByDate.get(dateStr) || [];
      const baseDay = baseDaysMap.get(dateStr);
      const baseEndingCash = baseDay ? baseDay.endingCash : rollingBeginningCash;

      let dayInflowsCents = 0;
      let dayOutflowsCents = 0;

      for (const item of dayItems) {
        const cents = MonetaryMath.toCents(item.amount);
        if (item.flowType === 'inflow') {
          dayInflowsCents += cents;
        } else {
          dayOutflowsCents += cents;
        }
      }

      grandInflowsCents += dayInflowsCents;
      grandOutflowsCents += dayOutflowsCents;

      const dayInflows = MonetaryMath.fromCents(dayInflowsCents);
      const dayOutflows = MonetaryMath.fromCents(dayOutflowsCents);
      const netCashFlow = MonetaryMath.subtract(dayInflows, dayOutflows);
      const endingCash = MonetaryMath.add(rollingBeginningCash, netCashFlow);
      const cashDelta = MonetaryMath.subtract(endingCash, baseEndingCash);

      if (endingCash < minProjectedCash) {
        minProjectedCash = endingCash;
      }

      // Threshold evaluation
      let thresholdStatus: 'above_threshold' | 'approaching_threshold' | 'below_threshold' = 'above_threshold';
      let shortfallAmount = 0.00;

      if (endingCash < minimumThreshold) {
        thresholdStatus = 'below_threshold';
        shortfallAmount = MonetaryMath.subtract(minimumThreshold, endingCash);
        shortfallDaysCount++;
        if (!firstShortfallDate) {
          firstShortfallDate = dateStr;
        }
        if (shortfallAmount > maxShortfallDeficit) {
          maxShortfallDeficit = shortfallAmount;
        }
      } else if (endingCash < minimumThreshold * 1.15) {
        thresholdStatus = 'approaching_threshold';
      }

      dailyProgression.push({
        date: dateStr,
        dayIndex: dayIdx,
        dayOfWeek: this.getDayOfWeek(dateStr),
        beginningCash: rollingBeginningCash,
        inflows: dayInflows,
        outflows: dayOutflows,
        netCashFlow,
        endingCash,
        baseEndingCash,
        cashDelta,
        thresholdStatus,
        shortfallAmount,
        items: dayItems,
      });

      // Roll forward to next calendar day
      rollingBeginningCash = endingCash;
    }

    // 4. Summaries & Comparison Metrics
    const scenarioTotalInflows = MonetaryMath.fromCents(grandInflowsCents);
    const scenarioTotalOutflows = MonetaryMath.fromCents(grandOutflowsCents);
    const scenarioNetCashFlow = MonetaryMath.subtract(scenarioTotalInflows, scenarioTotalOutflows);
    const scenarioEndingCash = dailyProgression.length > 0 ? dailyProgression[dailyProgression.length - 1].endingCash : rollingBeginningCash;

    const baseEndingCash = baseForecast.dailyForecast.length > 0
      ? baseForecast.dailyForecast[baseForecast.dailyForecast.length - 1].endingCash
      : baseForecast.openingCash;

    const summary: ScenarioComparisonSummary = {
      scenarioId,
      scenarioName,
      scenarioType,
      baseForecastId,
      baseOpeningCash: baseForecast.openingCash,
      scenarioOpeningCash: baseForecast.openingCash,
      baseTotalInflows: baseForecast.summary.totalExpectedInflows,
      scenarioTotalInflows,
      inflowsDelta: MonetaryMath.subtract(scenarioTotalInflows, baseForecast.summary.totalExpectedInflows),
      baseTotalOutflows: baseForecast.summary.totalExpectedOutflows,
      scenarioTotalOutflows,
      outflowsDelta: MonetaryMath.subtract(scenarioTotalOutflows, baseForecast.summary.totalExpectedOutflows),
      baseNetCashFlow: baseForecast.summary.netCashFlow,
      scenarioNetCashFlow,
      netCashFlowDelta: MonetaryMath.subtract(scenarioNetCashFlow, baseForecast.summary.netCashFlow),
      baseEndingCash,
      scenarioEndingCash,
      endingCashDelta: MonetaryMath.subtract(scenarioEndingCash, baseEndingCash),
      baseMinProjectedCash: baseForecast.summary.minimumProjectedCash,
      scenarioMinProjectedCash: minProjectedCash,
      minProjectedCashDelta: MonetaryMath.subtract(minProjectedCash, baseForecast.summary.minimumProjectedCash),
      baseShortfallDays: baseForecast.summary.shortfallDays,
      scenarioShortfallDays: shortfallDaysCount,
      shortfallDaysDelta: shortfallDaysCount - baseForecast.summary.shortfallDays,
      firstShortfallDate,
      maxShortfallDeficit,
    };

    // 5. Decision-Support Insights Generation (Deterministic, Factual)
    const insights: DecisionSupportInsight[] = [];

    // Shortfall Insight
    if (shortfallDaysCount > baseForecast.summary.shortfallDays) {
      const addedDays = shortfallDaysCount - baseForecast.summary.shortfallDays;
      insights.push({
        id: `ins-shortfall-${Date.now()}`,
        category: 'liquidity_buffer',
        severity: 'critical',
        title: 'Projected Liquidity Threshold Breach',
        message: `This scenario increases liquidity shortfall by ${addedDays} day(s). Ending cash breaches the minimum operating threshold of ${minimumThreshold.toLocaleString()} starting on ${firstShortfallDate}, reaching a maximum simulated deficit of ${maxShortfallDeficit.toLocaleString()}.`,
        affectedDates: firstShortfallDate ? [firstShortfallDate] : [],
        impactAmount: maxShortfallDeficit,
      });
    } else if (shortfallDaysCount === 0 && baseForecast.summary.shortfallDays > 0) {
      insights.push({
        id: `ins-cured-${Date.now()}`,
        category: 'liquidity_buffer',
        severity: 'positive',
        title: 'Shortfall Cured in Scenario',
        message: `The simulated adjustments successfully eliminate all ${baseForecast.summary.shortfallDays} shortfall days present in the base forecast, keeping cash above ${minimumThreshold.toLocaleString()} throughout the 30-day window.`,
        impactAmount: Math.abs(summary.endingCashDelta),
      });
    }

    // AR Delay Insight
    if (outOfWindowDelayedItems.length > 0) {
      const delayedTotal = outOfWindowDelayedItems.reduce((acc, it) => acc + it.amount, 0);
      insights.push({
        id: `ins-ar-lag-${Date.now()}`,
        category: 'ar_delay',
        severity: 'warning',
        title: 'Receivables Shifted Beyond 30-Day Horizon',
        message: `${outOfWindowDelayedItems.length} receivable collection(s) totaling ${delayedTotal.toLocaleString()} are postponed past the 30-day forecast horizon due to payment delay assumptions.`,
        impactAmount: delayedTotal,
      });
    }

    // Large Net Impact Insight
    if (summary.netCashFlowDelta !== 0) {
      const isPositive = summary.netCashFlowDelta > 0;
      insights.push({
        id: `ins-net-impact-${Date.now()}`,
        category: summary.outflowsDelta > 0 ? 'expense_shock' : 'revenue_shift',
        severity: isPositive ? 'positive' : 'info',
        title: isPositive ? 'Net Working Capital Improvement' : 'Net Working Capital Compression',
        message: `Projected 30-day net cash flow is adjusted by ${summary.netCashFlowDelta >= 0 ? '+' : ''}${summary.netCashFlowDelta.toLocaleString()} relative to the base forecast (Inflows: ${summary.inflowsDelta >= 0 ? '+' : ''}${summary.inflowsDelta.toLocaleString()}, Outflows: ${summary.outflowsDelta >= 0 ? '+' : ''}${summary.outflowsDelta.toLocaleString()}).`,
        impactAmount: summary.netCashFlowDelta,
      });
    }

    return {
      scenarioId,
      scenarioName,
      scenarioType,
      organizationId: orgId,
      baseForecastId,
      calculationTimestamp,
      summary,
      dailyProgression,
      allSimulatedItems: simulatedItems,
      outOfWindowDelayedItems,
      appliedAssumptionsCount: assumptions.length,
      insights,
    };
  }

  /**
   * Run Single-Variable Sensitivity Analysis Sweep
   */
  static runSensitivitySweep(
    baseForecast: ForecastEngineOutput,
    variableType: SensitivityAnalysisResult['variableType'],
    options?: {
      targetCategory?: string;
      customSteps?: number[];
    }
  ): SensitivityAnalysisResult {
    let variableName = '';
    let stepsToRun: Array<{ label: string; value: number }> = [];

    switch (variableType) {
      case 'revenue_multiplier':
        variableName = 'Revenue Demand Variation (-30% to +30%)';
        stepsToRun = [
          { label: '-30% Severe Downturn', value: -30 },
          { label: '-20% Contraction', value: -20 },
          { label: '-10% Moderate Slump', value: -10 },
          { label: 'Baseline (0%)', value: 0 },
          { label: '+10% Growth', value: 10 },
          { label: '+20% Upswing', value: 20 },
          { label: '+30% High Surge', value: 30 },
        ];
        break;

      case 'ar_delay_days':
        variableName = 'Customer AR Payment Timing Delay (0 to 30 Days)';
        stepsToRun = [
          { label: '0 Days (On Schedule)', value: 0 },
          { label: '+5 Days Lag', value: 5 },
          { label: '+10 Days Lag', value: 10 },
          { label: '+15 Days Lag', value: 15 },
          { label: '+21 Days Lag', value: 21 },
          { label: '+30 Days Severe Delay', value: 30 },
        ];
        break;

      case 'expense_multiplier':
        variableName = 'Operational Expense Cost Inflation (0% to +30%)';
        stepsToRun = [
          { label: '-10% Cost Reduction', value: -10 },
          { label: '0% Baseline Cost', value: 0 },
          { label: '+5% Slight Inflation', value: 5 },
          { label: '+10% Moderate Rise', value: 10 },
          { label: '+20% Significant Spike', value: 20 },
          { label: '+30% Critical Surcharge', value: 30 },
        ];
        break;

      case 'one_time_shock':
        variableName = 'Unplanned Outflow Liquidity Shock (₹10k to ₹100k)';
        stepsToRun = [
          { label: '₹0 Baseline', value: 0 },
          { label: '₹20,000 Shock', value: 20000 },
          { label: '₹40,000 Shock', value: 40000 },
          { label: '₹60,000 Shock', value: 60000 },
          { label: '₹80,000 Shock', value: 80000 },
          { label: '₹100,000 Major Shock', value: 100000 },
        ];
        break;
    }

    const stepResults: SensitivityStepResult[] = [];

    for (let i = 0; i < stepsToRun.length; i++) {
      const step = stepsToRun[i];
      let testAssumption: ScenarioAssumptionRow;

      if (variableType === 'revenue_multiplier') {
        testAssumption = {
          id: `sens-asm-${i}`,
          scenario_id: 'sens-temp',
          organization_id: baseForecast.organizationId,
          assumption_type: 'revenue_adjustment',
          target_type: options?.targetCategory ? 'category' : 'all',
          target_id: options?.targetCategory || null,
          adjustment_method: 'percentage_change',
          adjustment_value: step.value,
          start_date: null,
          end_date: null,
          description: step.label,
          source: 'sensitivity_sweep',
          created_at: new Date().toISOString(),
        };
      } else if (variableType === 'ar_delay_days') {
        testAssumption = {
          id: `sens-asm-${i}`,
          scenario_id: 'sens-temp',
          organization_id: baseForecast.organizationId,
          assumption_type: 'customer_delay',
          target_type: 'all',
          target_id: null,
          adjustment_method: 'date_shift',
          adjustment_value: step.value,
          start_date: null,
          end_date: null,
          description: step.label,
          source: 'sensitivity_sweep',
          created_at: new Date().toISOString(),
        };
      } else if (variableType === 'expense_multiplier') {
        testAssumption = {
          id: `sens-asm-${i}`,
          scenario_id: 'sens-temp',
          organization_id: baseForecast.organizationId,
          assumption_type: 'expense_adjustment',
          target_type: options?.targetCategory ? 'category' : 'all',
          target_id: options?.targetCategory || null,
          adjustment_method: 'percentage_change',
          adjustment_value: step.value,
          start_date: null,
          end_date: null,
          description: step.label,
          source: 'sensitivity_sweep',
          created_at: new Date().toISOString(),
        };
      } else {
        testAssumption = {
          id: `sens-asm-${i}`,
          scenario_id: 'sens-temp',
          organization_id: baseForecast.organizationId,
          assumption_type: 'one_time_expense',
          target_type: 'all',
          target_id: 'Operational Reserve Shock',
          adjustment_method: 'one_time_event',
          adjustment_value: step.value,
          start_date: this.addDays(baseForecast.startDate, 7), // day 7 shock
          end_date: null,
          description: step.label,
          source: 'sensitivity_sweep',
          created_at: new Date().toISOString(),
        };
      }

      const simOutput = this.simulate(
        baseForecast,
        { id: `sens-run-${i}`, name: step.label, scenario_type: 'custom' },
        [testAssumption]
      );

      stepResults.push({
        stepIndex: i,
        stepLabel: step.label,
        parameterValue: step.value,
        endingCash: simOutput.summary.scenarioEndingCash,
        minProjectedCash: simOutput.summary.scenarioMinProjectedCash,
        netCashFlow: simOutput.summary.scenarioNetCashFlow,
        shortfallDays: simOutput.summary.scenarioShortfallDays,
        maxShortfallDeficit: simOutput.summary.maxShortfallDeficit,
        endingCashDelta: simOutput.summary.endingCashDelta,
      });
    }

    return {
      variableName,
      variableType,
      baselineValue: 0,
      steps: stepResults,
    };
  }
}
