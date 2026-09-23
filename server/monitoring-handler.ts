/**
 * Monitoring, Alerts, Variance & Recommendations Backend Handlers
 * CashFlow Intelligence — Phase 7
 */

import { IncomingMessage, ServerResponse } from 'http';
import {
  AlertEngine,
  AlertEvaluationContext,
  FinancialAlertRow,
  AlertRuleRow,
  AlertEventRow,
  DEFAULT_ALERT_THRESHOLDS,
} from '../src/services/alert-engine';
import {
  VarianceEngine,
  ForecastVarianceRow,
  VarianceSummaryReport,
  ActualDayCashRecord,
  ProjectedDayRecord,
} from '../src/services/variance-engine';
import {
  RecommendationEngine,
  RecommendationRow,
} from '../src/services/recommendation-engine';
import {
  MonitoringService,
  NotificationPrefRow,
  InAppNotification,
} from '../src/services/monitoring-service';
import { ForecastEngine } from '../src/services/forecast-engine';
import { inMemoryStore } from './import-handler';
import { forecastStore } from './forecast-handler';

const DEFAULT_ORG_ID = '11111111-1111-1111-1111-111111111111';

// Persistent in-memory data store for monitoring entities
export const monitoringStore = {
  alerts: new Map<string, FinancialAlertRow[]>(), // orgId -> FinancialAlertRow[]
  alertRules: new Map<string, AlertRuleRow[]>(), // orgId -> AlertRuleRow[]
  alertEvents: new Map<string, AlertEventRow[]>(), // orgId -> AlertEventRow[]
  notificationPreferences: new Map<string, NotificationPrefRow[]>(), // orgId -> NotificationPrefRow[]
  forecastVariances: new Map<string, ForecastVarianceRow[]>(), // orgId -> ForecastVarianceRow[]
  recommendations: new Map<string, RecommendationRow[]>(), // orgId -> RecommendationRow[]
  notificationsRead: new Set<string>(), // set of read notification IDs
};

/**
 * Seed initial realistic state for the default organization
 */
