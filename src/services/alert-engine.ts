/**
 * Financial Alert Evaluation Engine
 * CashFlow Intelligence — Phase 7: Alerts, Recommendations, Variance Monitoring
 *
 * Core Principles:
 * - Alerts must be based on verified data or explicitly documented assumptions.
 * - Never fabricate financial risks or alert conditions.
 * - Do not modify actual transactions automatically.
 * - Recommendations must be evidence-based and clearly qualified.
 * - Preserve auditability & deduplicate active alerts deterministically.
 */

import { MonetaryMath } from './financial-calculator';
import type { Database, AlertSeverity, AlertStatus } from '../types/database';
import type { ForecastEngineOutput, DailyForecastDay } from './forecast-engine';

export type FinancialAlertRow = Database['public']['Tables']['financial_alerts']['Row'];
export type AlertRuleRow = Database['public']['Tables']['alert_rules']['Row'];
export type AlertEventRow = Database['public']['Tables']['alert_events']['Row'];

export interface AlertEvaluationContext {
  organizationId: string;
  asOfDate: string; // e.g. '2026-09-23'
  forecast?: ForecastEngineOutput;
  receivables?: Array<{
    id: string;
    customer_id: string;
    invoice_number: string;
    invoice_amount: number;
    outstanding_amount: number;
    due_date: string;
    expected_collection_date?: string;
    status: string;
  }>;
  payables?: Array<{
    id: string;
    supplier_id: string;
    invoice_number: string;
    invoice_amount: number;
    outstanding_amount: number;
    due_date: string;
    expected_payment_date?: string;
    status: string;
  }>;
  actualTransactions?: Array<{
    id: string;
    amount: number;
    transaction_type: 'inflow' | 'outflow';
    transaction_date: string;
    category: string;
    description: string;
  }>;
  customRules?: AlertRuleRow[];
  existingAlerts?: FinancialAlertRow[];
}

export interface EvaluatedAlertDraft {
  organization_id: string;
  alert_type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  fingerprint: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  related_date: string | null;
  forecast_id: string | null;
  trigger_data: Record<string, any>;
  recommended_review_action: string;
}

export interface AlertEvaluationResult {
  activeAlerts: FinancialAlertRow[];
  newAlerts: FinancialAlertRow[];
  updatedAlerts: FinancialAlertRow[];
  resolvedAlerts: FinancialAlertRow[];
  reactivatedAlerts: FinancialAlertRow[];
  auditEvents: AlertEventRow[];
}

// Configurable Default Thresholds
export const DEFAULT_ALERT_THRESHOLDS = {
  approachingThresholdBufferPercent: 0.15, // 15% buffer above minimum threshold
  approachingThresholdAbsoluteBuffer: 25000.0, // or ₹25,000 buffer
  largeOutflowThreshold: 50000.0, // Outflows >= ₹50,000 flagged
  overdueGraceDays: 0, // Flag immediately upon due date passing
  materialForecastDeviationAmount: 25000.0, // Variance > ₹25,000 flagged
  materialForecastDeviationPercent: 0.20, // 20% deviation
};

export class AlertEngine {
  /**
   * Deterministic SHA-free alphanumeric fingerprint calculation
   * Prevents duplicate active alerts for identical financial entities/conditions
   */
  public static calculateFingerprint(
    organizationId: string,
    alertType: string,
    relatedEntityType: string | null,
    relatedEntityId: string | null,
    relatedDate: string | null,
    contextToken?: string | number
  ): string {
    const parts = [
      organizationId,
      alertType,
      relatedEntityType || 'none',
      relatedEntityId || 'none',
      relatedDate || 'none',
      contextToken !== undefined ? String(contextToken) : 'base',
    ];
    return parts.join('::').toLowerCase();
  }

