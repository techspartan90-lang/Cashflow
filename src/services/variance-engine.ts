/**
 * Variance Monitoring & Statistical Calibration Engine
 * CashFlow Intelligence — Phase 7: Forecast-vs-Actual Comparison
 *
 * Core Principles:
 * - Mathematical precision with integer-cent safe calculations.
 * - Handles zero, near-zero, and small observation sample sizes safely.
 * - Minimum observation requirements for higher-order statistics (RMSE requires n >= 3).
 * - Detects material deviations exceeding configurable monetary thresholds.
 */

import { MonetaryMath } from './financial-calculator';
import type { Database } from '../types/database';

export type ForecastVarianceRow = Database['public']['Tables']['forecast_variances']['Row'];

export interface ActualDayCashRecord {
  date: string; // YYYY-MM-DD
  clearedInflows: number;
  clearedOutflows: number;
  clearedNetCashFlow: number;
  actualEndingCash: number;
  categoryBreakdown?: Record<string, { inflows: number; outflows: number }>;
}

export interface ProjectedDayRecord {
  date: string; // YYYY-MM-DD
  projectedInflows: number;
  projectedOutflows: number;
  projectedNetCashFlow: number;
  projectedEndingCash: number;
  categoryBreakdown?: Record<string, { inflows: number; outflows: number }>;
}

export interface DailyVarianceComparison {
  date: string;
  forecastInflows: number;
  actualInflows: number;
  inflowVariance: number; // actual - forecast

  forecastOutflows: number;
  actualOutflows: number;
  outflowVariance: number; // actual - forecast

  forecastNetCashFlow: number;
  actualNetCashFlow: number;
  netCashFlowVariance: number; // actual - forecast

  forecastEndingCash: number;
  actualEndingCash: number;
  endingCashVariance: number; // actual - forecast
  absoluteVariance: number; // |actual - forecast|

  isMaterialDeviation: boolean;
  deviationReason?: string;
  categoryVariances?: Record<string, { forecast: number; actual: number; variance: number }>;
}

export interface VarianceSummaryReport {
  organizationId: string;
  forecastId: string;
  evaluationStartDate: string;
  evaluationEndDate: string;
  totalDaysEvaluated: number;

  meanAbsoluteError: number; // MAE
  rootMeanSquareError: number | null; // RMSE (null if n < 3)
  bias: number; // Mean signed error
  materialDeviationsCount: number;
  maxAbsoluteDeviation: number;
  maxDeviationDate: string | null;

  inflowTotalForecast: number;
  inflowTotalActual: number;
  outflowTotalForecast: number;
  outflowTotalActual: number;

  dailyComparisons: DailyVarianceComparison[];
  sufficientDataForRmse: boolean;
}

export const DEFAULT_MATERIAL_VARIANCE_THRESHOLD = 25000.0; // ₹25,000 default

