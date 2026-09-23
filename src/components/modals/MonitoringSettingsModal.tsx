import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Bell,
  Mail,
  Moon,
  ShieldCheck,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { MonitoringApiClient } from '../../services/monitoring-api';
import type { AlertRuleRow } from '../../services/alert-engine';
import type { NotificationPrefRow } from '../../services/monitoring-service';

interface MonitoringSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
  onSaved?: () => void;
}

export const MonitoringSettingsModal: React.FC<MonitoringSettingsModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
  onSaved,
}) => {
  const [largeOutflowThreshold, setLargeOutflowThreshold] = useState<number>(50000);
  const [approachingThresholdBuffer, setApproachingThresholdBuffer] = useState<number>(25000);
  const [materialDeviationThreshold, setMaterialDeviationThreshold] = useState<number>(25000);

  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    const [rulesRes, prefsRes] = await Promise.all([
      MonitoringApiClient.getAlertRules(),
      MonitoringApiClient.getNotificationPreferences(),
    ]);

    if (rulesRes.success && rulesRes.data) {
      const outflowRule = rulesRes.data.find((r) => r.alert_type === 'large_outflow');
      if (outflowRule) setLargeOutflowThreshold(Number(outflowRule.threshold_value));

      const approachRule = rulesRes.data.find((r) => r.alert_type === 'approaching_threshold');
      if (approachRule) setApproachingThresholdBuffer(Number(approachRule.threshold_value));

      const devRule = rulesRes.data.find((r) => r.alert_type === 'forecast_deviation');
      if (devRule) setMaterialDeviationThreshold(Number(devRule.threshold_value));
    }

    if (prefsRes.success && prefsRes.data && prefsRes.data.length > 0) {
      const first = prefsRes.data[0];
      setInAppEnabled(first.in_app_enabled);
      setEmailEnabled(first.email_enabled);
      if (first.quiet_hours_start) setQuietHoursStart(first.quiet_hours_start.substring(0, 5));
      if (first.quiet_hours_end) setQuietHoursEnd(first.quiet_hours_end.substring(0, 5));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save rules
      await Promise.all([
        MonitoringApiClient.saveAlertRule({
          alert_type: 'large_outflow',
          threshold_value: largeOutflowThreshold,
          threshold_method: 'absolute_value',
          is_active: true,
        }),
        MonitoringApiClient.saveAlertRule({
          alert_type: 'approaching_threshold',
          threshold_value: approachingThresholdBuffer,
          threshold_method: 'absolute_value',
          is_active: true,
        }),
        MonitoringApiClient.saveAlertRule({
          alert_type: 'forecast_deviation',
          threshold_value: materialDeviationThreshold,
          threshold_method: 'absolute_value',
          is_active: true,
        }),
      ]);

      // Save notification preferences
      await MonitoringApiClient.updateNotificationPreferences([
        {
          alert_type: 'cash_shortfall',
          in_app_enabled: inAppEnabled,
          email_enabled: emailEnabled,
          quiet_hours_start: quietHoursStart ? `${quietHoursStart}:00` : null,
          quiet_hours_end: quietHoursEnd ? `${quietHoursEnd}:00` : null,
        },
        {
          alert_type: 'large_outflow',
          in_app_enabled: inAppEnabled,
          email_enabled: emailEnabled,
        },
        {
          alert_type: 'overdue_receivable',
          in_app_enabled: inAppEnabled,
          email_enabled: emailEnabled,
        },
      ]);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
      if (onSaved) onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <Sliders className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Risk Monitoring & Alert Threshold Configuration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
          {savedSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Monitoring thresholds and notification preferences updated.</span>
            </div>
          )}

          {/* Section 1: Alert Thresholds */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
              Deterministic Alert Thresholds
            </h4>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Cash Approaching Safety Threshold Buffer ({currencySymbol})
              </label>
              <input
                type="number"
                value={approachingThresholdBuffer}
                onChange={(e) => setApproachingThresholdBuffer(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-mono text-xs focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">
                Triggers warning when projected cash comes within this amount of the minimum reserve threshold.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Large Single Outflow Threshold ({currencySymbol})
              </label>
              <input
                type="number"
                value={largeOutflowThreshold}
                onChange={(e) => setLargeOutflowThreshold(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-mono text-xs focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">
                Outflows greater than or equal to this single amount will be individually flagged for clearance review.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Material Forecast Deviation Threshold ({currencySymbol})
              </label>
              <input
                type="number"
                value={materialDeviationThreshold}
                onChange={(e) => setMaterialDeviationThreshold(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-mono text-xs focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">
                Variance between actual bank clearance and forecast exceeding this amount activates recalibration alerts.
              </p>
            </div>
          </div>

          {/* Section 2: Notification Channels */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
              Notification Channels & Delivery
            </h4>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center space-x-2">
                <Bell className="h-4 w-4 text-indigo-600" />
                <div>
                  <div className="font-semibold text-slate-800">In-App Notification Center</div>
                  <div className="text-[11px] text-slate-500">Live bell badges and slide-over feed in the top navigation bar.</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={inAppEnabled}
                onChange={(e) => setInAppEnabled(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-slate-600" />
                <div>
                  <div className="font-semibold text-slate-800">Email Dispatch Extension</div>
                  <div className="text-[11px] text-slate-500">Requires verified SMTP host configuration in server environment.</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
              />
            </div>

            {/* Quiet Hours */}
            <div>
              <div className="flex items-center space-x-1.5 font-semibold text-slate-800 mb-2">
                <Moon className="h-3.5 w-3.5 text-slate-500" />
                <span>Quiet Hours Window (Mute Non-Critical Notifications)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-0.5">Start Time:</span>
                  <input
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-0.5">End Time:</span>
                  <input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};
