import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Sliders,
  Calendar,
  Layers,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { VarianceMetrics } from '../../types/financial';
import { MonitoringApiClient } from '../../services/monitoring-api';
import type { ForecastVarianceRow, VarianceSummaryReport } from '../../services/variance-engine';

interface VarianceViewProps {
  varianceMetrics: VarianceMetrics;
  currencySymbol: string;
  materialThreshold: number;
  onThresholdChange?: (threshold: number) => void;
  onRefreshEvaluation?: () => void;
}

export const VarianceView: React.FC<VarianceViewProps> = ({
  varianceMetrics,
  currencySymbol,
  materialThreshold: initialThreshold,
  onThresholdChange,
  onRefreshEvaluation,
}) => {
  const [threshold, setThreshold] = useState<number>(initialThreshold || 25000);
  const [summaryReport, setSummaryReport] = useState<VarianceSummaryReport | null>(null);
  const [historicalRows, setHistoricalRows] = useState<ForecastVarianceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchVarianceData = async () => {
    setLoading(true);
    try {
      const [sumRes, rowsRes] = await Promise.all([
        MonitoringApiClient.getVarianceSummary(),
        MonitoringApiClient.getVariance(),
      ]);

      if (sumRes.success && sumRes.data) {
        setSummaryReport(sumRes.data);
      }
      if (rowsRes.success && rowsRes.data) {
        setHistoricalRows(rowsRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVarianceData();
  }, []);

  const handleRecalibrate = async () => {
    setRecalibrating(true);
    try {
      const res = await MonitoringApiClient.runEvaluation({ triggerSource: 'manual' });
      if (res.success) {
        setSuccessMsg('Recalibration complete. Statistical metrics and variance baselines updated.');
        await fetchVarianceData();
        if (onRefreshEvaluation) onRefreshEvaluation();
      }
    } finally {
      setRecalibrating(false);
    }
  };

  // Build chart dataset
  const chartData = historicalRows.map((r) => ({
    date: r.forecast_date.substring(5), // MM-DD
    forecastCash: r.forecast_ending_cash,
    actualCash: r.actual_ending_cash,
    variance: r.absolute_variance,
    forecastNet: r.forecast_net_cash_flow,
    actualNet: r.actual_net_cash_flow,
  }));

  const mae = summaryReport?.meanAbsoluteError ?? varianceMetrics.mae;
  const rmse = summaryReport?.rootMeanSquareError ?? varianceMetrics.rmse;
  const bias = summaryReport?.bias ?? varianceMetrics.bias;
  const materialDeviationsCount =
    summaryReport?.materialDeviationsCount ??
    historicalRows.filter((r) => r.absolute_variance >= threshold).length;

  return (
    <div className="space-y-6">
      {/* 1. Header & Accuracy Metrics */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
              <GitCompare className="h-4 w-4 mr-1.5 text-indigo-600" />
              Forecast vs. Actual Variance & Calibration Center
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Empirical backtesting comparing projected cash flows against cleared bank transactions to audit predictive error.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRecalibrate}
              disabled={recalibrating}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recalibrating ? 'animate-spin' : ''}`} />
              Recalibrate Model
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-800 flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 font-bold ml-2">×</button>
          </div>
        )}

        {/* Statistical Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Mean Absolute Error (MAE)</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {currencySymbol}
              {Math.round(mae).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Average absolute error per daily observation
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Root Mean Square Error</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">n≥3</span>
            </div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {rmse !== null ? `${currencySymbol}${Math.round(rmse).toLocaleString('en-IN')}` : 'Insufficient Data'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {summaryReport?.sufficientDataForRmse
                ? 'Standard deviation of unexplained variances'
                : 'Requires minimum 3 days of cleared bank history'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Forecast Directional Bias</span>
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
              {Math.round(bias).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {bias > 0 ? 'Model leans slightly optimistic' : 'Model leans slightly conservative'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Material Deviations</span>
              <span className="text-[10px] text-slate-500 font-mono">≥₹{(threshold / 1000).toFixed(0)}k</span>
            </div>
            <div
              className={`text-xl font-bold mt-0.5 ${
                materialDeviationsCount > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {materialDeviationsCount} Day{materialDeviationsCount === 1 ? '' : 's'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {materialDeviationsCount > 0 ? 'Triggered automated alert' : 'Within acceptable tolerance'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Visual Backtesting Chart: Actual Ending Cash vs Forecast Ending Cash */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
          <div>
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Empirical Trajectory Alignment (Actual vs Forecast)
            </div>
            <p className="text-[11px] text-slate-500">
              Solid line indicates cleared bank balance; dashed line represents original deterministic forecast projection.
            </p>
          </div>
          {/* Threshold Adjuster */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-500">Deviation Threshold:</span>
            <select
              value={threshold}
              onChange={(e) => {
                const val = Number(e.target.value);
                setThreshold(val);
                if (onThresholdChange) onThresholdChange(val);
              }}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white font-semibold text-slate-700"
            >
              <option value="10000">₹10,000</option>
              <option value="25000">₹25,000 (Standard)</option>
              <option value="50000">₹50,000</option>
              <option value="100000">₹100,000</option>
            </select>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: any) => [`${currencySymbol}${Number(value).toLocaleString('en-IN')}`]}
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line
                type="monotone"
                dataKey="actualCash"
                name="Actual Cleared Cash"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#10b981' }}
              />
              <Line
                type="monotone"
                dataKey="forecastCash"
                name="Projected Forecast Cash"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#6366f1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Daily Historical Reconciliation Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 mb-4 flex items-center justify-between">
          <span>Daily Variance Breakdown & Cleared Ledger Log</span>
          <span className="text-[11px] text-slate-500 font-normal">
            Total Days Tracked: {historicalRows.length}
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Forecast Ending</th>
                <th className="px-3 py-2 text-right">Actual Cleared</th>
                <th className="px-3 py-2 text-right">Absolute Variance</th>
                <th className="px-3 py-2 text-right">Signed Variance</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2">Variance Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historicalRows.map((r) => {
                const isMaterial = r.absolute_variance >= threshold;

                return (
                  <tr
                    key={r.id || r.forecast_date}
                    className={`hover:bg-slate-50 ${isMaterial ? 'bg-rose-50/40' : ''}`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{r.forecast_date}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600 font-mono">
                      {currencySymbol}
                      {r.forecast_ending_cash.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-900 font-mono">
                      {currencySymbol}
                      {r.actual_ending_cash.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-800 font-mono">
                      {currencySymbol}
                      {r.absolute_variance.toLocaleString('en-IN')}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-bold font-mono ${
                        r.signed_variance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {r.signed_variance >= 0 ? '+' : ''}
                      {currencySymbol}
                      {r.signed_variance.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isMaterial ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Material Deviation
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                          Normal Tolerance
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 text-[11px] max-w-xs truncate">
                      {r.notes || 'Forecast within planned bounds.'}
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
