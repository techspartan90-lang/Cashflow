import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { FinancialAlert } from '../../types/financial';

interface AlertsPanelProps {
  alerts: FinancialAlert[];
  onAcknowledge: (id: string) => void;
  currencySymbol: string;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  onAcknowledge,
  currencySymbol,
}) => {
  if (alerts.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center space-x-3 text-xs text-emerald-800 mb-6">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <div>
          <span className="font-semibold">All Liquidity Buffers Nominal:</span> No immediate
          threshold breaches or payment concentration anomalies detected.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 mb-6">
      {alerts.map((alert) => {
        const isCritical = alert.severity === 'critical';
        const isWarning = alert.severity === 'warning';

        return (
          <div
            key={alert.id}
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs transition-all ${
              isCritical
                ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                : isWarning
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
            }`}
          >
            <div className="flex items-start space-x-3">
              {isCritical ? (
                <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              ) : isWarning ? (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold tracking-tight text-slate-900">
                    {alert.title}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                      isCritical
                        ? 'bg-rose-200 text-rose-900'
                        : isWarning
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-indigo-200 text-indigo-900'
                    }`}
                  >
                    {alert.severity}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {alert.date}
                  </span>
                </div>
                <p className="mt-1 text-slate-700 leading-relaxed">{alert.message}</p>
                <div className="mt-1.5 font-medium text-slate-800">
                  <span className="font-semibold text-slate-900">Recommended Action:</span>{' '}
                  {alert.recommendationAction}
                </div>
              </div>
            </div>

            <button
              onClick={() => onAcknowledge(alert.id)}
              className="self-end sm:self-center px-3 py-1.5 rounded-lg font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              Acknowledge
            </button>
          </div>
        );
      })}
    </div>
  );
};
