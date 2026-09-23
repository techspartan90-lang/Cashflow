/**
 * Evidence-Based Financial Recommendation Engine
 * CashFlow Intelligence — Phase 7: Actionable Decision Support
 *
 * Core Principles:
 * - Recommendations must be generated ONLY from verified data and documented projections.
 * - Explicit source attribution: cites specific invoice IDs, dates, and amounts.
 * - Never claims certainty or provides binding legal/financial advice.
 * - Non-destructive: suggests tactical review actions, never triggers automated money movements.
 */

import { MonetaryMath } from './financial-calculator';
import type { Database } from '../types/database';
import type { ForecastEngineOutput } from './forecast-engine';
import type { FinancialAlertRow } from './alert-engine';
import type { VarianceSummaryReport } from './variance-engine';

export type RecommendationRow = Database['public']['Tables']['actionable_recommendations']['Row'];

export interface RecommendationContext {
  organizationId: string;
  asOfDate: string;
  forecast?: ForecastEngineOutput;
  activeAlerts?: FinancialAlertRow[];
  varianceSummary?: VarianceSummaryReport;
  receivables?: Array<{
    id: string;
    customer_id: string;
    invoice_number: string;
    outstanding_amount: number;
    due_date: string;
    status: string;
  }>;
  payables?: Array<{
    id: string;
    supplier_id: string;
    invoice_number: string;
    outstanding_amount: number;
    due_date: string;
    status: string;
  }>;
}

export const LEGAL_DISCLAIMER =
  'Notice: Recommendations are operational review suggestions generated deterministically from recorded ledger balances, scheduled obligations, and statistical forecast projections. They do not constitute formal financial, investment, legal, or tax advice.';

