import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { DailyCashPosition, ScenarioType } from '../../types/financial';
import { Eye, Layers, GitCompare } from 'lucide-react';

interface CashTrajectoryChartProps {
  expectedData: DailyCashPosition[];
  optimisticData: DailyCashPosition[];
  pessimisticData: DailyCashPosition[];
  minimumThreshold: number;
  warningThreshold: number;
  activeScenario: ScenarioType;
  currencySymbol: string;
  onSwitchToScenarioOverlay?: () => void;
}

export const CashTrajectoryChart: React.FC<CashTrajectoryChartProps> = ({
  expectedData,
  optimisticData,
  pessimisticData,
  minimumThreshold,
  warningThreshold,
  activeScenario,
  currencySymbol,
  onSwitchToScenarioOverlay,
}) => {
  const [showAllScenarios, setShowAllScenarios] = useState(true);
  const [showFlowBars, setShowFlowBars] = useState(false);

  // Merge the daily data for chart plotting
  const chartData = expectedData.map((d, i) => {
    const opt = optimisticData[i];
    const pes = pessimisticData[i];

    return {
      date: d.date,
      displayDate: d.date.slice(5), // MM-DD
      dayOfWeek: d.dayOfWeek,
      expectedCash: d.endingCash,
      optimisticCash: opt?.endingCash ?? d.endingCash,
      pessimisticCash: pes?.endingCash ?? d.endingCash,
      inflows: d.totalInflows,
      outflows: d.totalOutflows,
      netCash: d.netCashFlow,
      cashSales: d.cashSales,
      collections: d.creditSalesCollected,
      supplierPayments: d.supplierPayments,
      operatingExpenses: d.operatingExpenses,
      taxes: d.taxPayments,
      loans: d.loanRepayments,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[240px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <span className="font-semibold text-slate-200">
            {data.date} ({data.dayOfWeek})
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              data.netCash >= 0
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'bg-rose-950 text-rose-400 border border-rose-800'
            }`}
          >
            Net: {data.netCash >= 0 ? '+' : ''}
            {currencySymbol}
            {data.netCash.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="space-y-1.5 mb-2.5">
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center">
              <span className="w-2 h-2 rounded-full bg-indigo-400 mr-1.5"></span>
              Expected Ending Cash:
            </span>
            <span className="font-bold text-white">
              {currencySymbol}
              {data.expectedCash.toLocaleString('en-IN')}
            </span>
          </div>

          {showAllScenarios && (
            <>
              <div className="flex justify-between items-center text-emerald-400">
                <span className="flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5"></span>
                  Optimistic:
                </span>
                <span className="font-semibold">
                  {currencySymbol}
                  {data.optimisticCash.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center text-rose-400">
                <span className="flex items-center">
                  <span className="w-2 h-2 rounded-full bg-rose-400 mr-1.5"></span>
                  Pessimistic:
                </span>
                <span className="font-semibold">
                  {currencySymbol}
                  {data.pessimisticCash.toLocaleString('en-IN')}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Inflow vs Outflow Mini Breakdown */}
        <div className="pt-2 border-t border-slate-800 space-y-1 text-[11px] text-slate-400">
          <div className="flex justify-between">
            <span className="text-emerald-400 font-medium">Inflows:</span>
            <span>
              +{currencySymbol}
              {data.inflows.toLocaleString('en-IN')} (Sales: {currencySymbol}
              {data.cashSales.toLocaleString('en-IN')}, AR: {currencySymbol}
              {data.collections.toLocaleString('en-IN')})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-rose-400 font-medium">Outflows:</span>
            <span>
              -{currencySymbol}
              {data.outflows.toLocaleString('en-IN')}
              {data.supplierPayments > 0 && ` [Suppliers: ₹${data.supplierPayments.toLocaleString('en-IN')}]`}
              {data.operatingExpenses > 0 && ` [OpEx: ₹${data.operatingExpenses.toLocaleString('en-IN')}]`}
              {data.taxes > 0 && ` [Tax: ₹${data.taxes.toLocaleString('en-IN')}]`}
              {data.loans > 0 && ` [EMI: ₹${data.loans.toLocaleString('en-IN')}]`}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            30-Day Cash Trajectory & Multi-Scenario Projection
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic daily cash scheduling based on actual customer invoices, supplier bills, payroll, and debt service.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onSwitchToScenarioOverlay && (
            <button
              onClick={onSwitchToScenarioOverlay}
              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
              title="Open dedicated Scenario Comparison Overlay view"
            >
              <GitCompare className="h-3 w-3 mr-1.5" />
              Scenario Overlay View
            </button>
          )}

          <button
            onClick={() => setShowAllScenarios(!showAllScenarios)}
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              showAllScenarios
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Layers className="h-3 w-3 mr-1.5" />
            {showAllScenarios ? 'Hide Scenarios' : 'Compare 3 Scenarios'}
          </button>

          <button
            onClick={() => setShowFlowBars(!showFlowBars)}
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
              showFlowBars
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Eye className="h-3 w-3 mr-1.5" />
            {showFlowBars ? 'Hide Flow Bounds' : 'Show Flow Bounds'}
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="expectedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
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
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Threshold References */}
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

            {/* Inflow/Outflow bars if toggled */}
            {showFlowBars && (
              <Area
                type="monotone"
                dataKey="inflows"
                fill="#10b981"
                fillOpacity={0.12}
                stroke="#10b981"
                strokeWidth={1}
                name="Daily Inflows"
              />
            )}

            {/* Expected Scenario Area & Line */}
            <Area
              type="monotone"
              dataKey="expectedCash"
              stroke="#4f46e5"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#expectedGradient)"
              name="Expected Scenario"
            />

            {/* Optimistic Scenario Line */}
            {showAllScenarios && (
              <Line
                type="monotone"
                dataKey="optimisticCash"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name="Optimistic"
              />
            )}

            {/* Pessimistic Scenario Line */}
            {showAllScenarios && (
              <Line
                type="monotone"
                dataKey="pessimisticCash"
                stroke="#f43f5e"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name="Pessimistic"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Legend / Summary Footer */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-2 gap-2">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <span className="w-3 h-1 bg-indigo-600 rounded-full mr-1.5"></span>
            <span className="font-medium text-slate-700">Expected (Baseline)</span>
          </div>
          {showAllScenarios && (
            <>
              <div className="flex items-center">
                <span className="w-3 h-1 bg-emerald-500 rounded-full mr-1.5 border-dashed"></span>
                <span className="font-medium text-slate-700">Optimistic (+15% Sales, Fast AR)</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-1 bg-rose-500 rounded-full mr-1.5 border-dashed"></span>
                <span className="font-medium text-slate-700">Pessimistic (-15% Sales, +7d Delay)</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center space-x-3 text-[11px]">
          <span className="flex items-center text-rose-600 font-semibold">
            <span className="w-2 h-0.5 bg-rose-600 mr-1"></span>
            Critical Threshold (₹100,000)
          </span>
          <span className="flex items-center text-amber-600">
            <span className="w-2 h-0.5 bg-amber-600 mr-1"></span>
            Warning Threshold (₹150,000)
          </span>
        </div>
      </div>
    </div>
  );
};