export function initializeMonitoringDefaults(orgId: string = DEFAULT_ORG_ID) {
  if (!monitoringStore.alertRules.has(orgId)) {
    const defaultRules: AlertRuleRow[] = [
      {
        id: `rule-shortfall-${orgId}`,
        organization_id: orgId,
        alert_type: 'cash_shortfall',
        threshold_value: 100000.0,
        threshold_method: 'absolute_value',
        is_active: true,
        created_by: null,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: `rule-approaching-${orgId}`,
        organization_id: orgId,
        alert_type: 'approaching_threshold',
        threshold_value: 25000.0, // ₹25k buffer margin
        threshold_method: 'absolute_value',
        is_active: true,
        created_by: null,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: `rule-large-outflow-${orgId}`,
        organization_id: orgId,
        alert_type: 'large_outflow',
        threshold_value: 50000.0, // ₹50k single outflow
        threshold_method: 'absolute_value',
        is_active: true,
        created_by: null,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: `rule-deviation-${orgId}`,
        organization_id: orgId,
        alert_type: 'forecast_deviation',
        threshold_value: 25000.0, // ₹25k divergence
        threshold_method: 'absolute_value',
        is_active: true,
        created_by: null,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ];
    monitoringStore.alertRules.set(orgId, defaultRules);
  }

  if (!monitoringStore.notificationPreferences.has(orgId)) {
    const defaultPrefs: NotificationPrefRow[] = [
      {
        id: `pref-shortfall-${orgId}`,
        organization_id: orgId,
        user_id: '00000000-0000-0000-0000-000000000001',
        alert_type: 'cash_shortfall',
        minimum_severity: 'warning',
        in_app_enabled: true,
        email_enabled: false,
        quiet_hours_start: '22:00:00',
        quiet_hours_end: '07:00:00',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: `pref-negative-${orgId}`,
        organization_id: orgId,
        user_id: '00000000-0000-0000-0000-000000000001',
        alert_type: 'negative_cash',
        minimum_severity: 'critical',
        in_app_enabled: true,
        email_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: `pref-receivable-${orgId}`,
        organization_id: orgId,
        user_id: '00000000-0000-0000-0000-000000000001',
        alert_type: 'overdue_receivable',
        minimum_severity: 'informational',
        in_app_enabled: true,
        email_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ];
    monitoringStore.notificationPreferences.set(orgId, defaultPrefs);
  }

  // Pre-seed realistic variance records if empty
  if (!monitoringStore.forecastVariances.has(orgId)) {
    const historicalVariances: ForecastVarianceRow[] = [
      {
        id: `var-hist-01`,
        organization_id: orgId,
        forecast_id: 'fc-v1',
        forecast_date: '2026-09-18',
        forecast_inflows: 85000.0,
        actual_inflows: 85000.0,
        forecast_outflows: 20000.0,
        actual_outflows: 21500.0,
        forecast_net_cash_flow: 65000.0,
        actual_net_cash_flow: 63500.0,
        forecast_ending_cash: 265000.0,
        actual_ending_cash: 263500.0,
        absolute_variance: 1500.0,
        signed_variance: -1500.0,
        is_material_deviation: false,
        category_variances: {},
        notes: null,
        created_at: '2026-09-19T00:00:00Z',
      },
      {
        id: `var-hist-02`,
        organization_id: orgId,
        forecast_id: 'fc-v1',
        forecast_date: '2026-09-19',
        forecast_inflows: 40000.0,
        actual_inflows: 40000.0,
        forecast_outflows: 15000.0,
        actual_outflows: 15000.0,
        forecast_net_cash_flow: 25000.0,
        actual_net_cash_flow: 25000.0,
        forecast_ending_cash: 290000.0,
        actual_ending_cash: 288500.0,
        absolute_variance: 1500.0,
        signed_variance: -1500.0,
        is_material_deviation: false,
        category_variances: {},
        notes: null,
        created_at: '2026-09-20T00:00:00Z',
      },
      {
        id: `var-hist-03`,
        organization_id: orgId,
        forecast_id: 'fc-v1',
        forecast_date: '2026-09-20',
        forecast_inflows: 0.0,
        actual_inflows: 0.0,
        forecast_outflows: 12000.0,
        actual_outflows: 12000.0,
        forecast_net_cash_flow: -12000.0,
        actual_net_cash_flow: -12000.0,
        forecast_ending_cash: 278000.0,
        actual_ending_cash: 276500.0,
        absolute_variance: 1500.0,
        signed_variance: -1500.0,
        is_material_deviation: false,
        category_variances: {},
        notes: null,
        created_at: '2026-09-21T00:00:00Z',
      },
      {
        id: `var-hist-04`,
        organization_id: orgId,
        forecast_id: 'fc-v1',
        forecast_date: '2026-09-21',
        forecast_inflows: 60000.0,
        actual_inflows: 58000.0,
        forecast_outflows: 45000.0,
        actual_outflows: 46000.0,
        forecast_net_cash_flow: 15000.0,
        actual_net_cash_flow: 12000.0,
        forecast_ending_cash: 293000.0,
        actual_ending_cash: 288500.0,
        absolute_variance: 4500.0,
        signed_variance: -4500.0,
        is_material_deviation: false,
        category_variances: {},
        notes: null,
        created_at: '2026-09-22T00:00:00Z',
      },
      {
        id: `var-hist-05`,
        organization_id: orgId,
        forecast_id: 'fc-v1',
        forecast_date: '2026-09-22',
        forecast_inflows: 110000.0,
        actual_inflows: 60000.0, // -50k collection delay
        forecast_outflows: 30000.0,
        actual_outflows: 38000.0, // +8k unbudgeted emergency repair
        forecast_net_cash_flow: 80000.0,
        actual_net_cash_flow: 22000.0,
        forecast_ending_cash: 373000.0,
        actual_ending_cash: 315000.0,
        absolute_variance: 58000.0,
        signed_variance: -58000.0,
        is_material_deviation: true,
        category_variances: {},
        notes: 'Material divergence: Delayed ₹50,000 retail receivable collection combined with unplanned emergency machinery repair ₹8,000.',
        created_at: '2026-09-23T00:00:00Z',
      },
    ];
    monitoringStore.forecastVariances.set(orgId, historicalVariances);
  }

  // Pre-seed initial alert evaluation if empty
  if (!monitoringStore.alerts.has(orgId) || monitoringStore.alerts.get(orgId)!.length === 0) {
    executeFullEvaluation(orgId, '2026-09-23', 'scheduled');
  }
}

/**
 * Execute full evaluation cycle (Alerts, Recommendations)
 */
export function executeFullEvaluation(
  orgId: string,
  asOfDate: string = '2026-09-23',
  triggerSource: string = 'manual'
) {
  initializeMonitoringDefaults(orgId);

  // 1. Build context
  const ar = inMemoryStore.receivables.get(orgId) || [];
  const ap = inMemoryStore.payables.get(orgId) || [];
  const bankAccs = forecastStore.bankAccounts.get(orgId) || [];
  const recurring = forecastStore.recurringFlows.get(orgId) || [];

  const openingCash = bankAccs
    .filter((b) => b.is_active)
    .reduce((sum, b) => sum + Number(b.current_balance), 0);

  // Generate baseline deterministic forecast
  const baseForecast = ForecastEngine.runForecast({
    organizationId: orgId,
    startDate: asOfDate,
    horizonDays: 30,
    openingCashOverride: openingCash || 250000.0,
    minimumCashThreshold: 100000.0,
    receivables: ar,
    payables: ap,
    recurringFlows: recurring,
  });

  const existingAlerts = monitoringStore.alerts.get(orgId) || [];
  const customRules = monitoringStore.alertRules.get(orgId) || [];

  const evalContext: AlertEvaluationContext = {
    organizationId: orgId,
    asOfDate,
    forecast: baseForecast,
    receivables: ar,
    payables: ap,
    customRules,
    existingAlerts,
  };

  const evalResult = AlertEngine.evaluateAll(evalContext);

  // Store updated alerts
  monitoringStore.alerts.set(orgId, evalResult.activeAlerts);

  // Store audit events
  const existingEvents = monitoringStore.alertEvents.get(orgId) || [];
  monitoringStore.alertEvents.set(orgId, [...existingEvents, ...evalResult.auditEvents]);

  // Compute variance summary
  const variances = monitoringStore.forecastVariances.get(orgId) || [];
  const materialThreshold =
    customRules.find((r) => r.alert_type === 'forecast_deviation')?.threshold_value ||
    DEFAULT_ALERT_THRESHOLDS.materialForecastDeviationAmount;

  const comparisons = variances.map((v) => ({
    date: v.forecast_date,
    forecastInflows: v.forecast_inflows,
    actualInflows: v.actual_inflows,
    inflowVariance: v.actual_inflows - v.forecast_inflows,
    forecastOutflows: v.forecast_outflows,
    actualOutflows: v.actual_outflows,
    outflowVariance: v.actual_outflows - v.forecast_outflows,
    forecastNetCashFlow: v.forecast_net_cash_flow,
    actualNetCashFlow: v.actual_net_cash_flow,
    netCashFlowVariance: v.actual_net_cash_flow - v.forecast_net_cash_flow,
    forecastEndingCash: v.forecast_ending_cash,
    actualEndingCash: v.actual_ending_cash,
    endingCashVariance: v.signed_variance,
    absoluteVariance: v.absolute_variance,
    isMaterialDeviation: v.is_material_deviation,
    deviationReason: v.notes || undefined,
  }));

  const varianceSummary: VarianceSummaryReport = {
    organizationId: orgId,
    forecastId: baseForecast.forecastId,
    evaluationStartDate: comparisons.length > 0 ? comparisons[0].date : asOfDate,
    evaluationEndDate: comparisons.length > 0 ? comparisons[comparisons.length - 1].date : asOfDate,
    totalDaysEvaluated: comparisons.length,
    meanAbsoluteError:
      comparisons.length > 0
        ? comparisons.reduce((acc, c) => acc + c.absoluteVariance, 0) / comparisons.length
        : 0,
    rootMeanSquareError:
      comparisons.length >= 3
        ? Math.sqrt(
            comparisons.reduce((acc, c) => acc + c.absoluteVariance * c.absoluteVariance, 0) /
              comparisons.length
          )
        : null,
    bias:
      comparisons.length > 0
        ? comparisons.reduce((acc, c) => acc + c.endingCashVariance, 0) / comparisons.length
        : 0,
    materialDeviationsCount: comparisons.filter((c) => c.isMaterialDeviation).length,
    maxAbsoluteDeviation:
      comparisons.length > 0 ? Math.max(...comparisons.map((c) => c.absoluteVariance)) : 0,
    maxDeviationDate:
      comparisons.find((c) => c.absoluteVariance === Math.max(...comparisons.map((x) => x.absoluteVariance)))
        ?.date || null,
    inflowTotalForecast: comparisons.reduce((acc, c) => acc + c.forecastInflows, 0),
    inflowTotalActual: comparisons.reduce((acc, c) => acc + c.actualInflows, 0),
    outflowTotalForecast: comparisons.reduce((acc, c) => acc + c.forecastOutflows, 0),
    outflowTotalActual: comparisons.reduce((acc, c) => acc + c.actualOutflows, 0),
    dailyComparisons: comparisons,
    sufficientDataForRmse: comparisons.length >= 3,
  };

  // Generate evidence-backed recommendations
  const recommendations = RecommendationEngine.generateRecommendations({
    organizationId: orgId,
    asOfDate,
    forecast: baseForecast,
    activeAlerts: evalResult.activeAlerts,
    varianceSummary,
    receivables: ar,
    payables: ap,
  });

  monitoringStore.recommendations.set(orgId, recommendations);

  return {
    evalResult,
    varianceSummary,
    recommendations,
  };
}

// Helpers
function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody<T = any>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Main HTTP API Route Dispatcher for Phase 7 Monitoring Endpoints
 */
export async function handleMonitoringApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const pathname = url.pathname;
  const orgId = url.searchParams.get('organizationId') || DEFAULT_ORG_ID;
  initializeMonitoringDefaults(orgId);

  // 1. GET /api/alerts
  if (req.method === 'GET' && pathname === '/api/alerts') {
    const statusFilter = url.searchParams.get('status');
    const severityFilter = url.searchParams.get('severity');
    const typeFilter = url.searchParams.get('alertType');

    let alerts = monitoringStore.alerts.get(orgId) || [];

    if (statusFilter && statusFilter !== 'all') {
      alerts = alerts.filter((a) => a.status === statusFilter);
    }
    if (severityFilter && severityFilter !== 'all') {
      alerts = alerts.filter((a) => a.severity === severityFilter);
    }
    if (typeFilter && typeFilter !== 'all') {
      alerts = alerts.filter((a) => a.alert_type === typeFilter);
    }

    sendJson(res, 200, { success: true, data: alerts });
    return true;
  }

  // 2. Alert Lifecycle Actions: PATCH /api/alerts/:id/:action
  if (req.method === 'PATCH' && pathname.startsWith('/api/alerts/')) {
    const segments = pathname.replace('/api/alerts/', '').split('/');
    const alertId = segments[0];
    const action = segments[1];

    const alerts = monitoringStore.alerts.get(orgId) || [];
    const alertIndex = alerts.findIndex((a) => a.id === alertId);

    if (alertIndex === -1) {
      sendJson(res, 404, { success: false, error: 'Alert not found' });
      return true;
    }

    const currentAlert = alerts[alertIndex];
    const body = await parseJsonBody(req).catch(() => ({}));
    const notes = body.notes || undefined;
    const userId = body.userId || null;

    let targetStatus: any = currentAlert.status;
    if (action === 'acknowledge') targetStatus = 'acknowledged';
    else if (action === 'resolve') targetStatus = 'resolved';
    else if (action === 'dismiss') targetStatus = 'dismissed';
    else if (action === 'read') {
      currentAlert.is_read = true;
      currentAlert.updated_at = new Date().toISOString();
      sendJson(res, 200, { success: true, data: currentAlert });
      return true;
    }

    const { updatedAlert, event } = AlertEngine.transitionStatus(
      currentAlert,
      targetStatus,
      userId,
      notes
    );

    alerts[alertIndex] = updatedAlert;
    monitoringStore.alerts.set(orgId, alerts);

    const existingEvents = monitoringStore.alertEvents.get(orgId) || [];
    monitoringStore.alertEvents.set(orgId, [event, ...existingEvents]);

    sendJson(res, 200, { success: true, data: updatedAlert });
    return true;
  }

  // 3. GET & POST /api/alert-rules
  if (pathname === '/api/alert-rules') {
    if (req.method === 'GET') {
      const rules = monitoringStore.alertRules.get(orgId) || [];
      sendJson(res, 200, { success: true, data: rules });
      return true;
    }

    if (req.method === 'POST') {
      const body = await parseJsonBody<Partial<AlertRuleRow>>(req);
      const rules = monitoringStore.alertRules.get(orgId) || [];

      if (!body.alert_type) {
        sendJson(res, 400, { success: false, error: 'alert_type is required' });
        return true;
      }

      const existingIndex = rules.findIndex((r) => r.alert_type === body.alert_type);
      const now = new Date().toISOString();

      if (existingIndex >= 0) {
        rules[existingIndex] = {
          ...rules[existingIndex],
          threshold_value: Number(body.threshold_value ?? rules[existingIndex].threshold_value),
          threshold_method: body.threshold_method || rules[existingIndex].threshold_method,
          is_active: body.is_active !== undefined ? body.is_active : rules[existingIndex].is_active,
          updated_at: now,
        };
        monitoringStore.alertRules.set(orgId, rules);
        sendJson(res, 200, { success: true, data: rules[existingIndex] });
      } else {
        const newRule: AlertRuleRow = {
          id: `rule-${Date.now()}`,
          organization_id: orgId,
          alert_type: body.alert_type,
          threshold_value: Number(body.threshold_value ?? 0),
          threshold_method: body.threshold_method || 'absolute_value',
          is_active: body.is_active !== undefined ? body.is_active : true,
          created_by: null,
          created_at: now,
          updated_at: now,
        };
        rules.push(newRule);
        monitoringStore.alertRules.set(orgId, rules);
        sendJson(res, 201, { success: true, data: newRule });
      }
      return true;
    }
  }

  // 4. GET & PATCH /api/notifications
  if (pathname === '/api/notifications') {
    if (req.method === 'GET') {
      const alerts = monitoringStore.alerts.get(orgId) || [];
      const prefs = monitoringStore.notificationPreferences.get(orgId) || [];
      const notifications = MonitoringService.filterNotifications(alerts, prefs);

      // Apply read status override
      const enriched = notifications.map((n) => ({
        ...n,
        isRead: n.isRead || monitoringStore.notificationsRead.has(n.id),
      }));

      sendJson(res, 200, { success: true, data: enriched });
      return true;
    }
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/notifications/') && pathname.endsWith('/read')) {
    const notifId = pathname.replace('/api/notifications/', '').replace('/read', '');
    monitoringStore.notificationsRead.add(notifId);
    sendJson(res, 200, { success: true, data: { id: notifId, isRead: true } });
    return true;
  }

  // 5. GET & PATCH /api/notification-preferences
  if (pathname === '/api/notification-preferences') {
    if (req.method === 'GET') {
      const prefs = monitoringStore.notificationPreferences.get(orgId) || [];
      sendJson(res, 200, { success: true, data: prefs });
      return true;
    }

    if (req.method === 'PATCH') {
      const body = await parseJsonBody(req);
      const incomingPrefs: Partial<NotificationPrefRow>[] = body.preferences || [];
      const prefs = monitoringStore.notificationPreferences.get(orgId) || [];

      for (const inc of incomingPrefs) {
        const idx = prefs.findIndex((p) => p.alert_type === inc.alert_type);
        if (idx >= 0) {
          prefs[idx] = {
            ...prefs[idx],
            ...inc,
            updated_at: new Date().toISOString(),
          };
        }
      }

      monitoringStore.notificationPreferences.set(orgId, prefs);
      sendJson(res, 200, { success: true, data: prefs });
      return true;
    }
  }

  // 6. GET /api/variance and GET /api/variance/summary
  if (pathname === '/api/variance') {
    if (req.method === 'GET') {
      const variances = monitoringStore.forecastVariances.get(orgId) || [];
      sendJson(res, 200, { success: true, data: variances });
      return true;
    }
  }

  if (pathname === '/api/variance/summary') {
    if (req.method === 'GET') {
      const result = executeFullEvaluation(orgId, '2026-09-23', 'manual');
      sendJson(res, 200, { success: true, data: result.varianceSummary });
      return true;
    }
  }

  // 7. POST /api/monitoring/evaluate
  if (pathname === '/api/monitoring/evaluate' && req.method === 'POST') {
    const body = await parseJsonBody(req).catch(() => ({}));
    const asOf = body.asOfDate || '2026-09-23';
    const triggerSource = body.triggerSource || 'manual';

    const result = executeFullEvaluation(orgId, asOf, triggerSource);
    sendJson(res, 200, {
      success: true,
      data: {
        activeAlertsCount: result.evalResult.activeAlerts.length,
        newAlertsCount: result.evalResult.newAlerts.length,
        resolvedAlertsCount: result.evalResult.resolvedAlerts.length,
        reactivatedAlertsCount: result.evalResult.reactivatedAlerts.length,
        materialDeviationsCount: result.varianceSummary.materialDeviationsCount,
        recommendationsCount: result.recommendations.length,
        evaluatedAt: new Date().toISOString(),
      },
    });
    return true;
  }

  // 8. GET /api/recommendations
  if (pathname === '/api/recommendations' && req.method === 'GET') {
    let recs = monitoringStore.recommendations.get(orgId);
    if (!recs || recs.length === 0) {
      const evaluated = executeFullEvaluation(orgId, '2026-09-23', 'manual');
      recs = evaluated.recommendations;
    }
    sendJson(res, 200, { success: true, data: recs });
    return true;
  }

  return false;
}