  /**
   * Main Alert Evaluation Routine
   * Deterministically evaluates verified ledger data and forecast projections
   */
  public static evaluateAll(context: AlertEvaluationContext): AlertEvaluationResult {
    const drafts: EvaluatedAlertDraft[] = [];

    // 1. Evaluate Forecast Thresholds (Shortfall, Negative Cash, Approaching Threshold)
    if (context.forecast) {
      this.evaluateForecastCashAlerts(context, drafts);
      this.evaluateLargeUpcomingOutflows(context, drafts);
    }

    // 2. Evaluate Overdue Receivables
    if (context.receivables && context.receivables.length > 0) {
      this.evaluateOverdueReceivables(context, drafts);
    }

    // 3. Evaluate Overdue Payables
    if (context.payables && context.payables.length > 0) {
      this.evaluateOverduePayables(context, drafts);
    }

    // 4. Evaluate Financial Data Quality
    this.evaluateDataQuality(context, drafts);

    // 5. Reconcile with Existing Alerts (Deduplication, Resolution, Reactivation)
    return this.reconcileAlerts(context, drafts);
  }

  /**
   * A. CASH SHORTFALL & B. NEGATIVE PROJECTED CASH & C. APPROACHING THRESHOLD
   */
  private static evaluateForecastCashAlerts(
    context: AlertEvaluationContext,
    drafts: EvaluatedAlertDraft[]
  ): void {
    const forecast = context.forecast!;
    const minThreshold = forecast.minimumCashThreshold;
    const orgId = context.organizationId;
    const forecastId = forecast.forecastId;
    const forecastVersion = forecast.forecastVersion;

    // Rule customizer
    const approachingBufferRule = context.customRules?.find(
      (r) => r.alert_type === 'approaching_threshold' && r.is_active
    );
    const bufferAmount = approachingBufferRule
      ? Number(approachingBufferRule.threshold_value)
      : Math.max(
          DEFAULT_ALERT_THRESHOLDS.approachingThresholdAbsoluteBuffer,
          MonetaryMath.multiply(minThreshold, DEFAULT_ALERT_THRESHOLDS.approachingThresholdBufferPercent)
        );

    // Track if a shortfall alert was already raised for this forecast run to group consecutive days
    const shortfallDays = forecast.dailyForecast.filter(
      (d) => d.thresholdStatus === 'below_threshold'
    );

    if (shortfallDays.length > 0) {
      const firstShortfall = shortfallDays[0];
      const maxDeficitDay = shortfallDays.reduce((max, cur) =>
        cur.shortfallDeficit > max.shortfallDeficit ? cur : max
      );

      // Check for Negative Cash vs Shortfall
      const negativeDays = shortfallDays.filter((d) => d.endingCash < 0);

      if (negativeDays.length > 0) {
        const firstNegative = negativeDays[0];
        const worstNegative = negativeDays.reduce((worst, cur) =>
          cur.endingCash < worst.endingCash ? cur : worst
        );

        const fpNegative = this.calculateFingerprint(
          orgId,
          'negative_cash',
          'forecast_run',
          forecastId,
          firstNegative.date,
          forecastVersion
        );

        drafts.push({
          organization_id: orgId,
          alert_type: 'negative_cash',
          severity: 'critical',
          title: `Projected Negative Cash Balance (${firstNegative.date})`,
          description: `Deterministic 30-day forecast projects cash balance dipping into negative liquidity starting ${firstNegative.date} at ₹${firstNegative.endingCash.toLocaleString('en-IN')}, reaching worst-case trough of ₹${worstNegative.endingCash.toLocaleString('en-IN')} on ${worstNegative.date}.`,
          fingerprint: fpNegative,
          related_entity_type: 'forecast_run',
          related_entity_id: forecastId,
          related_date: firstNegative.date,
          forecast_id: forecastId,
          trigger_data: {
            first_negative_date: firstNegative.date,
            first_projected_cash: firstNegative.endingCash,
            worst_negative_date: worstNegative.date,
            worst_negative_amount: worstNegative.endingCash,
            total_negative_days: negativeDays.length,
            forecast_version: forecastVersion,
            calculation_source: 'forecast_engine_daily_rollforward',
          },
          recommended_review_action:
            'Conduct immediate working capital review: delay discretionary vendor payments, expedite overdue customer collections, or establish emergency credit facility.',
        });
      }

      // Cash Shortfall Alert (below minimum threshold)
      const fpShortfall = this.calculateFingerprint(
        orgId,
        'cash_shortfall',
        'forecast_run',
        forecastId,
        firstShortfall.date,
        forecastVersion
      );

      drafts.push({
        organization_id: orgId,
        alert_type: 'cash_shortfall',
        severity: 'critical',
        title: `Liquidity Reserve Breach Projected (${firstShortfall.date})`,
        description: `Projected ending cash falls below the required safety threshold of ₹${minThreshold.toLocaleString('en-IN')} starting ${firstShortfall.date} (Projected: ₹${firstShortfall.endingCash.toLocaleString('en-IN')}, Deficit: ₹${firstShortfall.shortfallDeficit.toLocaleString('en-IN')}). Peak deficit reaches ₹${maxDeficitDay.shortfallDeficit.toLocaleString('en-IN')} on ${maxDeficitDay.date}.`,
        fingerprint: fpShortfall,
        related_entity_type: 'forecast_run',
        related_entity_id: forecastId,
        related_date: firstShortfall.date,
        forecast_id: forecastId,
        trigger_data: {
          shortfall_date: firstShortfall.date,
          projected_cash_balance: firstShortfall.endingCash,
          minimum_threshold: minThreshold,
          shortfall_amount: firstShortfall.shortfallDeficit,
          peak_deficit_date: maxDeficitDay.date,
          peak_deficit_amount: maxDeficitDay.shortfallDeficit,
          total_breach_days: shortfallDays.length,
          forecast_id: forecastId,
          calculation_source: 'deterministic_rollforward_v1',
        },
        recommended_review_action:
          'Audit upcoming supplier disbursements and examine collection schedules in Scenario Studio to restore the mandatory safety reserve.',
      });
    } else {
      // If no shortfall, check if cash is approaching threshold
      const approachingDays = forecast.dailyForecast.filter((d) => {
        const marginAboveThreshold = MonetaryMath.subtract(d.endingCash, minThreshold);
        return marginAboveThreshold >= 0 && marginAboveThreshold <= bufferAmount;
      });

      if (approachingDays.length > 0) {
        const lowestDay = approachingDays.reduce((low, cur) =>
          cur.endingCash < low.endingCash ? cur : low
        );
        const margin = MonetaryMath.subtract(lowestDay.endingCash, minThreshold);

        const fpApproaching = this.calculateFingerprint(
          orgId,
          'approaching_threshold',
          'forecast_run',
          forecastId,
          lowestDay.date,
          forecastVersion
        );

        drafts.push({
          organization_id: orgId,
          alert_type: 'approaching_threshold',
          severity: 'warning',
          title: `Cash Buffer Approaching Minimum Threshold (${lowestDay.date})`,
          description: `Cash balance is projected to compress to within ₹${margin.toLocaleString('en-IN')} of the minimum safety buffer (₹${minThreshold.toLocaleString('en-IN')}) on ${lowestDay.date}, leaving low operating resilience against delays.`,
          fingerprint: fpApproaching,
          related_entity_type: 'forecast_run',
          related_entity_id: forecastId,
          related_date: lowestDay.date,
          forecast_id: forecastId,
          trigger_data: {
            trough_date: lowestDay.date,
            projected_cash: lowestDay.endingCash,
            minimum_threshold: minThreshold,
            buffer_remaining: margin,
            buffer_rule_amount: bufferAmount,
            forecast_version: forecastVersion,
          },
          recommended_review_action:
            'Monitor receivables due in the prior 72 hours; ensure high-value invoices are collected promptly to prevent threshold breach.',
        });
      }
    }
  }