export class RecommendationEngine {
  /**
   * Generates evidence-backed recommendations strictly tied to factual records
   */
  public static generateRecommendations(context: RecommendationContext): RecommendationRow[] {
    const recommendations: RecommendationRow[] = [];
    const now = new Date().toISOString();
    const orgId = context.organizationId;

    // 1. Overdue Accounts Receivable Action Play
    if (context.receivables && context.receivables.length > 0) {
      const overdueList = context.receivables
        .filter((r) => r.outstanding_amount > 0 && r.due_date < context.asOfDate)
        .sort((a, b) => b.outstanding_amount - a.outstanding_amount);

      if (overdueList.length > 0) {
        const topOverdue = overdueList[0];
        const totalOverdueAmount = overdueList.reduce(
          (acc, cur) => MonetaryMath.add(acc, cur.outstanding_amount),
          0
        );

        recommendations.push({
          id: `rec-ar-${topOverdue.id}`,
          organization_id: orgId,
          recommendation_type: 'review_overdue_receivables',
          title: `Expedite Outstanding Invoices (₹${totalOverdueAmount.toLocaleString('en-IN')} Total Past Due)`,
          rationale: `Customer receivable ${topOverdue.invoice_number} (Customer ID: ${topOverdue.customer_id}) for ₹${topOverdue.outstanding_amount.toLocaleString('en-IN')} was due on ${topOverdue.due_date} and remains uncollected. Accelerating collection of past-due invoices directly replenishes cash reserves before scheduled month-end disbursements.`,
          evidence_data: {
            top_overdue_invoice: topOverdue.invoice_number,
            top_overdue_id: topOverdue.id,
            top_overdue_amount: topOverdue.outstanding_amount,
            due_date: topOverdue.due_date,
            total_overdue_invoices_count: overdueList.length,
            total_overdue_amount: totalOverdueAmount,
            disclaimer: LEGAL_DISCLAIMER,
          },
          related_alert_id: null,
          related_entity_type: 'accounts_receivable',
          related_entity_id: topOverdue.id,
          projected_impact_amount: topOverdue.outstanding_amount,
          urgency: totalOverdueAmount > 50000 ? 'high' : 'medium',
          status: 'active',
          created_at: now,
          updated_at: now,
        });
      }
    }

    // 2. Large Upcoming Outflow Staggering
    if (context.forecast && context.forecast.allForecastItems) {
      const upcomingLargeOutflows = context.forecast.allForecastItems
        .filter((item) => item.type === 'outflow' && item.amount >= 50000)
        .sort((a, b) => b.amount - a.amount);

      if (upcomingLargeOutflows.length > 0) {
        const topOutflow = upcomingLargeOutflows[0];
        recommendations.push({
          id: `rec-ap-stagger-${topOutflow.id || topOutflow.date}`,
          organization_id: orgId,
          recommendation_type: 'stagger_large_outflows',
          title: `Negotiate Tranche Settlement for ${topOutflow.description} (₹${topOutflow.amount.toLocaleString('en-IN')})`,
          rationale: `A substantial outflow of ₹${topOutflow.amount.toLocaleString('en-IN')} is scheduled for ${topOutflow.date} (${topOutflow.category}). Splitting this settlement into two 50% tranches or requesting a 7-day grace window protects the minimum working capital reserve.`,
          evidence_data: {
            scheduled_date: topOutflow.date,
            amount: topOutflow.amount,
            category: topOutflow.category,
            description: topOutflow.description,
            suggested_split_tranche_amount: MonetaryMath.divide(topOutflow.amount, 2),
            disclaimer: LEGAL_DISCLAIMER,
          },
          related_alert_id: null,
          related_entity_type: 'forecast_item',
          related_entity_id: topOutflow.id || null,
          projected_impact_amount: MonetaryMath.divide(topOutflow.amount, 2),
          urgency: 'high',
          status: 'active',
          created_at: now,
          updated_at: now,
        });
      }
    }

    // 3. Liquidity Shortfall & Scenario Simulation Play
    if (context.forecast && context.forecast.summary.shortfallDays > 0) {
      const shortfallDay = context.forecast.dailyForecast.find((d) => d.thresholdStatus === 'below_threshold');
      const firstShortfallDate = shortfallDay ? shortfallDay.date : context.forecast.startDate;
      const maxDeficit = context.forecast.dailyForecast.reduce((max, d) => Math.max(max, d.shortfallDeficit), 0);

      recommendations.push({
        id: `rec-scen-stress-${context.forecast.forecastId}`,
        organization_id: orgId,
        recommendation_type: 'simulate_delayed_collections',
        title: `Stress-Test 14-Day AR Delay & Cap Discretionary OpEx`,
        rationale: `The baseline deterministic forecast indicates a cash shortfall breach starting on ${firstShortfallDate} with a peak deficit of ₹${maxDeficit.toLocaleString('en-IN')}. Evaluate the 'Customer Payment Delay' model in Scenario Studio to test contingency cash runway if collections lag further.`,
        evidence_data: {
          first_shortfall_date: firstShortfallDate,
          peak_deficit_amount: maxDeficit,
          forecast_id: context.forecast.forecastId,
          recommended_scenario_type: 'customer_payment_delay',
          disclaimer: LEGAL_DISCLAIMER,
        },
        related_alert_id: null,
        related_entity_type: 'forecast_run',
        related_entity_id: context.forecast.forecastId,
        projected_impact_amount: maxDeficit,
        urgency: 'critical',
        status: 'active',
        created_at: now,
        updated_at: now,
      });
    }

    // 4. Material Variance & Model Recalibration Play
    if (context.varianceSummary && context.varianceSummary.materialDeviationsCount > 0) {
      const vs = context.varianceSummary;
      recommendations.push({
        id: `rec-var-${vs.forecastId}-${vs.maxDeviationDate}`,
        organization_id: orgId,
        recommendation_type: 'investigate_forecast_deviation',
        title: `Investigate Material Variance (${vs.materialDeviationsCount} Deviations > ₹25,000)`,
        rationale: `Backtesting revealed ${vs.materialDeviationsCount} material divergence days between forecast and actual bank balances (Peak variance: ₹${vs.maxAbsoluteDeviation.toLocaleString('en-IN')} on ${vs.maxDeviationDate}). Re-verify cleared bank transactions and update recurring cash flow assumptions.`,
        evidence_data: {
          mae: vs.meanAbsoluteError,
          rmse: vs.rootMeanSquareError,
          bias: vs.bias,
          material_deviations_count: vs.materialDeviationsCount,
          peak_deviation_date: vs.maxDeviationDate,
          peak_deviation_amount: vs.maxAbsoluteDeviation,
          disclaimer: LEGAL_DISCLAIMER,
        },
        related_alert_id: null,
        related_entity_type: 'forecast_variance',
        related_entity_id: vs.forecastId,
        projected_impact_amount: vs.maxAbsoluteDeviation,
        urgency: 'medium',
        status: 'active',
        created_at: now,
        updated_at: now,
      });
    }

    return recommendations;
  }
}
