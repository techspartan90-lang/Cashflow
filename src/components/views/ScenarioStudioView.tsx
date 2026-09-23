import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  Sliders,
  Plus,
  Play,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  GitCompare,
  BarChart3,
  RefreshCw,
  Clock,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import {
  ScenarioRow,
  ScenarioAssumptionRow,
  ScenarioSimulationOutput,
  ScenarioComparisonSummary,
  SensitivityAnalysisResult,
  DecisionSupportInsight,
} from '../../services/scenario-engine';
import { ScenarioApiClient, MultiScenarioCompareResponse } from '../../services/scenario-api';
import { ForecastApiClient } from '../../services/forecast-api';

interface ScenarioStudioViewProps {
  currencySymbol?: string;
  minimumThreshold?: number;
}

export const ScenarioStudioView: React.FC<ScenarioStudioViewProps> = ({
  currencySymbol = '₹',
  minimumThreshold = 100000,
}) => {
  // Navigation sub-tab: 'simulator' | 'compare' | 'sensitivity'
  const [activeSubTab, setActiveSubTab] = useState<'simulator' | 'compare' | 'sensitivity'>('simulator');

  // Scenarios State
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [currentScenario, setCurrentScenario] = useState<ScenarioRow | null>(null);
  const [assumptions, setAssumptions] = useState<ScenarioAssumptionRow[]>([]);
  const [simulationResult, setSimulationResult] = useState<ScenarioSimulationOutput | null>(null);

  // Loading & Action states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals & Forms
  const [showNewScenarioModal, setShowNewScenarioModal] = useState<boolean>(false);
  const [showAddAssumptionModal, setShowAddAssumptionModal] = useState<boolean>(false);

  // New Scenario Form
  const [newScenarioName, setNewScenarioName] = useState<string>('');
  const [newScenarioDesc, setNewScenarioDesc] = useState<string>('');
  const [newScenarioType, setNewScenarioType] = useState<ScenarioRow['scenario_type']>('custom');

  // New Assumption Form
  const [newAsmType, setNewAsmType] = useState<ScenarioAssumptionRow['assumption_type']>('revenue_adjustment');
  const [newAsmTargetType, setNewAsmTargetType] = useState<ScenarioAssumptionRow['target_type']>('all');
  const [newAsmTargetId, setNewAsmTargetId] = useState<string>('');
  const [newAsmMethod, setNewAsmMethod] = useState<ScenarioAssumptionRow['adjustment_method']>('percentage_change');
  const [newAsmValue, setNewAsmValue] = useState<number>(-10);
  const [newAsmStartDate, setNewAsmStartDate] = useState<string>('2026-09-23');
  const [newAsmEndDate, setNewAsmEndDate] = useState<string>('2026-10-22');
  const [newAsmDesc, setNewAsmDesc] = useState<string>('10% decrease in customer sales');

  // Multi-Scenario Comparison State
  const [compareData, setCompareData] = useState<MultiScenarioCompareResponse | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // Sensitivity Analysis State
  const [sensitivityVariable, setSensitivityVariable] = useState<'revenue_multiplier' | 'ar_delay_days' | 'expense_multiplier' | 'one_time_shock'>('revenue_multiplier');
  const [sensitivityResult, setSensitivityResult] = useState<SensitivityAnalysisResult | null>(null);
  const [isSensitivityLoading, setIsSensitivityLoading] = useState<boolean>(false);

  // Load scenarios list on mount
  useEffect(() => {
    loadScenariosList();
  }, []);

  const loadScenariosList = async (selectId?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await ScenarioApiClient.listScenarios();
      if (res.success && res.data) {
        setScenarios(res.data);
        const targetId = selectId || (res.data.length > 0 ? res.data[0].id : '');
        setSelectedScenarioId(targetId);
        if (targetId) {
          await loadScenarioDetails(targetId);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load scenarios');
    } finally {
      setIsLoading(false);
    }
  };

  const loadScenarioDetails = async (id: string) => {
    setIsCalculating(true);
    try {
      const scenRes = await ScenarioApiClient.getScenario(id);
      if (scenRes.success && scenRes.data) {
        setCurrentScenario(scenRes.data);
        setAssumptions(scenRes.data.assumptions || []);
      }

      // Load results / calculate
      const simRes = await ScenarioApiClient.getScenarioResults(id);
      if (simRes.success && simRes.data) {
        setSimulationResult(simRes.data);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to calculate scenario');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleScenarioChange = (id: string) => {
    setSelectedScenarioId(id);
    loadScenarioDetails(id);
  };

  // Run calculation
  const handleRunCalculation = async () => {
    if (!selectedScenarioId) return;
    setIsCalculating(true);
    try {
      const res = await ScenarioApiClient.calculateScenario(selectedScenarioId);
      if (res.success && res.data) {
        setSimulationResult(res.data);
        loadScenariosList(selectedScenarioId);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Simulation execution failed');
    } finally {
      setIsCalculating(false);
    }
  };

  // Create Scenario
  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenarioName.trim()) return;

    try {
      const res = await ScenarioApiClient.createScenario({
        name: newScenarioName.trim(),
        description: newScenarioDesc.trim(),
        scenario_type: newScenarioType,
      });

      if (res.success && res.data) {
        setShowNewScenarioModal(false);
        setNewScenarioName('');
        setNewScenarioDesc('');
        loadScenariosList(res.data.id);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create scenario');
    }
  };

  // Delete Scenario
  const handleDeleteScenario = async () => {
    if (!selectedScenarioId) return;
    if (!confirm('Are you sure you want to delete this scenario simulation?')) return;

    try {
      await ScenarioApiClient.deleteScenario(selectedScenarioId);
      loadScenariosList();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete scenario');
    }
  };

  // Add Assumption
  const handleAddAssumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScenarioId) return;

    try {
      const res = await ScenarioApiClient.addAssumption(selectedScenarioId, {
        assumption_type: newAsmType,
        target_type: newAsmTargetType,
        target_id: newAsmTargetId.trim() || null,
        adjustment_method: newAsmMethod,
        adjustment_value: Number(newAsmValue),
        start_date: newAsmStartDate || null,
        end_date: newAsmEndDate || null,
        description: newAsmDesc.trim() || 'Custom assumption',
        source: 'user_defined',
      });

      if (res.success) {
        setShowAddAssumptionModal(false);
        // Automatically re-calculate with new assumption
        await handleRunCalculation();
        loadScenarioDetails(selectedScenarioId);
      } else if (res.errors) {
        alert(res.errors.join('\n'));
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to add assumption');
    }
  };

  // Delete Assumption
  const handleDeleteAssumption = async (asmId: string) => {
    if (!selectedScenarioId) return;
    try {
      await ScenarioApiClient.deleteAssumption(selectedScenarioId, asmId);
      await handleRunCalculation();
      loadScenarioDetails(selectedScenarioId);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete assumption');
    }
  };

  // Multi-Scenario Compare Load
  useEffect(() => {
    if (activeSubTab === 'compare' && scenarios.length > 0) {
      loadCompareData();
    }
  }, [activeSubTab, scenarios]);

  const loadCompareData = async () => {
    setIsComparing(true);
    try {
      const ids = scenarios.map((s) => s.id);
      const res = await ScenarioApiClient.compareScenarios(ids);
      if (res.success && res.data) {
        setCompareData(res.data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsComparing(false);
    }
  };

  // Sensitivity Analysis Load
  useEffect(() => {
    if (activeSubTab === 'sensitivity') {
      loadSensitivityData(sensitivityVariable);
    }
  }, [activeSubTab, sensitivityVariable]);

  const loadSensitivityData = async (variable: typeof sensitivityVariable) => {
    setIsSensitivityLoading(true);
    try {
      const res = await ScenarioApiClient.getSensitivityAnalysis(variable);
      if (res.success && res.data) {
        setSensitivityResult(res.data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSensitivityLoading(false);
    }
  };

  // Chart Data preparation
  const chartData = useMemo(() => {
    if (!simulationResult) return [];
    return simulationResult.dailyProgression.map((d) => ({
      date: d.date.slice(5),
      fullDate: d.date,
      baseEndingCash: d.baseEndingCash,
      scenarioEndingCash: d.endingCash,
      scenarioInflows: d.inflows,
      scenarioOutflows: d.outflows,
      minimumThreshold: minimumThreshold,
    }));
  }, [simulationResult, minimumThreshold]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation Pills */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Scenario Simulation & Sensitivity Studio
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 font-semibold">
                Phase 6 Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Deterministic what-if modeling, receivables payment lag shocks, OpEx inflation, and multi-scenario stress comparisons.
            </p>
          </div>

          {/* Sub-tab navigation */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
            <button
              onClick={() => setActiveSubTab('simulator')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer flex items-center ${
                activeSubTab === 'simulator'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Scenario Simulator
            </button>
            <button
              onClick={() => setActiveSubTab('compare')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer flex items-center ${
                activeSubTab === 'compare'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Scenario Comparison
            </button>
            <button
              onClick={() => setActiveSubTab('sensitivity')}
              className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer flex items-center ${
                activeSubTab === 'sensitivity'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Sensitivity Matrix
            </button>
          </div>
        </div>
      </div>

      {/* 2. SUB-TAB: SCENARIO SIMULATOR */}
      {activeSubTab === 'simulator' && (
        <div className="space-y-6">
          {/* Scenario Selector & Action Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-3 flex-1">
              <label className="text-xs font-bold text-slate-700 shrink-0">Active Scenario:</label>
              <select
                value={selectedScenarioId}
                onChange={(e) => handleScenarioChange(e.target.value)}
                className="w-full md:w-80 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.scenario_type.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowNewScenarioModal(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center shrink-0 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-slate-500" />
                New Scenario
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowAddAssumptionModal(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Assumption
              </button>

              <button
                onClick={handleRunCalculation}
                disabled={isCalculating}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 mr-1.5 ${isCalculating ? 'animate-spin' : ''}`} />
                {isCalculating ? 'Calculating...' : 'Recalculate'}
              </button>

              <button
                onClick={handleDeleteScenario}
                title="Delete scenario"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scenario Details & Active Assumptions Card */}
          {currentScenario && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{currentScenario.name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{currentScenario.description || 'No description provided.'}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 uppercase">
                    {currentScenario.scenario_type.replace(/_/g, ' ')}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    currentScenario.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {currentScenario.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Assumptions List */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Applied Scenario Assumptions ({assumptions.length}):
                  </span>
                </div>

                {assumptions.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2 italic">
                    No custom assumptions attached. This scenario reflects the baseline forecast. Click "Add Assumption" to test what-if parameters.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {assumptions.map((asm) => (
                      <div
                        key={asm.id}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between items-start"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-slate-900">{asm.description}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Type: <strong className="text-slate-700">{asm.assumption_type}</strong> | 
                            Method: <strong className="text-slate-700">{asm.adjustment_method}</strong> ({asm.adjustment_value >= 0 ? '+' : ''}{asm.adjustment_value})
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Range: {asm.start_date || 'Start'} to {asm.end_date || 'End'}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteAssumption(asm.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Remove assumption"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Key Metric Comparison Summary Cards */}
          {simulationResult && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* 1. Net Cash Flow */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Scenario Net Flow
                </span>
                <div className="text-lg font-bold text-slate-900 mt-1">
                  {currencySymbol}{simulationResult.summary.scenarioNetCashFlow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className={`text-[11px] font-semibold mt-1 flex items-center ${
                  simulationResult.summary.netCashFlowDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {simulationResult.summary.netCashFlowDelta >= 0 ? (
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-0.5" />
                  )}
                  {simulationResult.summary.netCashFlowDelta >= 0 ? '+' : ''}
                  {currencySymbol}{simulationResult.summary.netCashFlowDelta.toLocaleString('en-IN')} vs Base
                </div>
              </div>

              {/* 2. Projected Ending Cash */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Ending Cash
                </span>
                <div className="text-lg font-bold text-indigo-700 mt-1">
                  {currencySymbol}{simulationResult.summary.scenarioEndingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className={`text-[11px] font-semibold mt-1 flex items-center ${
                  simulationResult.summary.endingCashDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {simulationResult.summary.endingCashDelta >= 0 ? '+' : ''}
                  {currencySymbol}{simulationResult.summary.endingCashDelta.toLocaleString('en-IN')} vs Base
                </div>
              </div>

              {/* 3. Min Projected Cash */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Min Cash Trough
                </span>
                <div className={`text-lg font-bold mt-1 ${
                  simulationResult.summary.scenarioMinProjectedCash < minimumThreshold ? 'text-rose-700' : 'text-slate-900'
                }`}>
                  {currencySymbol}{simulationResult.summary.scenarioMinProjectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className={`text-[11px] font-semibold mt-1 ${
                  simulationResult.summary.minProjectedCashDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {simulationResult.summary.minProjectedCashDelta >= 0 ? '+' : ''}
                  {currencySymbol}{simulationResult.summary.minProjectedCashDelta.toLocaleString('en-IN')} vs Base
                </div>
              </div>

              {/* 4. Shortfall Days */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Shortfall Days
                </span>
                <div className={`text-lg font-bold mt-1 ${
                  simulationResult.summary.scenarioShortfallDays > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  {simulationResult.summary.scenarioShortfallDays} Days
                </div>
                <div className={`text-[11px] font-semibold mt-1 ${
                  simulationResult.summary.shortfallDaysDelta > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  {simulationResult.summary.shortfallDaysDelta > 0 ? '+' : ''}
                  {simulationResult.summary.shortfallDaysDelta} days vs Base
                </div>
              </div>

              {/* 5. Inflow Delta */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider block">
                  Total Inflows
                </span>
                <div className="text-lg font-bold text-emerald-700 mt-1">
                  {currencySymbol}{simulationResult.summary.scenarioTotalInflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-slate-500">
                  {simulationResult.summary.inflowsDelta >= 0 ? '+' : ''}
                  {currencySymbol}{simulationResult.summary.inflowsDelta.toLocaleString('en-IN')} vs Base
                </span>
              </div>

              {/* 6. Outflow Delta */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                <span className="text-[11px] font-medium text-rose-700 uppercase tracking-wider block">
                  Total Outflows
                </span>
                <div className="text-lg font-bold text-rose-700 mt-1">
                  {currencySymbol}{simulationResult.summary.scenarioTotalOutflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-slate-500">
                  {simulationResult.summary.outflowsDelta >= 0 ? '+' : ''}
                  {currencySymbol}{simulationResult.summary.outflowsDelta.toLocaleString('en-IN')} vs Base
                </span>
              </div>
            </div>
          )}

          {/* Comparative Cash Trajectory Chart (Base vs Scenario Overlay) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center">
                  <Calendar className="w-4 h-4 mr-1.5 text-indigo-600" />
                  Cash Progression: Base Forecast vs Simulated Scenario
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visual comparison of ending cash trajectories against the {currencySymbol}{minimumThreshold.toLocaleString()} safety threshold
                </p>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <span className="flex items-center">
                  <span className="w-3 h-0.5 bg-slate-400 mr-1.5 border-t-2 border-dashed border-slate-400"></span>
                  Base Forecast
                </span>
                <span className="flex items-center">
                  <span className="w-3 h-1 bg-indigo-600 mr-1.5 rounded-full"></span>
                  Simulated Scenario
                </span>
                <span className="flex items-center">
                  <span className="w-3 h-0.5 bg-rose-500 mr-1.5 border-t border-dashed border-rose-500"></span>
                  Min Threshold
                </span>
              </div>
            </div>

            <div className="h-72 w-full mt-4">
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
                      value: `Min Reserve (₹${minimumThreshold.toLocaleString()})`,
                      fill: '#f43f5e',
                      fontSize: 10,
                      position: 'insideTopLeft',
                    }}
                  />
                  <Bar dataKey="scenarioInflows" fill="#10b981" fillOpacity={0.4} name="Simulated Inflows" />
                  <Bar dataKey="scenarioOutflows" fill="#f43f5e" fillOpacity={0.4} name="Simulated Outflows" />
                  <Line
                    type="monotone"
                    dataKey="baseEndingCash"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    name="Base Ending Cash"
                  />
                  <Line
                    type="monotone"
                    dataKey="scenarioEndingCash"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: '#4f46e5' }}
                    activeDot={{ r: 5 }}
                    name="Scenario Ending Cash"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Decision-Support Insights Panel */}
          {simulationResult && simulationResult.insights.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Quantitative Decision-Support Insights:
                </h3>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {simulationResult.insights.map((ins) => (
                  <div
                    key={ins.id}
                    className={`p-3.5 rounded-lg border text-xs flex items-start space-x-3 ${
                      ins.severity === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-950'
                        : ins.severity === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : ins.severity === 'positive'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-blue-50 border-blue-200 text-blue-950'
                    }`}
                  >
                    {ins.severity === 'critical' ? (
                      <ShieldAlert className="w-4 h-4 mt-0.5 text-rose-600 shrink-0" />
                    ) : ins.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold">{ins.title}</div>
                      <p className="mt-1 opacity-90 leading-relaxed">{ins.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Side-by-Side Comparison Ledger Table */}
          {simulationResult && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Daily Ledger Delta Comparison (Base vs Scenario)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Day-by-day atomic progression tracking cumulative variance
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Day</th>
                      <th className="px-3 py-2.5 text-right">Base Ending</th>
                      <th className="px-3 py-2.5 text-right font-bold text-indigo-700">Scenario Ending</th>
                      <th className="px-3 py-2.5 text-right font-bold">Variance (Δ)</th>
                      <th className="px-3 py-2.5 text-right text-emerald-700">Inflows</th>
                      <th className="px-3 py-2.5 text-right text-rose-700">Outflows</th>
                      <th className="px-3 py-2.5 text-center">Buffer Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {simulationResult.dailyProgression.map((d) => (
                      <tr
                        key={d.date}
                        className={`hover:bg-slate-50 transition-colors ${
                          d.thresholdStatus === 'below_threshold' ? 'bg-rose-50/40' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-slate-900">{d.date}</td>
                        <td className="px-3 py-2 text-slate-500">{d.dayOfWeek}</td>
                        <td className="px-3 py-2 text-right text-slate-500 font-mono">
                          {currencySymbol}{d.baseEndingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-indigo-700 font-mono">
                          {currencySymbol}{d.endingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-bold font-mono ${
                            d.cashDelta > 0
                              ? 'text-emerald-600'
                              : d.cashDelta < 0
                              ? 'text-rose-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {d.cashDelta > 0 ? '+' : ''}
                          {currencySymbol}{d.cashDelta.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-700 font-mono">
                          +{currencySymbol}{d.inflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-right text-rose-700 font-mono">
                          -{currencySymbol}{d.outflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {d.thresholdStatus === 'below_threshold' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Deficit: -{currencySymbol}{d.shortfallAmount.toLocaleString()}
                            </span>
                          ) : d.thresholdStatus === 'approaching_threshold' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              Approaching Buffer
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
      )}

      {/* 3. SUB-TAB: SCENARIO COMPARISON MATRIX */}
      {activeSubTab === 'compare' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center">
                <GitCompare className="w-4 h-4 mr-1.5 text-indigo-600" />
                Multi-Scenario Comparative Financial Matrix
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Objective side-by-side comparison of baseline vs custom simulated what-if models
              </p>
            </div>
            <button
              onClick={loadCompareData}
              disabled={isComparing}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isComparing ? 'animate-spin' : ''}`} />
              Refresh Comparisons
            </button>
          </div>

          {compareData && (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Financial Metric</th>
                    <th className="px-3 py-2.5 text-right bg-slate-100/60 font-bold">Base Forecast</th>
                    {compareData.scenarios.map((s) => (
                      <th key={s.scenarioId} className="px-3 py-2.5 text-right font-bold text-indigo-700">
                        {s.scenarioName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">Total Expected Inflows</td>
                    <td className="px-3 py-2.5 text-right font-mono bg-slate-50/40 text-emerald-700 font-semibold">
                      +{currencySymbol}{compareData.baseForecast.totalInflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {compareData.scenarios.map((s) => (
                      <td key={s.scenarioId} className="px-3 py-2.5 text-right font-mono text-emerald-700 font-semibold">
                        +{currencySymbol}{s.scenarioTotalInflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        <span className="block text-[10px] text-slate-400">
                          ({s.inflowsDelta >= 0 ? '+' : ''}{currencySymbol}{s.inflowsDelta.toLocaleString('en-IN')})
                        </span>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">Total Expected Outflows</td>
                    <td className="px-3 py-2.5 text-right font-mono bg-slate-50/40 text-rose-700 font-semibold">
                      -{currencySymbol}{compareData.baseForecast.totalOutflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {compareData.scenarios.map((s) => (
                      <td key={s.scenarioId} className="px-3 py-2.5 text-right font-mono text-rose-700 font-semibold">
                        -{currencySymbol}{s.scenarioTotalOutflows.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        <span className="block text-[10px] text-slate-400">
                          ({s.outflowsDelta >= 0 ? '+' : ''}{currencySymbol}{s.outflowsDelta.toLocaleString('en-IN')})
                        </span>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">Net Cash Flow Delta</td>
                    <td className="px-3 py-2.5 text-right font-mono bg-slate-50/40 font-bold">
                      {compareData.baseForecast.netCashFlow >= 0 ? '+' : ''}
                      {currencySymbol}{compareData.baseForecast.netCashFlow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {compareData.scenarios.map((s) => (
                      <td
                        key={s.scenarioId}
                        className={`px-3 py-2.5 text-right font-mono font-bold ${
                          s.scenarioNetCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {s.scenarioNetCashFlow >= 0 ? '+' : ''}
                        {currencySymbol}{s.scenarioNetCashFlow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        <span className="block text-[10px] text-slate-500 font-normal">
                          Δ {s.netCashFlowDelta >= 0 ? '+' : ''}{currencySymbol}{s.netCashFlowDelta.toLocaleString('en-IN')}
                        </span>
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-indigo-50/30">
                    <td className="px-3 py-2.5 font-bold text-slate-900">Projected Ending Cash (Day 30)</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 bg-slate-100/60">
                      {currencySymbol}{compareData.baseForecast.endingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {compareData.scenarios.map((s) => (
                      <td key={s.scenarioId} className="px-3 py-2.5 text-right font-mono font-bold text-indigo-700">
                        {currencySymbol}{s.scenarioEndingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        <span className="block text-[10px] text-indigo-500 font-normal">
                          Δ {s.endingCashDelta >= 0 ? '+' : ''}{currencySymbol}{s.endingCashDelta.toLocaleString('en-IN')}
                        </span>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">Minimum Projected Cash Trough</td>
                    <td className="px-3 py-2.5 text-right font-mono bg-slate-50/40">
                      {currencySymbol}{compareData.baseForecast.minimumProjectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {compareData.scenarios.map((s) => (
                      <td key={s.scenarioId} className="px-3 py-2.5 text-right font-mono">
                        {currencySymbol}{s.scenarioMinProjectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">Shortfall Days (Below Threshold)</td>
                    <td className="px-3 py-2.5 text-right font-mono bg-slate-50/40 font-bold">
                      {compareData.baseForecast.shortfallDays} Days
                    </td>
                    {compareData.scenarios.map((s) => (
                      <td
                        key={s.scenarioId}
                        className={`px-3 py-2.5 text-right font-mono font-bold ${
                          s.scenarioShortfallDays > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {s.scenarioShortfallDays} Days
                        {s.shortfallDaysDelta !== 0 && (
                          <span className="block text-[10px] font-normal text-slate-500">
                            ({s.shortfallDaysDelta > 0 ? '+' : ''}{s.shortfallDaysDelta} days)
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">First Projected Shortfall Date</td>
                    <td className="px-3 py-2.5 text-right bg-slate-50/40 text-slate-500 font-mono">
                      {compareData.baseForecast.shortfallDays > 0 ? 'Day in Base' : 'None'}
                    </td>
                    {compareData.scenarios.map((s) => (
                      <td key={s.scenarioId} className="px-3 py-2.5 text-right font-mono text-slate-600">
                        {s.firstShortfallDate || 'None'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. SUB-TAB: SENSITIVITY MATRIX */}
      {activeSubTab === 'sensitivity' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center">
                <BarChart3 className="w-4 h-4 mr-1.5 text-indigo-600" />
                Single-Variable Sensitivity Analysis & Stress Matrix
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluates how discrete shifts in key operational parameters impact cash buffer and shortfall exposure
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-slate-600">Stress Variable:</label>
              <select
                value={sensitivityVariable}
                onChange={(e) => setSensitivityVariable(e.target.value as any)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 cursor-pointer focus:ring-1 focus:ring-indigo-500"
              >
                <option value="revenue_multiplier">Revenue Demand Shock (-30% to +30%)</option>
                <option value="ar_delay_days">Receivables Collection Lag (0 to 30 Days)</option>
                <option value="expense_multiplier">OpEx Inflation & Supplier Surcharges (0% to +30%)</option>
                <option value="one_time_shock">One-Time Operational Liquidity Drain (₹20k to ₹100k)</option>
              </select>
            </div>
          </div>

          {/* Sensitivity Table */}
          {sensitivityResult && (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Stress Parameter Level</th>
                      <th className="px-3 py-2.5 text-right">Ending Cash (Day 30)</th>
                      <th className="px-3 py-2.5 text-right">Variance vs Base (Δ)</th>
                      <th className="px-3 py-2.5 text-right">Min Projected Cash</th>
                      <th className="px-3 py-2.5 text-center">Shortfall Days</th>
                      <th className="px-3 py-2.5 text-right">Max Deficit</th>
                      <th className="px-3 py-2.5 text-center">Threshold Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sensitivityResult.steps.map((step) => (
                      <tr
                        key={step.stepIndex}
                        className={`hover:bg-slate-50 transition-colors ${
                          step.parameterValue === 0 ? 'bg-indigo-50/30 font-semibold' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          {step.stepLabel}
                          {step.parameterValue === 0 && (
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                              BASELINE
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                          {currencySymbol}{step.endingCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-mono font-semibold ${
                            step.endingCashDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {step.endingCashDelta >= 0 ? '+' : ''}
                          {currencySymbol}{step.endingCashDelta.toLocaleString('en-IN')}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-mono ${
                            step.minProjectedCash < minimumThreshold ? 'text-rose-700 font-bold' : 'text-slate-700'
                          }`}
                        >
                          {currencySymbol}{step.minProjectedCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold">
                          {step.shortfallDays > 0 ? (
                            <span className="text-rose-700">{step.shortfallDays} Days</span>
                          ) : (
                            <span className="text-emerald-700">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-rose-700 font-semibold">
                          {step.maxShortfallDeficit > 0 ? `-${currencySymbol}${step.maxShortfallDeficit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {step.minProjectedCash < minimumThreshold ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              Breach
                            </span>
                          ) : step.minProjectedCash < minimumThreshold * 1.15 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                              Warning
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              Safe Buffer
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
      )}

      {/* MODAL: CREATE NEW SCENARIO */}
      {showNewScenarioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Create New Simulation Scenario</h3>
              </div>
              <button
                onClick={() => setShowNewScenarioModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateScenario} className="space-y-4 my-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Scenario Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Major Client 30-Day Payment Delay"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Scenario Category *</label>
                <select
                  value={newScenarioType}
                  onChange={(e) => setNewScenarioType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="customer_payment_delay">Customer Payment Delay</option>
                  <option value="expense_change">Operating Expense Change / Inflation</option>
                  <option value="revenue_change">Revenue Growth or Contraction</option>
                  <option value="unexpected_expense">Unexpected One-Time Expense Shock</option>
                  <option value="new_business_commitment">New Business Commitment (Hire/Lease)</option>
                  <option value="custom">Custom Multi-Factor Scenario</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Description / Business Objective</label>
                <textarea
                  rows={3}
                  placeholder="Explain why this scenario is being tested and what hypothesis is being evaluated..."
                  value={newScenarioDesc}
                  onChange={(e) => setNewScenarioDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewScenarioModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                >
                  Create & Open
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ASSUMPTION */}
      {showAddAssumptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Add Assumption to Scenario</h3>
              </div>
              <button
                onClick={() => setShowAddAssumptionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAssumption} className="space-y-4 my-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Assumption Type</label>
                <select
                  value={newAsmType}
                  onChange={(e) => {
                    const t = e.target.value as any;
                    setNewAsmType(t);
                    if (t === 'customer_delay') {
                      setNewAsmMethod('date_shift');
                      setNewAsmValue(14);
                      setNewAsmDesc('Delay receivables by 14 days');
                    } else if (t === 'one_time_expense') {
                      setNewAsmMethod('one_time_event');
                      setNewAsmValue(30000);
                      setNewAsmDesc('One-time emergency equipment overhaul');
                    } else if (t === 'new_commitment') {
                      setNewAsmMethod('recurring_event');
                      setNewAsmValue(40000);
                      setNewAsmDesc('New monthly subscription / hire');
                    } else {
                      setNewAsmMethod('percentage_change');
                      setNewAsmValue(-10);
                      setNewAsmDesc('10% reduction in revenue');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                >
                  <option value="revenue_adjustment">Revenue Inflow Adjustment</option>
                  <option value="customer_delay">Customer AR Payment Timing Delay</option>
                  <option value="expense_adjustment">Expense Outflow Adjustment</option>
                  <option value="one_time_expense">One-Time Unexpected Outflow Shock</option>
                  <option value="new_commitment">New Business Commitment</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Adjustment Method</label>
                  <select
                    value={newAsmMethod}
                    onChange={(e) => setNewAsmMethod(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="percentage_change">Percentage Change (%)</option>
                    <option value="absolute_change">Absolute Monetary (₹)</option>
                    <option value="date_shift">Date Shift (Days)</option>
                    <option value="one_time_event">One-Time Event</option>
                    <option value="recurring_event">Recurring Event</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Value {newAsmMethod === 'percentage_change' ? '(%)' : newAsmMethod === 'date_shift' ? '(Days)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newAsmValue}
                    onChange={(e) => setNewAsmValue(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 15% revenue contraction from major distributor"
                  value={newAsmDesc}
                  onChange={(e) => setNewAsmDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newAsmStartDate}
                    onChange={(e) => setNewAsmStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={newAsmEndDate}
                    onChange={(e) => setNewAsmEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddAssumptionModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                >
                  Apply Assumption
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
