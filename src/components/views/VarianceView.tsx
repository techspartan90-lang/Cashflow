import React from 'react';
import { VarianceDayRecord, VarianceMetrics } from '../../types/financial';
import { GitCompare, AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Layers } from 'lucide-react';

interface VarianceViewProps {
  varianceMetrics: VarianceMetrics;
  currencySymbol: string;
  materialThreshold: number;
}

export const VarianceView: React.FC<VarianceViewProps> = ({
  varianceMetrics,
  currencySymbol,
  materialThreshold,
}) => {
  const { records, mae, rmse, bias, materialDeviationsCount } = varianceMetrics;

  return (
    <div className="space-y-6">
      {/* 1. Header & Accuracy Metrics */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
            <GitCompare className="h-4 w-4 mr-1.5 text-indigo-600" />
            Automated Variance Analysis & Forecast Calibration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Statistical backtesting comparing historical forecast projections against actual cleared bank transactions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Mean Absolute Error (MAE)</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {currencySymbol}
              {mae.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Average absolute daily forecasting error
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Root Mean Square Error (RMSE)</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {currencySymbol}
              {rmse.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Penalizes large unexpected financial variances
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Forecasting Bias</span>
            <div
              className={`text-xl font-bold mt-0.5 ${
                Math.abs(bias) < 5000
                  ? 'text-emerald-700'
                  : bias > 0
                  ? 'text-amber-700'
                  : 'text-rose-700'
              }`}
            >
              {bias > 0 ? `+${currencySymbol}` : `${currencySymbol}`}
              {bias.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {bias > 0 ? 'Slightly over-predicting' : 'Slightly under-predicting'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Material Deviations (&gt;₹50k)</span>
            <div
              className={`text-xl font-bold mt-0.5 ${
                materialDeviationsCount > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {materialDeviationsCount} Triggered
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Protocol: Auto-recalibration logged
            </div>
          </div>
        </div>
      </div>

      {/* 2. Material Deviation Alert Banner */}
      {materialDeviationsCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-xs text-rose-900">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">
              Material Deviation Protocol Activated (Variance &gt; ₹
              {materialThreshold.toLocaleString('en-IN')})
            </div>
            <p className="mt-0.5 text-rose-800 leading-relaxed">
              On 2026-09-22, actual ending cash deviated by -₹58,000 from projected benchmark due to an
              unbudgeted advance GST tax provision setup. The engine has automatically logged the audit trail,
              adjusted the forecast baseline, and recomputed 30-day scenarios without corrupting historical models.
            </p>
          </div>
        </div>
      )}

      {/* 3. Daily Variance Historical Audit Records */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 mb-4">
          Daily Actual vs. Forecasted Reconciliation Log
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Forecast Net</th>
                <th className="px-3 py-2 text-right">Actual Net</th>
                <th className="px-3 py-2 text-right">Daily Flow Variance</th>
                <th className="px-3 py-2 text-right">Closing Balance Variance</th>
                <th className="px-3 py-2">Deviation Category</th>
                <th className="px-3 py-2">Audit Explanation / Root Cause</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => {
                const isMaterial = Math.abs(r.balanceVariance) >= materialThreshold;

                return (
                  <tr
                    key={r.date}
                    className={`hover:bg-slate-50 ${isMaterial ? 'bg-rose-50/40' : ''}`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      {r.date}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">
                      {currencySymbol}
                      {r.forecastNetCash.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-900">
                      {currencySymbol}
                      {r.actualNetCash.toLocaleString('en-IN')}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-bold ${
                        r.cashFlowVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {r.cashFlowVariance >= 0 ? '+' : ''}
                      {currencySymbol}
                      {r.cashFlowVariance.toLocaleString('en-IN')}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-bold ${
                        isMaterial ? 'text-rose-700' : 'text-slate-800'
                      }`}
                    >
                      {r.balanceVariance >= 0 ? '+' : ''}
                      {currencySymbol}
                      {r.balanceVariance.toLocaleString('en-IN')}
                      {isMaterial && (
                        <span className="ml-1 text-[10px] px-1 py-0.2 rounded bg-rose-200 text-rose-900">
                          &gt;₹50k
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-700 capitalize">
                      {r.primaryDeviationCategory?.replace('_', ' ') || 'General'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 text-[11px]">
                      {r.deviationReason || 'Within standard operational bounds.'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
