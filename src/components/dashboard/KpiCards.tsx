import React from 'react';
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  Clock,
  Shuffle,
  RefreshCw,
} from 'lucide-react';
import { CashRunwaySummary, CashConversionCycleMetrics } from '../../types/financial';

interface KpiCardsProps {
  initialCash: number;
  runway: CashRunwaySummary;
  ccc: CashConversionCycleMetrics;
  shortfallProbability: number;
  currencySymbol: string;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  initialCash,
  runway,
  ccc,
  shortfallProbability,
  currencySymbol,
}) => {
  const netChange = runway.forecastEndingCash - initialCash;
  const netPercent = ((netChange / initialCash) * 100).toFixed(1);

  const formatCurrency = (val: number) =>
    `${currencySymbol}${Math.round(val).toLocaleString('en-IN')}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 mb-6">
      {/* 1. Beginning Cash */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-medium">Opening Cash</span>
          <Wallet className="h-4 w-4 text-slate-400" />
        </div>
        <div className="text-xl font-bold text-slate-900 tracking-tight">
          {formatCurrency(initialCash)}
        </div>
        <div className="text-[11px] text-slate-500 mt-1 flex items-center">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
          Reconciled across 2 accounts
        </div>
      </div>

      {/* 2. Projected Ending Cash */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-medium">30-Day Ending Cash</span>
          <TrendingUp
            className={`h-4 w-4 ${netChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}
          />
        </div>
        <div
          className={`text-xl font-bold tracking-tight ${
            netChange >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {formatCurrency(runway.forecastEndingCash)}
        </div>
        <div className="text-[11px] font-medium mt-1 flex items-center">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] ${
              netChange >= 0
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {netChange >= 0 ? `+${netPercent}%` : `${netPercent}%`}
          </span>
          <span className="ml-1.5 text-slate-500">
            {netChange >= 0 ? `+${formatCurrency(netChange)}` : formatCurrency(netChange)}
          </span>
        </div>
      </div>

      {/* 3. Minimum Projected Cash */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-medium">Lowest Cash Point</span>
          <AlertTriangle
            className={`h-4 w-4 ${
              runway.isThresholdBreached ? 'text-rose-500' : 'text-amber-500'
            }`}
          />
        </div>
        <div
          className={`text-xl font-bold tracking-tight ${
            runway.isThresholdBreached ? 'text-rose-600' : 'text-slate-900'
          }`}
        >
          {formatCurrency(runway.minimumProjectedCash)}
        </div>
        <div className="text-[11px] text-slate-500 mt-1 flex items-center">
          <span>Date: {runway.minimumProjectedDate || 'N/A'}</span>
          <span
            className={`ml-auto text-[10px] px-1.5 py-0.2 rounded font-semibold ${
              runway.isThresholdBreached
                ? 'bg-rose-100 text-rose-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {runway.isThresholdBreached ? 'Breached' : 'Above Safety'}
          </span>
        </div>
      </div>

      {/* 4. Cash Runway */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-medium">Estimated Runway</span>
          <Clock className="h-4 w-4 text-slate-400" />
        </div>
        <div className="text-xl font-bold text-slate-900 tracking-tight">
          {typeof runway.runwayDaysEstimated === 'number'
            ? `${runway.runwayDaysEstimated} Days`
            : runway.runwayDaysEstimated}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          Burn: ~{formatCurrency(runway.averageDailyNetBurn)}/day on deficit days
        </div>
      </div>

      {/* 5. Shortfall Risk (Monte Carlo) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-medium">Shortfall Risk (P&lt;₹100k)</span>
          <Shuffle className="h-4 w-4 text-indigo-400" />
        </div>
        <div
          className={`text-xl font-bold tracking-tight ${
            shortfallProbability > 25
              ? 'text-rose-600'
              : shortfallProbability > 10
              ? 'text-amber-600'
              : 'text-emerald-600'
          }`}
        >
          {shortfallProbability}%
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          1,000 stochastic simulation iterations
        </div>
      </div>

      {/* 6. Cash Conversion Cycle */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between text-slate-500 mb-1.5">
          <span className="text-xs font-medium">Cash Conv. Cycle</span>
          <RefreshCw className="h-4 w-4 text-slate-400" />
        </div>
        <div className="text-xl font-bold text-slate-900 tracking-tight">
          {ccc.ccc} Days
        </div>
        <div className="text-[10px] text-slate-500 mt-1 space-x-1">
          <span>DIO:{ccc.dio}d</span>
          <span>•</span>
          <span>DSO:{ccc.dso}d</span>
          <span>•</span>
          <span>DPO:{ccc.dpo}d</span>
        </div>
      </div>
    </div>
  );
};