  /**
   * D. OVERDUE RECEIVABLE
   */
  private static evaluateOverdueReceivables(
    context: AlertEvaluationContext,
    drafts: EvaluatedAlertDraft[]
  ): void {
    const asOf = context.asOfDate;
    const orgId = context.organizationId;

    for (const ar of context.receivables!) {
      if (ar.outstanding_amount > 0 && ar.due_date < asOf) {
        const daysOverdue = Math.max(
          1,
          Math.floor((new Date(asOf).getTime() - new Date(ar.due_date).getTime()) / (1000 * 3600 * 24))
        );

        const severity: AlertSeverity = daysOverdue > 14 ? 'critical' : 'warning';

        const fp = this.calculateFingerprint(
          orgId,
          'overdue_receivable',
          'accounts_receivable',
          ar.id,
          ar.due_date
        );

        drafts.push({
          organization_id: orgId,
          alert_type: 'overdue_receivable',
          severity,
          title: `Overdue Receivable: Invoice ${ar.invoice_number} (${daysOverdue}d Past Due)`,
          description: `Invoice ${ar.invoice_number} for ₹${ar.outstanding_amount.toLocaleString('en-IN')} was due on ${ar.due_date} and is now ${daysOverdue} days overdue with outstanding balance unpaid.`,
          fingerprint: fp,
          related_entity_type: 'accounts_receivable',
          related_entity_id: ar.id,
          related_date: ar.due_date,
          forecast_id: context.forecast?.forecastId || null,
          trigger_data: {
            invoice_id: ar.id,
            customer_id: ar.customer_id,
            invoice_number: ar.invoice_number,
            outstanding_amount: ar.outstanding_amount,
            invoice_amount: ar.invoice_amount,
            due_date: ar.due_date,
            days_overdue: daysOverdue,
          },
          recommended_review_action:
            `Initiate collections contact with customer ${ar.customer_id}; review past payment reliability and adjust expected collection date in forecast.`,
        });
      }
    }
  }

