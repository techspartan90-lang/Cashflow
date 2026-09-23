import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { WeeklyCashSummary } from '../../types/financial';
import { Calendar, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface WeeklyFlowSummaryProps {
  weeklyData: WeeklyCashSummary[];
  currencySymbol: string;
}

export const WeeklyFlowSummary: React.FC<WeeklyFlowSummaryProps> = ({
  weeklyData,
  currencySymbol,
}) => {
  const chartData = weeklyData.map((w) => ({
    name: `Wk ${w.weekIndex}`,
    fullLabel: w.weekLabel,
    inflows: w.totalInflows,
    outflows: w.totalOutflows,
    net: w.netCashFlow,
    endingCash: w.endingCash,
    lowestPoint: w.lowestCashPoint,
    lowestDate: w.lowestCashDate,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-700 text-xs">
        <div className="font-semibold text-slate-200 border-b border-slate-800 pb-1.5 mb-2">
          {data.fullLabel}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-emerald-400">
            <span>Weekly Inflows:</span>
            <span className="font-bold">
              +{currencySymbol}
              {data.inflows.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between text-rose-400">
            <span>Weekly Outflows:</span>
            <span className="font-bold">
              -{currencySymbol}
              {data.outflows.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between text-slate-300 font-semibold pt-1 border-t border-slate-800">
            <span>Net Weekly Flow:</span>
            <span className={data.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {data.net >= 0 ? '+' : ''}
              {currencySymbol}
              {data.net.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between text-slate-400 pt-1 text-[11px]">
            <span>Lowest Day Cash:</span>
            <span className="font-medium text-amber-300">
              {currencySymbol}
              {data.lowestPoint.toLocaleString('en-IN')} ({data.lowestDate})
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Weekly Cash-Flow Intervals (Inflows vs Outflows)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated liquidity comparison across 7-day operating horizons.
          </p>
        </div>
        <div className="flex items-center text-xs text-slate-500 font-medium">
          <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
          5 Interval Cycles
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Bar Chart */}
        <div className="lg:col-span-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
              />
              <Bar dataKey="inflows" name="Total Inflows" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outflows" name="Total Outflows" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Summary Cards */}
        <div className="space-y-2">
          {weeklyData.map((week) => (
            <div
              key={week.weekIndex}
              className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors text-xs"
            >
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span>Week {week.weekIndex}</span>
                <span
                  className={`flex items-center font-bold ${
                    week.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {week.netCashFlow >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                  )}
                  {week.netCashFlow >= 0 ? '+' : ''}
                  {currencySymbol}
                  {week.netCashFlow.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                <span>
                  In: +₹{(week.totalInflows / 1000).toFixed(0)}k | Out: -₹
                  {(week.totalOutflows / 1000).toFixed(0)}k
                </span>
                <span className="text-slate-600 font-medium">
                  Lowest: ₹{week.lowestCashPoint.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