export class VarianceEngine {
  /**
   * Compares daily projected cash figures with actual cleared bank transactions
   */
  public static compare(
    organizationId: string,
    forecastId: string,
    projectedDays: ProjectedDayRecord[],
    actualDays: ActualDayCashRecord[],
    materialThreshold: number = DEFAULT_MATERIAL_VARIANCE_THRESHOLD
  ): VarianceSummaryReport {
    const actualMap = new Map<string, ActualDayCashRecord>();
    for (const act of actualDays) {
      actualMap.set(act.date, act);
    }

    const comparisons: DailyVarianceComparison[] = [];
    let sumAbsoluteError = 0;
    let sumSquaredError = 0;
    let sumSignedError = 0;
    let materialDeviationsCount = 0;
    let maxAbsoluteDeviation = 0;
    let maxDeviationDate: string | null = null;

    let inflowTotalForecast = 0;
    let inflowTotalActual = 0;
    let outflowTotalForecast = 0;
    let outflowTotalActual = 0;

    // Filter to dates where actual historical ledger data exists
    for (const proj of projectedDays) {
      const act = actualMap.get(proj.date);
      if (!act) continue; // Future projection day without cleared actuals yet

      const inflowVar = MonetaryMath.subtract(act.clearedInflows, proj.projectedInflows);
      const outflowVar = MonetaryMath.subtract(act.clearedOutflows, proj.projectedOutflows);
      const netVar = MonetaryMath.subtract(act.clearedNetCashFlow, proj.projectedNetCashFlow);
      const endingVar = MonetaryMath.subtract(act.actualEndingCash, proj.projectedEndingCash);
      const absEndingVar = Math.abs(endingVar);

      const isMaterial = absEndingVar >= materialThreshold;
      if (isMaterial) {
        materialDeviationsCount++;
      }

      if (absEndingVar > maxAbsoluteDeviation) {
        maxAbsoluteDeviation = absEndingVar;
        maxDeviationDate = proj.date;
      }

      sumAbsoluteError = MonetaryMath.add(sumAbsoluteError, absEndingVar);
      sumSquaredError += absEndingVar * absEndingVar;
      sumSignedError = MonetaryMath.add(sumSignedError, endingVar);

      inflowTotalForecast = MonetaryMath.add(inflowTotalForecast, proj.projectedInflows);
      inflowTotalActual = MonetaryMath.add(inflowTotalActual, act.clearedInflows);
      outflowTotalForecast = MonetaryMath.add(outflowTotalForecast, proj.projectedOutflows);
      outflowTotalActual = MonetaryMath.add(outflowTotalActual, act.clearedOutflows);

      comparisons.push({
        date: proj.date,
        forecastInflows: proj.projectedInflows,
        actualInflows: act.clearedInflows,
        inflowVariance: inflowVar,

        forecastOutflows: proj.projectedOutflows,
        actualOutflows: act.clearedOutflows,
        outflowVariance: outflowVar,

        forecastNetCashFlow: proj.projectedNetCashFlow,
        actualNetCashFlow: act.clearedNetCashFlow,
        netCashFlowVariance: netVar,

        forecastEndingCash: proj.projectedEndingCash,
        actualEndingCash: act.actualEndingCash,
        endingCashVariance: endingVar,
        absoluteVariance: absEndingVar,

        isMaterialDeviation: isMaterial,
        deviationReason: isMaterial
          ? `Actual ending cash diverged by ₹${absEndingVar.toLocaleString('en-IN')} (Threshold: ₹${materialThreshold.toLocaleString('en-IN')})`
          : undefined,
      });
    }

    const n = comparisons.length;
    const sufficientDataForRmse = n >= 3;

    const mae = n > 0 ? MonetaryMath.round2(sumAbsoluteError / n) : 0;
    const bias = n > 0 ? MonetaryMath.round2(sumSignedError / n) : 0;
    const rmse = sufficientDataForRmse ? MonetaryMath.round2(Math.sqrt(sumSquaredError / n)) : null;

    const startDate = comparisons.length > 0 ? comparisons[0].date : '';
    const endDate = comparisons.length > 0 ? comparisons[comparisons.length - 1].date : '';

    return {
      organizationId,
      forecastId,
      evaluationStartDate: startDate,
      evaluationEndDate: endDate,
      totalDaysEvaluated: n,
      meanAbsoluteError: mae,
      rootMeanSquareError: rmse,
      bias,
      materialDeviationsCount,
      maxAbsoluteDeviation,
      maxDeviationDate,
      inflowTotalForecast,
      inflowTotalActual,
      outflowTotalForecast,
      outflowTotalActual,
      dailyComparisons: comparisons,
      sufficientDataForRmse,
    };
  }

  /**
   * Translates comparisons into database rows for persistence in forecast_variances
   */
  public static toDatabaseRows(
    organizationId: string,
    forecastId: string,
    comparisons: DailyVarianceComparison[]
  ): ForecastVarianceRow[] {
    const now = new Date().toISOString();
    return comparisons.map((c) => ({
      id: `var-${forecastId}-${c.date}`,
      organization_id: organizationId,
      forecast_id: forecastId,
      forecast_date: c.date,
      forecast_inflows: c.forecastInflows,
      actual_inflows: c.actualInflows,
      forecast_outflows: c.forecastOutflows,
      actual_outflows: c.actualOutflows,
      forecast_net_cash_flow: c.forecastNetCashFlow,
      actual_net_cash_flow: c.actualNetCashFlow,
      forecast_ending_cash: c.forecastEndingCash,
      actual_ending_cash: c.actualEndingCash,
      absolute_variance: c.absoluteVariance,
      signed_variance: c.endingCashVariance,
      is_material_deviation: c.isMaterialDeviation,
      category_variances: c.categoryVariances || {},
      notes: c.deviationReason || null,
      created_at: now,
    }));
  }
}
