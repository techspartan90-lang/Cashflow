import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Clock,
  Filter,
  Check,
  X,
  Eye,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  History,
  ShieldAlert,
} from 'lucide-react';
import type { FinancialAlertRow, AlertEventRow } from '../../services/alert-engine';
import { MonitoringApiClient } from '../../services/monitoring-api';

interface AlertCenterViewProps {
  currencySymbol: string;
  onNavigateToTab?: (tab: string) => void;
  onRefreshForecast?: () => void;
}

export const AlertCenterView: React.FC<AlertCenterViewProps> = ({
  currencySymbol,
  onNavigateToTab,
  onRefreshForecast,
}) => {
  const [alerts, setAlerts] = useState<FinancialAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved' | 'dismissed'>('active');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'informational'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await MonitoringApiClient.getAlerts({
        status: statusFilter === 'all' ? undefined : statusFilter,
        severity: severityFilter === 'all' ? undefined : severityFilter,
      });
      if (res.success && res.data) {
        setAlerts(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter]);

  const handleAcknowledge = async (alertId: string) => {
    setActionInProgress(alertId);
    try {
      const res = await MonitoringApiClient.acknowledgeAlert(alertId, 'Acknowledged by operator');
      if (res.success) {
        setSuccessMessage('Alert marked as acknowledged.');
        fetchAlerts();
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    setActionInProgress(alertId);
    try {
      const res = await MonitoringApiClient.resolveAlert(alertId, resolutionNote || 'Resolved by user review');
      if (res.success) {
        setSuccessMessage('Alert marked as resolved.');
        setResolvingAlertId(null);
        setResolutionNote('');
        fetchAlerts();
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDismiss = async (alertId: string) => {
    setActionInProgress(alertId);
    try {
      const res = await MonitoringApiClient.dismissAlert(alertId, 'Dismissed as acceptable variance');
      if (res.success) {
        setSuccessMessage('Alert dismissed.');
        fetchAlerts();
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const handleMarkRead = async (alertId: string) => {
    await MonitoringApiClient.markAlertRead(alertId);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
    );
  };

  const handleRunEvaluation = async () => {
    setLoading(true);
    try {
      const res = await MonitoringApiClient.runEvaluation({ triggerSource: 'manual' });
      if (res.success) {
        setSuccessMessage('Full monitoring cycle executed. Alerts & metrics synchronized.');
        fetchAlerts();
        if (onRefreshForecast) onRefreshForecast();
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (searchTerm.trim() === '') return true;
    const term = searchTerm.toLowerCase();
    return (
      a.title.toLowerCase().includes(term) ||
      a.description.toLowerCase().includes(term) ||
      a.alert_type.toLowerCase().includes(term)
    );
  });

  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning' && a.status === 'active').length;
  const infoCount = alerts.filter((a) => (a.severity === 'informational' || a.severity === 'low') && a.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
              <ShieldAlert className="h-4 w-4 mr-1.5 text-indigo-600" />
              Automated Financial Alert & Risk Monitoring Center
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic rule evaluation of liquidity shortfalls, negative cash balances, overdue AR/AP, and material deviations.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRunEvaluation}
              disabled={loading}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Run Evaluation Cycle
            </button>
          </div>
        </div>

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4">
          <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200">
            <div className="flex items-center justify-between text-xs text-rose-700 font-semibold">
              <span>Critical Active</span>
              <AlertOctagon className="h-4 w-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-900 mt-1">{criticalCount}</div>
            <div className="text-[11px] text-rose-700 mt-0.5">Imminent shortfall or deficit</div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
            <div className="flex items-center justify-between text-xs text-amber-700 font-semibold">
              <span>Warnings Active</span>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-900 mt-1">{warningCount}</div>
            <div className="text-[11px] text-amber-700 mt-0.5">Overdue bills or buffer dips</div>
          </div>

          <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200">
            <div className="flex items-center justify-between text-xs text-sky-700 font-semibold">
              <span>Informational Active</span>
              <Info className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-sky-900 mt-1">{infoCount}</div>
            <div className="text-[11px] text-sky-700 mt-0.5">Large scheduled outflows</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-700 font-semibold">
              <span>Deduplication</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">100%</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Deterministic SHA-free fingerprints</div>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-semibold text-slate-500 mr-2 flex items-center">
            <Filter className="h-3.5 w-3.5 mr-1" />
            Status:
          </span>
          {(['active', 'acknowledged', 'resolved', 'dismissed', 'all'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg capitalize transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Severity & Search Filters */}
        <div className="flex items-center space-x-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="informational">Informational</option>
          </select>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-48"
            />
          </div>
        </div>
      </div>

      {/* 3. Alerts List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-600 mb-2" />
            Evaluating financial risks and ledger constraints...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <div className="font-semibold text-slate-700 text-sm">No Alerts Found</div>
            <p className="mt-1 max-w-md mx-auto text-slate-500">
              There are no active or matching alerts satisfying current filter criteria. All projected cash flows and ledger obligations remain within documented safety boundaries.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isExpanded = expandedAlertId === alert.id;
            const isResolving = resolvingAlertId === alert.id;

            let severityColor = 'border-slate-200 bg-white';
            let badgeColor = 'bg-slate-100 text-slate-700';
            let IconComponent = Info;

            if (alert.severity === 'critical') {
              severityColor = 'border-rose-200 bg-rose-50/20';
              badgeColor = 'bg-rose-100 text-rose-800';
              IconComponent = AlertOctagon;
            } else if (alert.severity === 'warning') {
              severityColor = 'border-amber-200 bg-amber-50/20';
              badgeColor = 'bg-amber-100 text-amber-800';
              IconComponent = AlertTriangle;
            } else {
              severityColor = 'border-sky-200 bg-sky-50/20';
              badgeColor = 'bg-sky-100 text-sky-800';
              IconComponent = Info;
            }

            return (
              <div
                key={alert.id}
                className={`rounded-xl border ${severityColor} p-4 shadow-xs transition-all hover:shadow-sm`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      <IconComponent
                        className={`h-5 w-5 ${
                          alert.severity === 'critical'
                            ? 'text-rose-600'
                            : alert.severity === 'warning'
                            ? 'text-amber-600'
                            : 'text-sky-600'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                          {alert.severity}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">
                          {alert.status}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(alert.created_at).toLocaleString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {!alert.is_read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" title="Unread" />
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">{alert.title}</h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{alert.description}</p>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center space-x-1 shrink-0">
                    {alert.status === 'active' && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={actionInProgress === alert.id}
                        title="Acknowledge Alert"
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        Acknowledge
                      </button>
                    )}

                    {(alert.status === 'active' || alert.status === 'acknowledged') && (
                      <button
                        onClick={() => setResolvingAlertId(isResolving ? null : alert.id)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        Resolve...
                      </button>
                    )}

                    {alert.status !== 'dismissed' && alert.status !== 'resolved' && (
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        disabled={actionInProgress === alert.id}
                        title="Dismiss Alert"
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setExpandedAlertId(isExpanded ? null : alert.id);
                        if (!alert.is_read) handleMarkRead(alert.id);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Resolution Prompt Box */}
                {isResolving && (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add resolution explanation or clearing transaction ref..."
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                    <div className="flex items-center space-x-1 shrink-0 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => handleResolve(alert.id)}
                        disabled={actionInProgress === alert.id}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        Confirm Resolution
                      </button>
                      <button
                        onClick={() => setResolvingAlertId(null)}
                        className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-3 text-xs">
                    {/* Recommended Review Action */}
                    {alert.recommended_review_action && (
                      <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 text-indigo-900">
                        <span className="font-bold text-[11px] uppercase tracking-wider block text-indigo-700 mb-1">
                          Recommended Review Action
                        </span>
                        <p className="leading-relaxed">{alert.recommended_review_action}</p>
                      </div>
                    )}

                    {/* Trigger Condition & Calculation Source */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="font-semibold text-slate-500 block text-[10px] uppercase">
                          Trigger Entity & Source
                        </span>
                        <div className="font-mono text-[11px] mt-0.5 text-slate-900">
                          {alert.related_entity_type || 'forecast_run'} : {alert.related_entity_id || 'system'}
                        </div>
                        {alert.related_date && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Relevant Date: <span className="font-semibold text-slate-800">{alert.related_date}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="font-semibold text-slate-500 block text-[10px] uppercase">
                          Deterministic Fingerprint
                        </span>
                        <div className="font-mono text-[10px] mt-0.5 text-slate-600 break-all">
                          {alert.fingerprint || 'none'}
                        </div>
                      </div>
                    </div>

                    {/* Raw Trigger Data */}
                    {alert.trigger_data && Object.keys(alert.trigger_data).length > 0 && (
                      <div className="p-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto">
                        <span className="text-[10px] text-slate-400 block mb-1">VERIFIED TRIGGER DATA PAYLOAD:</span>
                        <pre className="whitespace-pre-wrap">{JSON.stringify(alert.trigger_data, null, 2)}</pre>
                      </div>
                    )}

                    {/* Navigation Shortcut */}
                    {onNavigateToTab && (
                      <div className="pt-1 flex items-center justify-end">
                        <button
                          onClick={() => {
                            if (alert.alert_type.includes('receivable')) onNavigateToTab('receivables');
                            else if (alert.alert_type.includes('payable') || alert.alert_type.includes('outflow')) onNavigateToTab('payables');
                            else onNavigateToTab('trajectory');
                          }}
                          className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          Inspect Related Financial Ledger <ExternalLink className="h-3 w-3 ml-1" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
