import React, { useState } from 'react';
import {
  DailyCashPosition,
  ScenarioType,
  MonteCarloRunResult,
  ScenarioParameters,
} from '../../types/financial';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Sliders, Shuffle, Download, Calendar, ArrowRight } from 'lucide-react';

interface TrajectoryViewProps {
  dailyExpected: DailyCashPosition[];
  dailyOptimistic: DailyCashPosition[];
  dailyPessimistic: DailyCashPosition[];
  monteCarlo: MonteCarloRunResult;
  currencySymbol: string;
  minimumThreshold: number;
  scenarioParams: Record<ScenarioType, ScenarioParameters>;
  onUpdateScenarioParams: (scenario: ScenarioType, params: ScenarioParameters) => void;
  onExportCsv: () => void;
}

export const TrajectoryView: React.FC<TrajectoryViewProps> = ({
  dailyExpected,
  dailyOptimistic,
  dailyPessimistic,
  monteCarlo,
  currencySymbol,
  minimumThreshold,
  scenarioParams,
  onUpdateScenarioParams,
  onExportCsv,
}) => {
  const [activeTab, setActiveTab] = useState<'montecarlo' | 'ledger'>('montecarlo');
  const [searchTerm, setSearchTerm] = useState('');

  // Stress-test sliders bound to expected scenario
  const expParams = scenarioParams.expected;

  const handleSalesSlider = (val: number) => {
    onUpdateScenarioParams('expected', { ...expParams, salesMultiplier: val });
  };

  const handleArDelaySlider = (val: number) => {
    onUpdateScenarioParams('expected', { ...expParams, arCollectionDelayDays: val });
  };

  const handleExpenseSlider = (val: number) => {
    onUpdateScenarioParams('expected', { ...expParams, expenseMultiplier: val });
  };

  // Monte Carlo corridor chart data
  const mcChartData = monteCarlo.dailyBands.map((band) => ({
    date: band.date.slice(5),
    p10: band.p10,
    p50: band.p50,
    p90: band.p90,
  }));

  const filteredDaily = dailyExpected.filter(
    (d) => d.date.includes(searchTerm) || d.dayOfWeek.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 1. Interactive Stress-Testing Control Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
              <Sliders className="h-4 w-4 mr-1.5 text-indigo-600" />
              Dynamic Liquidity Stress-Tester & Sensitivity Analysis
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate operational shocks in real-time to observe immediate daily cash buffer impacts.
            </p>
          </div>
          <button
            onClick={() =>
              onUpdateScenarioParams('expected', {
                salesMultiplier: 1.0,
                arCollectionDelayDays: 0,
                expenseMultiplier: 1.0,
                apPaymentGraceDays: 0,
              })
            }
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            Reset to Baseline
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Slider 1: Sales Deviation */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700">Sales Demand Multiplier</span>
              <span className="font-bold text-indigo-600">
                {Math.round(expParams.salesMultiplier * 100)}% (
                {expParams.salesMultiplier >= 1.0 ? '+' : ''}
                {Math.round((expParams.salesMultiplier - 1.0) * 100)}%)
              </span>
            </div>
            <input
              type="range"
              min="0.70"
              max="1.30"
              step="0.05"
              value={expParams.salesMultiplier}
              onChange={(e) => handleSalesSlider(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Severe Dip (-30%)</span>
              <span>Baseline (100%)</span>
              <span>Surge (+30%)</span>
            </div>
          </div>

          {/* Slider 2: AR Collection Lag */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700">AR Collection Timing Lag</span>
              <span
                className={`font-bold ${
                  expParams.arCollectionDelayDays > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {expParams.arCollectionDelayDays > 0 ? '+' : ''}
                {expParams.arCollectionDelayDays} Days
              </span>
            </div>
            <input
              type="range"
              min="-5"
              max="15"
              step="1"
              value={expParams.arCollectionDelayDays}
              onChange={(e) => handleArDelaySlider(parseInt(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Fast Track (-5d)</span>
              <span>On-Time (0d)</span>
              <span>Delayed (+15d)</span>
            </div>
          </div>

          {/* Slider 3: OpEx Inflation */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700">Operating Expense Adjustment</span>
              <span className="font-bold text-slate-700">
                {Math.round(expParams.expenseMultiplier * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.90"
              max="1.25"
              step="0.05"
              value={expParams.expenseMultiplier}
              onChange={(e) => handleExpenseSlider(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Cost Cut (-10%)</span>
              <span>Planned (100%)</span>
              <span>Spike (+25%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Side-by-Side 3-Scenario Comparison Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Optimistic */}
        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Optimistic Scenario
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              +15% Sales / Accelerated AR
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-800 tracking-tight">
            {currencySymbol}
            {dailyOptimistic[dailyOptimistic.length - 1]?.endingCash.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-600 mt-2 space-y-1">
            <div className="flex justify-between">
              <span>Total Inflows:</span>
              <span className="font-semibold text-slate-800">
                {currencySymbol}
                {dailyOptimistic.reduce((s, d) => s + d.totalInflows, 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Lowest Point:</span>
              <span className="font-semibold text-slate-800">
                {currencySymbol}
                {Math.min(...dailyOptimistic.map((d) => d.endingCash)).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Expected */}
        <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              Expected (Baseline)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
              Probability 65%
            </span>
          </div>
          <div className="text-2xl font-bold text-indigo-900 tracking-tight">
            {currencySymbol}
            {dailyExpected[dailyExpected.length - 1]?.endingCash.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-600 mt-2 space-y-1">
            <div className="flex justify-between">
              <span>Total Inflows:</span>
              <span className="font-semibold text-slate-800">
                {currencySymbol}
                {dailyExpected.reduce((s, d) => s + d.totalInflows, 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Lowest Point:</span>
              <span className="font-semibold text-slate-800">
                {currencySymbol}
                {Math.min(...dailyExpected.map((d) => d.endingCash)).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Pessimistic */}
        <div className="bg-white rounded-xl border border-rose-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              Pessimistic Scenario
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
              -15% Sales / +7d AR Lag
            </span>
          </div>
          <div className="text-2xl font-bold text-rose-800 tracking-tight">
            {currencySymbol}
            {dailyPessimistic[dailyPessimistic.length - 1]?.endingCash.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-600 mt-2 space-y-1">
            <div className="flex justify-between">
              <span>Total Inflows:</span>
              <span className="font-semibold text-slate-800">
                {currencySymbol}
                {dailyPessimistic.reduce((s, d) => s + d.totalInflows, 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Lowest Point:</span>
              <span className="font-semibold text-slate-800">
                {currencySymbol}
                {Math.min(...dailyPessimistic.map((d) => d.endingCash)).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sub-Navigation: Monte Carlo stochastic simulation vs Full Daily Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3 mb-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('montecarlo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeTab === 'montecarlo'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Monte Carlo Probability Band (P10-P90)
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Full 30-Day Daily Cash Ledger
            </button>
          </div>

          <button
            onClick={onExportCsv}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
            Download Forecast CSV
          </button>
        </div>

        {activeTab === 'montecarlo' ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500">P90 (Favorable 90th %ile)</span>
                <div className="text-base font-bold text-emerald-700">
                  {currencySymbol}
                  {monteCarlo.p90EndingCash.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500">P50 (Median Expected)</span>
                <div className="text-base font-bold text-indigo-700">
                  {currencySymbol}
                  {monteCarlo.p50EndingCash.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500">P10 (Conservative 10th %ile)</span>
                <div className="text-base font-bold text-rose-700">
                  {currencySymbol}
                  {monteCarlo.p10EndingCash.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <span className="text-slate-500">Shortfall Probability</span>
                <div
                  className={`text-base font-bold ${
                    monteCarlo.shortfallProbabilityPercent > 20
                      ? 'text-rose-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {monteCarlo.shortfallProbabilityPercent}% (1,000 runs)
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={mcChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} interval={2} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px' }} />
                  <Area
                    type="monotone"
                    dataKey="p90"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.15}
                    name="P90 (Best 10%)"
                  />
                  <Area
                    type="monotone"
                    dataKey="p50"
                    stroke="#4f46e5"
                    fill="#4f46e5"
                    fillOpacity={0.25}
                    name="P50 (Median)"
                  />
                  <Area
                    type="monotone"
                    dataKey="p10"
                    stroke="#f43f5e"
                    fill="#f43f5e"
                    fillOpacity={0.3}
                    name="P10 (Worst 10%)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Filter daily records by date or day of week..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-sm px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Day</th>
                    <th className="px-3 py-2 text-right">Opening</th>
                    <th className="px-3 py-2 text-right text-emerald-700">Inflows</th>
                    <th className="px-3 py-2 text-right text-rose-700">Outflows</th>
                    <th className="px-3 py-2 text-right">Net Flow</th>
                    <th className="px-3 py-2 text-right font-bold">Closing</th>
                    <th className="px-3 py-2 text-center">Threshold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDaily.map((row) => (
                    <tr
                      key={row.date}
                      className={`hover:bg-slate-50 ${
                        row.isBelowMinimum ? 'bg-rose-50/50' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900">{row.date}</td>
                      <td className="px-3 py-2 text-slate-500">{row.dayOfWeek}</td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        ₹{row.beginningCash.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-emerald-700">
                        +₹{row.totalInflows.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-rose-700">
                        -₹{row.totalOutflows.toLocaleString('en-IN')}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          row.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {row.netCashFlow >= 0 ? '+' : ''}₹{row.netCashFlow.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900">
                        ₹{row.endingCash.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.isBelowMinimum ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Critical
                          </span>
                        ) : row.isBelowWarning ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Warning
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                            Safe
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