  /**
   * E. OVERDUE PAYABLE
   */
  private static evaluateOverduePayables(
    context: AlertEvaluationContext,
    drafts: EvaluatedAlertDraft[]
  ): void {
    const asOf = context.asOfDate;
    const orgId = context.organizationId;

    for (const ap of context.payables!) {
      if (ap.outstanding_amount > 0 && ap.due_date < asOf) {
        const daysOverdue = Math.max(
          1,
          Math.floor((new Date(asOf).getTime() - new Date(ap.due_date).getTime()) / (1000 * 3600 * 24))
        );

        const severity: AlertSeverity = daysOverdue > 10 ? 'critical' : 'warning';

        const fp = this.calculateFingerprint(
          orgId,
          'overdue_payable',
          'accounts_payable',
          ap.id,
          ap.due_date
        );

        drafts.push({
          organization_id: orgId,
          alert_type: 'overdue_payable',
          severity,
          title: `Overdue Vendor Bill: ${ap.invoice_number} (${daysOverdue}d Past Due)`,
          description: `Supplier bill ${ap.invoice_number} for ₹${ap.outstanding_amount.toLocaleString('en-IN')} was scheduled for settlement on ${ap.due_date} and is now ${daysOverdue} days overdue.`,
          fingerprint: fp,
          related_entity_type: 'accounts_payable',
          related_entity_id: ap.id,
          related_date: ap.due_date,
          forecast_id: context.forecast?.forecastId || null,
          trigger_data: {
            payable_id: ap.id,
            supplier_id: ap.supplier_id,
            invoice_number: ap.invoice_number,
            outstanding_amount: ap.outstanding_amount,
            due_date: ap.due_date,
            days_overdue: daysOverdue,
          },
          recommended_review_action:
            `Verify cash clearance with finance team or contact supplier ${ap.supplier_id} to negotiate structured settlement terms.`,
        });
      }
    }
  }

  /**
   * F. LARGE UPCOMING OUTFLOW
   */
  private static evaluateLargeUpcomingOutflows(
    context: AlertEvaluationContext,
    drafts: EvaluatedAlertDraft[]
  ): void {
    const forecast = context.forecast!;
    const orgId = context.organizationId;

    const largeOutflowRule = context.customRules?.find(
      (r) => r.alert_type === 'large_outflow' && r.is_active
    );
    const thresholdAmount = largeOutflowRule
      ? Number(largeOutflowRule.threshold_value)
      : DEFAULT_ALERT_THRESHOLDS.largeOutflowThreshold;

    for (const item of forecast.allForecastItems) {
      if (item.type === 'outflow' && item.amount >= thresholdAmount) {
        const fp = this.calculateFingerprint(
          orgId,
          'large_outflow',
          item.source,
          item.id || item.description,
          item.date
        );

        const severity: AlertSeverity =
          item.amount >= MonetaryMath.multiply(thresholdAmount, 2) ? 'warning' : 'informational';

        drafts.push({
          organization_id: orgId,
          alert_type: 'large_outflow',
          severity,
          title: `Substantial Cash Outflow Scheduled: ₹${item.amount.toLocaleString('en-IN')} (${item.category})`,
          description: `A significant single cash outflow of ₹${item.amount.toLocaleString('en-IN')} (${item.description}) is scheduled on ${item.date}, exceeding the monitored single-transaction threshold of ₹${thresholdAmount.toLocaleString('en-IN')}.`,
          fingerprint: fp,
          related_entity_type: item.source,
          related_entity_id: item.id || null,
          related_date: item.date,
          forecast_id: forecast.forecastId,
          trigger_data: {
            scheduled_date: item.date,
            amount: item.amount,
            threshold_value: thresholdAmount,
            category: item.category,
            description: item.description,
            certainty: item.certainty,
          },
          recommended_review_action:
            `Verify sufficient preceding account balance on ${item.date} to cover this disbursement without draining the emergency buffer.`,
        });
      }
    }
  }

