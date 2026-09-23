import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Sliders,
  Download,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Info,
  Layers,
  History,
  AlertTriangle,
} from 'lucide-react';
import {
  ForecastEngine,
  ForecastEngineOutput,
  ForecastScenario,
  DailyForecastDay,
  ForecastItem,
  CertaintyLevel,
} from '../../services/forecast-engine';
import { ForecastApiClient, ForecastRunRow } from '../../services/forecast-api';

interface TrajectoryViewProps {
  currencySymbol?: string;
  minimumThreshold?: number;
  onExportCsv?: () => void;
}

export const TrajectoryView: React.FC<TrajectoryViewProps> = ({
  currencySymbol = '₹',
  minimumThreshold = 100000,
  onExportCsv,
}) => {
  // State
  const [activeScenario, setActiveScenario] = useState<ForecastScenario>('expected');
  const [forecastData, setForecastData] = useState<ForecastEngineOutput | null>(null);
  const [historyRuns, setHistoryRuns] = useState<ForecastRunRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showExplanationPanel, setShowExplanationPanel] = useState<boolean>(true);

  // Load forecast for active scenario
  const loadForecast = async (scenario: ForecastScenario) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ForecastApiClient.getForecastDetails({ scenario });
      if (res.success && res.data) {
        setForecastData(res.data);
      } else {
        // Fallback to local deterministic execution if backend unavailable
        const local = ForecastEngine.runForecast({
          organizationId: '11111111-1111-1111-1111-111111111111',
          startDate: '2026-09-23',
          horizonDays: 30,
          scenario,
          minimumCashThreshold: minimumThreshold,
        });
        setForecastData(local);
      }

      // Also fetch history
      const historyRes = await ForecastApiClient.getForecastHistory();
      if (historyRes.success && historyRes.data) {
        setHistoryRuns(historyRes.data);
      }
    } catch (err: any) {
      console.warn('Failed to fetch from backend, running local deterministic engine:', err);
      const local = ForecastEngine.runForecast({
        organizationId: '11111111-1111-1111-1111-111111111111',
        startDate: '2026-09-23',
        horizonDays: 30,
        scenario,
        minimumCashThreshold: minimumThreshold,
      });
      setForecastData(local);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadForecast(activeScenario);
  }, [activeScenario]);

  // Handle generating new immutable authoritative version
  const handleGenerateAuthoritativeVersion = async () => {
    setIsGenerating(true);
    try {
      const res = await ForecastApiClient.generateForecast({
        startDate: '2026-09-23',
        horizonDays: 30,
        scenario: activeScenario,
        minimumCashThreshold: minimumThreshold,
      });
      if (res.success && res.data) {
        setForecastData(res.data);
        const historyRes = await ForecastApiClient.getForecastHistory();
        if (historyRes.success && historyRes.data) {
          setHistoryRuns(historyRes.data);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate version');
    } finally {
      setIsGenerating(false);
    }
  };

  // Chart data formatting
  const chartData = useMemo(() => {
    if (!forecastData) return [];
    return forecastData.dailyForecast.map((d) => ({
      date: d.date.slice(5),
      fullDate: d.date,
      dayOfWeek: d.dayOfWeek,
      beginningCash: d.beginningCash,
      inflows: d.expectedInflows,
      outflows: d.expectedOutflows,
      netCashFlow: d.netCashFlow,
      endingCash: d.endingCash,
      minimumThreshold: forecastData.minimumCashThreshold,
      isShortfall: d.thresholdStatus === 'below_threshold',
    }));
  }, [forecastData]);

  // Table filtering
  const filteredDaily = useMemo(() => {
    if (!forecastData) return [];
    if (!searchTerm.trim()) return forecastData.dailyForecast;
    const term = searchTerm.toLowerCase();
    return forecastData.dailyForecast.filter(
      (d) =>
        d.date.includes(term) ||
        d.dayOfWeek.toLowerCase().includes(term) ||
        d.thresholdStatus.toLowerCase().includes(term) ||
        d.riskFactors.some((r) => r.toLowerCase().includes(term))
    );
  }, [forecastData, searchTerm]);

  // CSV Export
  const handleExportCsv = () => {
    if (!forecastData) return;
    const headers = [
      'Date',
      'Day',
      'Beginning Cash',
      'Expected Inflows',
      'Expected Outflows',
      'Net Cash Flow',
      'Ending Cash',
      'Threshold Status',
      'Shortfall Deficit',
      'Risk Factors',
    ];

    const rows = forecastData.dailyForecast.map((d) => [
      d.date,
      d.dayOfWeek,
      d.beginningCash.toFixed(2),
      d.expectedInflows.toFixed(2),
      d.expectedOutflows.toFixed(2),
      d.netCashFlow.toFixed(2),
      d.endingCash.toFixed(2),
      d.thresholdStatus,
      d.shortfallDeficit.toFixed(2),
      `"${d.riskFactors.join('; ')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `cashflow_forecast_30day_${activeScenario}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCertaintyBadge = (certainty: CertaintyLevel) => {
    switch (certainty) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
            CONFIRMED
          </span>
        );
      case 'EXPECTED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
            <Clock className="w-2.5 h-2.5 mr-1" />
            EXPECTED
          </span>
        );
      case 'ASSUMED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
            <Info className="w-2.5 h-2.5 mr-1" />
            ASSUMED
          </span>
        );
    }
  };

  const getThresholdBadge = (status: DailyForecastDay['thresholdStatus']) => {
    switch (status) {
      case 'above_threshold':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Above Safe Buffer
          </span>
        );
      case 'approaching_threshold':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Approaching Buffer
          </span>
        );
      case 'below_threshold':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            Shortfall Breach
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Deterministic 30-Day Cash-Flow Forecasting Engine
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                Phase 4 Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Timezone: <span className="font-semibold text-slate-700">{forecastData?.timezone || 'UTC'}</span> | 
              Window: <span className="font-semibold text-slate-700">{forecastData?.startDate || '2026-09-23'}</span> to{' '}
              <span className="font-semibold text-slate-700">{forecastData?.endDate || '2026-10-22'}</span> | 
              Version: <span className="font-semibold text-indigo-700">v{forecastData?.forecastVersion || 1}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Scenario Selector */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs shadow-2xs">
              <button
                onClick={() => setActiveScenario('expected')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer ${
                  activeScenario === 'expected'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Expected (Baseline)
              </button>
              <button
                onClick={() => setActiveScenario('optimistic')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer ${
                  activeScenario === 'optimistic'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Optimistic
              </button>
              <button
                onClick={() => setActiveScenario('pessimistic')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer ${
                  activeScenario === 'pessimistic'
                    ? 'bg-white text-rose-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pessimistic
              </button>
            </div>

            {/* Generate Authoritative Version Button */}
            <button
              onClick={handleGenerateAuthoritativeVersion}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Recording...' : 'Persist Version'}
            </button>

            {/* Version History Button */}
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center shadow-xs transition-all cursor-pointer"
            >
              <History className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Audit Log ({historyRuns.length})
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Scenario Description Banner */}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600 bg-slate-50/80 px-3 py-2 rounded-lg border border-slate-100">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              {activeScenario === 'expected' && (
                <>
                  <strong className="text-slate-900">Baseline Scenario:</strong> Uses documented customer collection terms, due dates, and verified recurring schedules.
                </>
              )}
              {activeScenario === 'optimistic' && (
                <>
                  <strong className="text-emerald-900">Optimistic Scenario:</strong> Receivables collected 3 days faster, supplier payments enjoy a 3-day grace period.
                </>
              )}
              {activeScenario === 'pessimistic' && (
                <>
                  <strong className="text-rose-900">Pessimistic Stress Scenario:</strong> Receivables face 7-day payment delay; operational expenses experience a +5% cost surge.
                </>
              )}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Formula: Ending(t) = Beginning(t) + Inflows(t) - Outflows(t)
          </span>
        </div>
      </div>

      {/* 2. Key Financial Forecast Summary Cards */}
      {forecastData && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Opening Cash
            </span>
            <div className="text-lg font-bold text-slate-900 mt-1">
              {currencySymbol}
              {forecastData.openingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400">Day 0 Active Accounts</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" /> Expected Inflows
            </span>
            <div className="text-lg font-bold text-emerald-700 mt-1">
              +{currencySymbol}
              {forecastData.summary.totalExpectedInflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-600">AR & Scheduled Collections</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-rose-700 uppercase tracking-wider flex items-center">
              <TrendingDown className="w-3 h-3 mr-1" /> Expected Outflows
            </span>
            <div className="text-lg font-bold text-rose-700 mt-1">
              -{currencySymbol}
              {forecastData.summary.totalExpectedOutflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-rose-600">AP, Rent, Payroll & EMI</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Net Cash Flow
            </span>
            <div
              className={`text-lg font-bold mt-1 ${
                forecastData.summary.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {forecastData.summary.netCashFlow >= 0 ? '+' : ''}
              {currencySymbol}
              {forecastData.summary.netCashFlow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400">Total Net Delta</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Min Projected Cash
            </span>
            <div
              className={`text-lg font-bold mt-1 ${
                forecastData.summary.minimumProjectedCash < forecastData.minimumCashThreshold
                  ? 'text-rose-700'
                  : 'text-indigo-700'
              }`}
            >
              {currencySymbol}
              {forecastData.summary.minimumProjectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400">
              Threshold: {currencySymbol}{forecastData.minimumCashThreshold.toLocaleString()}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center">
              <ShieldAlert className="w-3 h-3 mr-1 text-amber-500" /> Shortfall Days
            </span>
            <div
              className={`text-lg font-bold mt-1 ${
                forecastData.summary.shortfallDays > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {forecastData.summary.shortfallDays} Days
            </div>
            <span className="text-[10px] text-slate-400">
              Risk: <span className="uppercase font-bold">{forecastData.summary.riskLevel}</span>
            </span>
          </div>
        </div>
      )}

      {/* 3. Daily Cash-Flow Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center">
              <Calendar className="h-4 w-4 mr-1.5 text-indigo-600" />
              Daily Ending Cash & Operational Flow Trajectory
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Day-by-day cash progression against minimum safety liquidity buffer
            </p>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="flex items-center">
              <span className="w-3 h-3 rounded-xs bg-indigo-600 mr-1.5"></span> Ending Cash
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 rounded-xs bg-emerald-500 mr-1.5"></span> Inflows
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 rounded-xs bg-rose-500 mr-1.5"></span> Outflows
            </span>
            <span className="flex items-center">
              <span className="w-3 h-0.5 bg-rose-400 mr-1.5 border-t border-dashed border-rose-500"></span> Min Safety Reserve
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} interval={2} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(val: any, name: any) => [
                  `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                  name,
                ]}
                labelFormatter={(label: any) => `Date: ${label}`}
              />
              <ReferenceLine
                y={minimumThreshold}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                label={{
                  value: `Min Safety Buffer (₹${minimumThreshold.toLocaleString()})`,
                  fill: '#f43f5e',
                  fontSize: 10,
                  position: 'insideTopLeft',
                }}
              />
              <Bar dataKey="inflows" fill="#10b981" fillOpacity={0.7} name="Daily Inflows" />
              <Bar dataKey="outflows" fill="#f43f5e" fillOpacity={0.7} name="Daily Outflows" />
              <Line
                type="monotone"
                dataKey="endingCash"
                stroke="#4f46e5"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#4f46e5' }}
                activeDot={{ r: 5 }}
                name="Ending Cash"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Forecast Risk & Explanation Breakdown */}
      {forecastData && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div
            className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200 cursor-pointer"
            onClick={() => setShowExplanationPanel(!showExplanationPanel)}
          >
            <div className="flex items-center space-x-2">
              <Info className="h-4 w-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Audited Forecast Explanation & Certainty Analysis
              </h3>
            </div>
            <button className="text-slate-500 hover:text-slate-800">
              {showExplanationPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showExplanationPanel && (
            <div className="p-5 space-y-5">
              {/* Risk Indicators Alerts */}
              {forecastData.summary.riskIndicators.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Identified Liquidity Risk Indicators:
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {forecastData.summary.riskIndicators.map((risk) => (
                      <div
                        key={risk.code}
                        className={`p-3 rounded-lg border text-xs flex items-start space-x-3 ${
                          risk.severity === 'critical'
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : risk.severity === 'high'
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-blue-50 border-blue-200 text-blue-900'
                        }`}
                      >
                        <AlertTriangle
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            risk.severity === 'critical'
                              ? 'text-rose-600'
                              : risk.severity === 'high'
                              ? 'text-amber-600'
                              : 'text-blue-600'
                          }`}
                        />
                        <div>
                          <div className="font-bold">{risk.title}</div>
                          <p className="mt-0.5 opacity-90">{risk.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Breakdown Grids */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 border-t border-slate-100">
                {/* 1. Inflow Sources */}
                <div className="space-y-2 text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block">
                    Cash Inflow Sources:
                  </span>
                  <div className="space-y-1.5">
                    {Object.entries(forecastData.explanation.inflowBreakdownByCategory).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">{cat}</span>
                        <span className="font-semibold text-emerald-700">
                          +{currencySymbol}{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Outflow Obligations */}
                <div className="space-y-2 text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block">
                    Cash Outflow Obligations:
                  </span>
                  <div className="space-y-1.5">
                    {Object.entries(forecastData.explanation.outflowBreakdownByCategory).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">{cat}</span>
                        <span className="font-semibold text-rose-700">
                          -{currencySymbol}{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Certainty Distribution */}
                <div className="space-y-2 text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wider block">
                    Cash Certainty Classification:
                  </span>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100 flex justify-between items-center">
                      <span className="font-medium text-emerald-900 flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> CONFIRMED
                      </span>
                      <span className="font-bold text-emerald-700">
                        {currencySymbol}
                        {(forecastData.explanation.certaintyDistribution.CONFIRMED || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 flex justify-between items-center">
                      <span className="font-medium text-blue-900 flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" /> EXPECTED
                      </span>
                      <span className="font-bold text-blue-700">
                        {currencySymbol}
                        {(forecastData.explanation.certaintyDistribution.EXPECTED || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-100 flex justify-between items-center">
                      <span className="font-medium text-amber-900 flex items-center">
                        <Info className="w-3.5 h-3.5 mr-1 text-amber-600" /> ASSUMED
                      </span>
                      <span className="font-bold text-amber-700">
                        {currencySymbol}
                        {(forecastData.explanation.certaintyDistribution.ASSUMED || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Detailed Daily Forecast Table with Expandable Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              30-Day Daily Cash Progression Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any date to inspect the atomic line items and scheduling traceability
            </p>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search by date, day or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Day</th>
                <th className="px-3 py-2.5 text-right">Beginning Cash</th>
                <th className="px-3 py-2.5 text-right text-emerald-700">Expected Inflows</th>
                <th className="px-3 py-2.5 text-right text-rose-700">Expected Outflows</th>
                <th className="px-3 py-2.5 text-right">Net Flow</th>
                <th className="px-3 py-2.5 text-right font-bold">Ending Cash</th>
                <th className="px-3 py-2.5 text-center">Buffer Status</th>
                <th className="px-3 py-2.5 text-center">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDaily.map((row) => {
                const isExpanded = expandedDay === row.date;
                return (
                  <React.Fragment key={row.date}>
                    <tr
                      onClick={() => setExpandedDay(isExpanded ? null : row.date)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        row.thresholdStatus === 'below_threshold'
                          ? 'bg-rose-50/40'
                          : row.thresholdStatus === 'approaching_threshold'
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-900">{row.date}</td>
                      <td className="px-3 py-2.5 text-slate-500">{row.dayOfWeek}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 font-mono">
                        {currencySymbol}{row.beginningCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 font-mono">
                        {row.expectedInflows > 0 ? `+${currencySymbol}${row.expectedInflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-rose-700 font-mono">
                        {row.expectedOutflows > 0 ? `-${currencySymbol}${row.expectedOutflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-bold font-mono ${
                          row.netCashFlow > 0
                            ? 'text-emerald-600'
                            : row.netCashFlow < 0
                            ? 'text-rose-600'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.netCashFlow > 0 ? '+' : ''}
                        {currencySymbol}{row.netCashFlow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900 font-mono">
                        {currencySymbol}{row.endingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {getThresholdBadge(row.thresholdStatus)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button className="text-slate-400 hover:text-slate-700">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 mx-auto" />
                          ) : (
                            <span className="inline-flex items-center text-[10px] text-indigo-600 font-semibold">
                              {row.items.length} {row.items.length === 1 ? 'item' : 'items'}
                              <ChevronDown className="w-3 h-3 ml-0.5" />
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable atomic items row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80 border-y border-indigo-100">
                        <td colSpan={9} className="px-4 py-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                              <span>Traceable Line Items for {row.date} ({row.dayOfWeek}):</span>
                              <span>Closing Cash: {currencySymbol}{row.endingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>

                            {row.items.length === 0 ? (
                              <p className="text-xs text-slate-400 italic py-2">
                                No scheduled inflows or outflows on this calendar day.
                              </p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-[11px] text-left border border-slate-200 bg-white rounded-md">
                                  <thead className="bg-slate-100 text-slate-600 font-semibold">
                                    <tr>
                                      <th className="px-2.5 py-1.5">Certainty</th>
                                      <th className="px-2.5 py-1.5">Type</th>
                                      <th className="px-2.5 py-1.5">Source</th>
                                      <th className="px-2.5 py-1.5">Category</th>
                                      <th className="px-2.5 py-1.5">Description</th>
                                      <th className="px-2.5 py-1.5">Scheduling Method</th>
                                      <th className="px-2.5 py-1.5 text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {row.items.map((item) => (
                                      <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="px-2.5 py-1.5">{getCertaintyBadge(item.certainty)}</td>
                                        <td className="px-2.5 py-1.5">
                                          <span
                                            className={`font-semibold uppercase text-[10px] ${
                                              item.type === 'inflow' ? 'text-emerald-700' : 'text-rose-700'
                                            }`}
                                          >
                                            {item.type}
                                          </span>
                                        </td>
                                        <td className="px-2.5 py-1.5 text-slate-600">{item.source}</td>
                                        <td className="px-2.5 py-1.5 font-medium text-slate-800">{item.category}</td>
                                        <td className="px-2.5 py-1.5 text-slate-600">{item.description}</td>
                                        <td className="px-2.5 py-1.5 font-mono text-[10px] text-slate-500">
                                          {item.schedulingMethod}
                                        </td>
                                        <td
                                          className={`px-2.5 py-1.5 text-right font-bold font-mono ${
                                            item.type === 'inflow' ? 'text-emerald-700' : 'text-rose-700'
                                          }`}
                                        >
                                          {item.type === 'inflow' ? '+' : '-'}
                                          {currencySymbol}{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Historical Runs Audit Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Historical Forecast Runs Audit Trail</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 my-4 divide-y divide-slate-100">
              {historyRuns.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No historical versions persisted yet. Click "Persist Version" to freeze an auditable run.
                </p>
              ) : (
                historyRuns.map((run) => (
                  <div key={run.id} className="py-3 text-xs flex justify-between items-center hover:bg-slate-50 px-2 rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-indigo-700">v{run.forecast_version}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 uppercase text-[10px] font-semibold text-slate-700">
                          {run.scenario_type}
                        </span>
                        <span className="text-slate-400">
                          {new Date(run.created_at).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Window: {run.start_date} to {run.end_date} | Shortfall: {run.shortfall_days} days
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-bold font-mono ${
                          run.net_cash_flow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        Net: {currencySymbol}{run.net_cash_flow.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase">
                        Min: {currencySymbol}{run.minimum_projected_cash.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
