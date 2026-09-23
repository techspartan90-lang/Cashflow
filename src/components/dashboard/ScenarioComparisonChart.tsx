import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { DailyCashPosition, ScenarioType } from '../../types/financial';
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldAlert,
  Percent,
} from 'lucide-react';

interface ScenarioComparisonChartProps {
  expectedData: DailyCashPosition[];
  optimisticData: DailyCashPosition[];
  pessimisticData: DailyCashPosition[];
  minimumThreshold: number;
  warningThreshold: number;
  currencySymbol: string;
  activeScenario?: ScenarioType;
  onSelectScenario?: (scenario: ScenarioType) => void;
  onSwitchToOperationalView?: () => void;
}

export const ScenarioComparisonChart: React.FC<ScenarioComparisonChartProps> = ({
  expectedData,
  optimisticData,
  pessimisticData,
  minimumThreshold,
  warningThreshold,
  currencySymbol,
  activeScenario = 'expected',
  onSelectScenario,
  onSwitchToOperationalView,
}) => {
  // View mode: 'absolute' (₹ balance) or 'variance' (delta from expected)
  const [viewMode, setViewMode] = useState<'absolute' | 'variance'>('absolute');
  const [showSpreadTunnel, setShowSpreadTunnel] = useState<boolean>(true);
  const [highlightBreaches, setHighlightBreaches] = useState<boolean>(true);

  // 1. Process 30-day comparative dataset
  const chartData = useMemo(() => {
    return expectedData.map((exp, i) => {
      const opt = optimisticData[i] || exp;
      const pes = pessimisticData[i] || exp;

      const optDelta = opt.endingCash - exp.endingCash;
      const pesDelta = pes.endingCash - exp.endingCash;
      const spread = opt.endingCash - pes.endingCash;

      return {
        date: exp.date,
        displayDate: exp.date.slice(5), // 'MM-DD'
        dayOfWeek: exp.dayOfWeek,
        // Absolute values
        expectedCash: exp.endingCash,
        optimisticCash: opt.endingCash,
        pessimisticCash: pes.endingCash,
        // Variance values (relative to expected baseline)
        expectedDelta: 0,
        optimisticDelta: optDelta,
        pessimisticDelta: pesDelta,
        // Spread corridor
        spread,
        corridorFloor: pes.endingCash,
        corridorCeiling: opt.endingCash,
        // Threshold breach markers
        pesBreached: pes.endingCash < minimumThreshold,
        expBreached: exp.endingCash < minimumThreshold,
        optBreached: opt.endingCash < minimumThreshold,
      };
    });
  }, [expectedData, optimisticData, pessimisticData, minimumThreshold]);

  // 2. High-level comparative summary statistics
  const summaryStats = useMemo(() => {
    if (!expectedData.length) return null;

    const lastIdx = expectedData.length - 1;
    const expEnd = expectedData[lastIdx]?.endingCash ?? 0;
    const optEnd = optimisticData[lastIdx]?.endingCash ?? 0;
    const pesEnd = pessimisticData[lastIdx]?.endingCash ?? 0;

    // Minimum trough points
    let expMin = { cash: Infinity, date: '' };
    let optMin = { cash: Infinity, date: '' };
    let pesMin = { cash: Infinity, date: '' };

    expectedData.forEach((d) => {
      if (d.endingCash < expMin.cash) expMin = { cash: d.endingCash, date: d.date };
    });
    optimisticData.forEach((d) => {
      if (d.endingCash < optMin.cash) optMin = { cash: d.endingCash, date: d.date };
    });
    pessimisticData.forEach((d) => {
      if (d.endingCash < pesMin.cash) pesMin = { cash: d.endingCash, date: d.date };
    });

    const optDeltaEnd = optEnd - expEnd;
    const pesDeltaEnd = pesEnd - expEnd;
    const optDeltaPercent = ((optDeltaEnd / (expEnd || 1)) * 100).toFixed(1);
    const pesDeltaPercent = ((pesDeltaEnd / (expEnd || 1)) * 100).toFixed(1);
    const maxSpread = optEnd - pesEnd;

    // Count days under minimum threshold in pessimistic
    const pesDaysUnderSafety = pessimisticData.filter((d) => d.endingCash < minimumThreshold).length;

    return {
      expEnd,
      optEnd,
      pesEnd,
      optDeltaEnd,
      pesDeltaEnd,
      optDeltaPercent,
      pesDeltaPercent,
      expMin,
      optMin,
      pesMin,
      maxSpread,
      pesDaysUnderSafety,
    };
  }, [expectedData, optimisticData, pessimisticData, minimumThreshold]);

  // 3. Custom Comparative Tooltip
  const ComparativeTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0].payload;

    return (
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 text-xs min-w-[280px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
          <div>
            <div className="font-bold text-slate-100">{row.date}</div>
            <div className="text-[11px] text-slate-400 capitalize">{row.dayOfWeek}</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block">
              Scenario Spread
            </span>
            <span className="font-mono text-indigo-300 font-bold">
              {currencySymbol}
              {row.spread.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* 3 Scenarios Side-by-Side */}
        <div className="space-y-2">
          {/* Optimistic */}
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="font-medium text-emerald-200">Optimistic</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-white font-mono">
                {currencySymbol}
                {row.optimisticCash.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-emerald-400 block font-mono">
                +{currencySymbol}
                {row.optimisticDelta.toLocaleString('en-IN')} (+
                {((row.optimisticDelta / (row.expectedCash || 1)) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Expected Baseline */}
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
              <span className="font-medium text-indigo-200">Expected (Base)</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-white font-mono">
                {currencySymbol}
                {row.expectedCash.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block">Baseline anchor</span>
            </div>
          </div>

          {/* Pessimistic */}
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-rose-950/40 border border-rose-800/40">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
              <span className="font-medium text-rose-200">Pessimistic</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-white font-mono">
                {currencySymbol}
                {row.pessimisticCash.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-rose-400 block font-mono">
                {row.pessimisticDelta < 0 ? '-' : '+'}
                {currencySymbol}
                {Math.abs(row.pessimisticDelta).toLocaleString('en-IN')} (
                {((row.pessimisticDelta / (row.expectedCash || 1)) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Safety buffer comparison */}
        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Safety Buffer ({currencySymbol}{minimumThreshold.toLocaleString('en-IN')}):</span>
          {row.pesBreached ? (
            <span className="text-rose-400 font-semibold flex items-center">
              <ShieldAlert className="w-3 h-3 mr-1" />
              Pessimistic Breach!
            </span>
          ) : (
            <span className="text-emerald-400 font-semibold">Protected across all 3</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-6">
      {/* 1. Header with Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1 rounded-md bg-indigo-50 text-indigo-700">
              <GitCompare className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Scenario Impact Overlay: Expected vs. Optimistic vs. Pessimistic
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
              Direct Comparison View
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simultaneous multi-scenario trajectory comparison highlighting liquidity spread, downside tail risk, and safety buffer tolerances.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {onSwitchToOperationalView && (
            <button
              onClick={onSwitchToOperationalView}
              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
              title="Switch back to Operational Flow Trajectory view"
            >
              Operational Flow View
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              onClick={() => setViewMode('absolute')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                viewMode === 'absolute'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Absolute Cash (₹)
            </button>
            <button
              onClick={() => setViewMode('variance')}
              className={`px-2.5 py-1 font-medium rounded-md transition-colors cursor-pointer ${
                viewMode === 'variance'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Variance vs. Base (Δ)
            </button>
          </div>

          {/* Uncertainty Band Shading Toggle */}
          {viewMode === 'absolute' && (
            <button
              onClick={() => setShowSpreadTunnel(!showSpreadTunnel)}
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                showSpreadTunnel
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Layers className="h-3 w-3 mr-1.5" />
              {showSpreadTunnel ? 'Spread Tunnel On' : 'Spread Tunnel Off'}
            </button>
          )}

          {/* Breaches Indicator Toggle */}
          <button
            onClick={() => setHighlightBreaches(!highlightBreaches)}
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              highlightBreaches
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ShieldAlert className="h-3 w-3 mr-1.5" />
            Safety Threshold
          </button>
        </div>
      </div>

      {/* 2. Scenario Metric Comparison Cards Strip */}
      {summaryStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
          {/* Expected Card */}
          <div
            onClick={() => onSelectScenario && onSelectScenario('expected')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              activeScenario === 'expected'
                ? 'bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-200'
                : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center text-xs font-semibold text-indigo-900">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 mr-1.5"></span>
                Expected (Base Case)
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Standard</span>
            </div>
            <div className="text-base font-bold text-slate-900 font-mono">
              {currencySymbol}
              {summaryStats.expEnd.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Lowest: {currencySymbol}{summaryStats.expMin.cash.toLocaleString('en-IN')}</span>
              <span className="text-slate-400 font-mono">{summaryStats.expMin.date.slice(5)}</span>
            </div>
          </div>

          {/* Optimistic Card */}
          <div
            onClick={() => onSelectScenario && onSelectScenario('optimistic')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              activeScenario === 'optimistic'
                ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-200'
                : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center text-xs font-semibold text-emerald-900">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5"></span>
                Optimistic (+15% Sales)
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                +{summaryStats.optDeltaPercent}%
              </span>
            </div>
            <div className="text-base font-bold text-emerald-700 font-mono">
              {currencySymbol}
              {summaryStats.optEnd.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>+₹{summaryStats.optDeltaEnd.toLocaleString('en-IN')} upside</span>
              <span>Min: ₹{summaryStats.optMin.cash.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Pessimistic Card */}
          <div
            onClick={() => onSelectScenario && onSelectScenario('pessimistic')}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              activeScenario === 'pessimistic'
                ? 'bg-rose-50/60 border-rose-300 ring-2 ring-rose-200'
                : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center text-xs font-semibold text-rose-900">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5"></span>
                Pessimistic (-15% Sales)
              </span>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1 rounded">
                {summaryStats.pesDeltaPercent}%
              </span>
            </div>
            <div className="text-base font-bold text-rose-700 font-mono">
              {currencySymbol}
              {summaryStats.pesEnd.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span className="text-rose-600 font-medium">
                {summaryStats.pesDaysUnderSafety > 0
                  ? `Breach: ${summaryStats.pesDaysUnderSafety}d < Safety`
                  : 'Buffer Maintained'}
              </span>
              <span>Trough: ₹{summaryStats.pesMin.cash.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Uncertainty Spread Card */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700">30-Day Spread Band</span>
              <span className="text-[10px] font-medium text-slate-500">Max Volatility</span>
            </div>
            <div className="text-base font-bold text-slate-900 font-mono">
              {currencySymbol}
              {summaryStats.maxSpread.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Optimistic to Pessimistic Gap</span>
              <span className="text-indigo-600 font-semibold">
                {((summaryStats.maxSpread / (summaryStats.expEnd || 1)) * 100).toFixed(0)}% of Base
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Recharts Visual Canvas */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="scenarioSpreadGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.16} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="displayDate"
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fontSize: 11, fill: '#64748b' }}
              interval={2}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(v) => {
                if (viewMode === 'variance') {
                  const prefix = v > 0 ? '+' : '';
                  return `${prefix}₹${(v / 1000).toFixed(0)}k`;
                }
                return `₹${(v / 1000).toFixed(0)}k`;
              }}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<ComparativeTooltip />} />

            {/* Threshold References (Only meaningful in absolute cash mode) */}
            {viewMode === 'absolute' && highlightBreaches && (
              <>
                <ReferenceLine
                  y={minimumThreshold}
                  stroke="#e11d48"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Min Safety: ₹${(minimumThreshold / 1000).toFixed(0)}k`,
                    position: 'right',
                    fill: '#e11d48',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
                <ReferenceLine
                  y={warningThreshold}
                  stroke="#d97706"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: `Warning: ₹${(warningThreshold / 1000).toFixed(0)}k`,
                    position: 'right',
                    fill: '#d97706',
                    fontSize: 10,
                  }}
                />
              </>
            )}

            {/* Zero Baseline for Variance Mode */}
            {viewMode === 'variance' && (
              <ReferenceLine
                y={0}
                stroke="#64748b"
                strokeWidth={1.5}
                label={{
                  value: 'Baseline (Expected = 0)',
                  position: 'right',
                  fill: '#64748b',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}

            {/* Spread Tunnel (Envelope) in Absolute Mode */}
            {viewMode === 'absolute' && showSpreadTunnel && (
              <Area
                type="monotone"
                dataKey="optimisticCash"
                stroke="transparent"
                fill="url(#scenarioSpreadGradient)"
                fillOpacity={1}
                name="Scenario Spread Envelope"
              />
            )}

            {/* 1. Expected Baseline Line */}
            <Line
              type="monotone"
              dataKey={viewMode === 'absolute' ? 'expectedCash' : 'expectedDelta'}
              stroke="#4f46e5"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
              name="Expected (Base)"
            />

            {/* 2. Optimistic Line */}
            <Line
              type="monotone"
              dataKey={viewMode === 'absolute' ? 'optimisticCash' : 'optimisticDelta'}
              stroke="#059669"
              strokeWidth={2.5}
              strokeDasharray={viewMode === 'absolute' ? '5 5' : undefined}
              dot={false}
              activeDot={{ r: 5, fill: '#059669', stroke: '#fff', strokeWidth: 2 }}
              name="Optimistic (+15%)"
            />

            {/* 3. Pessimistic Line */}
            <Line
              type="monotone"
              dataKey={viewMode === 'absolute' ? 'pessimisticCash' : 'pessimisticDelta'}
              stroke="#e11d48"
              strokeWidth={2.5}
              strokeDasharray={viewMode === 'absolute' ? '5 5' : undefined}
              dot={false}
              activeDot={{ r: 5, fill: '#e11d48', stroke: '#fff', strokeWidth: 2 }}
              name="Pessimistic (-15%)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 4. Chart Footer Legend & Fast Switching Insight */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-2 gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center">
            <span className="w-3 h-1 bg-indigo-600 rounded-full mr-1.5"></span>
            <span className="font-semibold text-slate-800">Expected (Baseline)</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-1 bg-emerald-600 rounded-full mr-1.5 border-dashed"></span>
            <span className="font-semibold text-emerald-800">Optimistic (Sales +15%, AR -3d)</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-1 bg-rose-600 rounded-full mr-1.5 border-dashed"></span>
            <span className="font-semibold text-rose-800">Pessimistic (Sales -15%, AR +7d)</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-[11px]">
          <span className="text-slate-500">
            Click scenario card above to switch global forecast scenario context
          </span>
        </div>
      </div>
    </div>
  );
};