  /**
   * H. DATA QUALITY WARNING
   */
  private static evaluateDataQuality(
    context: AlertEvaluationContext,
    drafts: EvaluatedAlertDraft[]
  ): void {
    const orgId = context.organizationId;

    // Check for negative transaction amounts or corrupt invoices
    if (context.receivables) {
      for (const ar of context.receivables) {
        if (ar.outstanding_amount < 0 || ar.invoice_amount <= 0) {
          const fp = this.calculateFingerprint(
            orgId,
            'data_quality_warning',
            'accounts_receivable',
            ar.id,
            'invalid_amount'
          );

          drafts.push({
            organization_id: orgId,
            alert_type: 'data_quality_warning',
            severity: 'critical',
            title: `Data Quality Anomaly: Negative or Zero Receivable (${ar.invoice_number})`,
            description: `Receivable ${ar.invoice_number} has an invalid negative outstanding amount (₹${ar.outstanding_amount}) or non-positive invoice amount. This distorts the cash-flow ledger.`,
            fingerprint: fp,
            related_entity_type: 'accounts_receivable',
            related_entity_id: ar.id,
            related_date: ar.due_date,
            forecast_id: null,
            trigger_data: {
              invoice_id: ar.id,
              invoice_number: ar.invoice_number,
              invoice_amount: ar.invoice_amount,
              outstanding_amount: ar.outstanding_amount,
              issue: 'invalid_monetary_value',
            },
            recommended_review_action:
              'Correct or void the corrupted invoice record in the Ingestion View before regenerating authoritative forecasts.',
          });
        }
      }
    }
  }

