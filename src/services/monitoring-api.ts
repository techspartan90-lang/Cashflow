/**
 * Monitoring, Alerts, Variance & Recommendations API Client
 * CashFlow Intelligence — Phase 7: Front-to-Back Contract
 */

import type { FinancialAlertRow, AlertRuleRow, AlertEventRow } from './alert-engine';
import type { ForecastVarianceRow, VarianceSummaryReport } from './variance-engine';
import type { RecommendationRow } from './recommendation-engine';
import type { InAppNotification, NotificationPrefRow } from './monitoring-service';

export const MonitoringApiClient = {
  /**
   * Fetch active and historical alerts with optional filtering
   */
  async getAlerts(params?: {
    organizationId?: string;
    status?: string;
    severity?: string;
    alertType?: string;
  }): Promise<{ success: boolean; data: FinancialAlertRow[]; error?: string }> {
    try {
      const qs = new URLSearchParams();
      if (params?.organizationId) qs.set('organizationId', params.organizationId);
      if (params?.status) qs.set('status', params.status);
      if (params?.severity) qs.set('severity', params.severity);
      if (params?.alertType) qs.set('alertType', params.alertType);

      const res = await fetch(`/api/alerts?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, data: [], error: err.message || 'Failed to fetch alerts' };
    }
  },

  /**
   * Acknowledge an active alert
   */
  async acknowledgeAlert(
    alertId: string,
    notes?: string
  ): Promise<{ success: boolean; data?: FinancialAlertRow; error?: string }> {
    try {
      const res = await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    notes?: string
  ): Promise<{ success: boolean; data?: FinancialAlertRow; error?: string }> {
    try {
      const res = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Dismiss an alert
   */
  async dismissAlert(
    alertId: string,
    notes?: string
  ): Promise<{ success: boolean; data?: FinancialAlertRow; error?: string }> {
    try {
      const res = await fetch(`/api/alerts/${alertId}/dismiss`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Mark alert as read
   */
  async markAlertRead(alertId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/alerts/${alertId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch alert rules
   */
  async getAlertRules(organizationId?: string): Promise<{ success: boolean; data: AlertRuleRow[]; error?: string }> {
    try {
      const qs = organizationId ? `?organizationId=${organizationId}` : '';
      const res = await fetch(`/api/alert-rules${qs}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, data: [], error: err.message };
    }
  },

  /**
   * Save or update alert rule
   */
  async saveAlertRule(payload: Partial<AlertRuleRow>): Promise<{ success: boolean; data?: AlertRuleRow; error?: string }> {
    try {
      const res = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch in-app notifications
   */
  async getNotifications(organizationId?: string): Promise<{ success: boolean; data: InAppNotification[]; error?: string }> {
    try {
      const qs = organizationId ? `?organizationId=${organizationId}` : '';
      const res = await fetch(`/api/notifications${qs}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, data: [], error: err.message };
    }
  },

  /**
   * Mark notification as read
   */
  async markNotificationRead(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch notification preferences
   */
  async getNotificationPreferences(organizationId?: string): Promise<{ success: boolean; data: NotificationPrefRow[]; error?: string }> {
    try {
      const qs = organizationId ? `?organizationId=${organizationId}` : '';
      const res = await fetch(`/api/notification-preferences${qs}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, data: [], error: err.message };
    }
  },

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    preferences: Partial<NotificationPrefRow>[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch historical daily variance comparisons
   */
  async getVariance(organizationId?: string, forecastId?: string): Promise<{ success: boolean; data: ForecastVarianceRow[]; error?: string }> {
    try {
      const qs = new URLSearchParams();
      if (organizationId) qs.set('organizationId', organizationId);
      if (forecastId) qs.set('forecastId', forecastId);
      const res = await fetch(`/api/variance?${qs.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, data: [], error: err.message };
    }
  },

  /**
   * Fetch variance summary metrics (MAE, RMSE, Bias, deviations count)
   */
  async getVarianceSummary(
    organizationId?: string,
    forecastId?: string
  ): Promise<{ success: boolean; data?: VarianceSummaryReport; error?: string }> {
    try {
      const qs = new URLSearchParams();
      if (organizationId) qs.set('organizationId', organizationId);
      if (forecastId) qs.set('forecastId', forecastId);
      const res = await fetch(`/api/variance/summary?${qs.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Run full automated monitoring evaluation
   */
  async runEvaluation(payload: {
    organizationId?: string;
    triggerSource?: string;
    asOfDate?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch('/api/monitoring/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch actionable recommendations
   */
  async getRecommendations(organizationId?: string): Promise<{ success: boolean; data: RecommendationRow[]; error?: string }> {
    try {
      const qs = organizationId ? `?organizationId=${organizationId}` : '';
      const res = await fetch(`/api/recommendations${qs}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, data: [], error: err.message };
    }
  },
};