  /**
   * Reconcile generated drafts against existing persistent alerts
   * Guarantees:
   * - No duplicate active alerts
   * - Material updates recorded
   * - Auto-resolves resolved conditions
   * - Logs audit events
   */
  private static reconcileAlerts(
    context: AlertEvaluationContext,
    drafts: EvaluatedAlertDraft[]
  ): AlertEvaluationResult {
    const existing = context.existingAlerts || [];
    const existingByFingerprint = new Map<string, FinancialAlertRow>();

    for (const a of existing) {
      if (a.fingerprint) {
        existingByFingerprint.set(a.fingerprint, a);
      }
    }

    const activeAlerts: FinancialAlertRow[] = [];
    const newAlerts: FinancialAlertRow[] = [];
    const updatedAlerts: FinancialAlertRow[] = [];
    const resolvedAlerts: FinancialAlertRow[] = [];
    const reactivatedAlerts: FinancialAlertRow[] = [];
    const auditEvents: AlertEventRow[] = [];

    const processedFingerprints = new Set<string>();

    for (const draft of drafts) {
      processedFingerprints.add(draft.fingerprint);
      const prev = existingByFingerprint.get(draft.fingerprint);

      if (!prev) {
        // Brand new alert
        const newAlert: FinancialAlertRow = {
          id: `alt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          organization_id: draft.organization_id,
          alert_type: draft.alert_type,
          severity: draft.severity,
          status: 'active',
          title: draft.title,
          description: draft.description,
          fingerprint: draft.fingerprint,
          related_entity_type: draft.related_entity_type,
          related_entity_id: draft.related_entity_id,
          related_date: draft.related_date,
          forecast_id: draft.forecast_id,
          trigger_data: draft.trigger_data,
          recommended_review_action: draft.recommended_review_action,
          is_read: false,
          acknowledged_at: null,
          resolved_at: null,
          dismissed_at: null,
          reactivated_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        newAlerts.push(newAlert);
        activeAlerts.push(newAlert);

        auditEvents.push({
          id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          alert_id: newAlert.id,
          organization_id: draft.organization_id,
          event_type: 'created',
          previous_status: null,
          new_status: 'active',
          user_id: null,
          notes: `Triggered by ${draft.alert_type}: ${draft.title}`,
          created_at: new Date().toISOString(),
        });
      } else if (prev.status === 'resolved' || prev.status === 'dismissed') {
        // Condition returned! Reactivate alert
        const reactivated: FinancialAlertRow = {
          ...prev,
          status: 'active',
          title: draft.title,
          description: draft.description,
          trigger_data: draft.trigger_data,
          severity: draft.severity,
          reactivated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        reactivatedAlerts.push(reactivated);
        activeAlerts.push(reactivated);

        auditEvents.push({
          id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          alert_id: prev.id,
          organization_id: draft.organization_id,
          event_type: 'reactivated',
          previous_status: prev.status,
          new_status: 'active',
          user_id: null,
          notes: `Alert condition returned: ${draft.title}`,
          created_at: new Date().toISOString(),
        });
      } else {
        // Already active or acknowledged - check if materially changed
        const prevDataStr = JSON.stringify(prev.trigger_data);
        const currDataStr = JSON.stringify(draft.trigger_data);

        if (prevDataStr !== currDataStr || prev.severity !== draft.severity) {
          const updated: FinancialAlertRow = {
            ...prev,
            title: draft.title,
            description: draft.description,
            trigger_data: draft.trigger_data,
            severity: draft.severity,
            updated_at: new Date().toISOString(),
          };
          updatedAlerts.push(updated);
          activeAlerts.push(updated);
        } else {
          activeAlerts.push(prev);
        }
      }
    }

    // Auto-resolve previous active alerts that are no longer triggered (e.g. invoice paid or shortfall vanished)
    for (const prev of existing) {
      if (
        (prev.status === 'active' || prev.status === 'acknowledged') &&
        prev.fingerprint &&
        !processedFingerprints.has(prev.fingerprint)
      ) {
        // If this alert was for an entity that is now reconciled
        const resolved: FinancialAlertRow = {
          ...prev,
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        resolvedAlerts.push(resolved);

        auditEvents.push({
          id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          alert_id: prev.id,
          organization_id: prev.organization_id,
          event_type: 'resolved',
          previous_status: prev.status,
          new_status: 'resolved',
          user_id: null,
          notes: 'Condition cleared in latest financial evaluation.',
          created_at: new Date().toISOString(),
        });
      }
    }

    return {
      activeAlerts,
      newAlerts,
      updatedAlerts,
      resolvedAlerts,
      reactivatedAlerts,
      auditEvents,
    };
  }

  /**
   * User-driven Lifecycle State Transitions
   */
  public static transitionStatus(
    alert: FinancialAlertRow,
    newStatus: AlertStatus,
    userId: string | null,
    notes?: string
  ): { updatedAlert: FinancialAlertRow; event: AlertEventRow } {
    const now = new Date().toISOString();
    const updatedAlert: FinancialAlertRow = {
      ...alert,
      status: newStatus,
      updated_at: now,
    };

    let eventType: AlertEventRow['event_type'] = 'acknowledged';

    if (newStatus === 'acknowledged') {
      updatedAlert.acknowledged_at = now;
      eventType = 'acknowledged';
    } else if (newStatus === 'resolved') {
      updatedAlert.resolved_at = now;
      eventType = 'resolved';
    } else if (newStatus === 'dismissed') {
      updatedAlert.dismissed_at = now;
      eventType = 'dismissed';
    } else if (newStatus === 'active') {
      updatedAlert.reactivated_at = now;
      eventType = 'reactivated';
    }

    const event: AlertEventRow = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      alert_id: alert.id,
      organization_id: alert.organization_id,
      event_type: eventType,
      previous_status: alert.status,
      new_status: newStatus,
      user_id: userId,
      notes: notes || `User transitioned alert from ${alert.status} to ${newStatus}`,
      created_at: now,
    };

    return { updatedAlert, event };
  }
}
