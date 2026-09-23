import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DEMO_BUSINESS_PROFILE,
  DEMO_TRANSACTIONS,
  DEMO_SALES_INVOICES,
  DEMO_PURCHASE_INVOICES,
  DEMO_OPERATING_EXPENSES,
  DEMO_INVENTORY_ITEMS,
  DEMO_LOANS,
  DEMO_TAXES,
  DEMO_VARIANCE_RECORDS,
  DEMO_RECOMMENDATIONS,
} from './data/demo-dataset';
import {
  generateDailyForecast,
  aggregateWeeklyForecast,
  calculateCashRunway,
  calculateCashConversionCycle,
  runMonteCarloSimulation,
  detectBottlenecks,
  calculateVarianceMetrics,
  EngineInputState,
} from './lib/financial-engine';
import {
  ScenarioType,
  ScenarioParameters,
  FinancialTransaction,
  SalesInvoiceAR,
  PurchaseInvoiceAP,
  OperatingExpense,
  InventoryItem,
  LoanObligation,
  TaxObligation,
  VarianceDayRecord,
  ActionableRecommendation,
  FinancialAlert,
} from './types/financial';
import {
  requestAiAdvisory,
  exportDailyForecastCsv,
  AiAdvisoryResponse,
} from './services/api-service';

import { Header } from './components/Header';
import { Navigation, TabKey } from './components/Navigation';
import { KpiCards } from './components/dashboard/KpiCards';
import { CashTrajectoryChart } from './components/dashboard/CashTrajectoryChart';
import { ScenarioComparisonChart } from './components/dashboard/ScenarioComparisonChart';
import { WeeklyFlowSummary } from './components/dashboard/WeeklyFlowSummary';
import { AlertsPanel } from './components/dashboard/AlertsPanel';
import { BottlenecksList } from './components/dashboard/BottlenecksList';
import { RecommendationsCards } from './components/dashboard/RecommendationsCards';
import { GitCompare, TrendingUp, Layers } from 'lucide-react';

import { TrajectoryView } from './components/views/TrajectoryView';
import { ScenarioStudioView } from './components/views/ScenarioStudioView';
import { ReceivablesView } from './components/views/ReceivablesView';
import { PayablesView } from './components/views/PayablesView';
import { InventoryView } from './components/views/InventoryView';
import { ObligationsView } from './components/views/ObligationsView';
import { VarianceView } from './components/views/VarianceView';
import { IngestionView } from './components/views/IngestionView';
import { AlertCenterView } from './components/views/AlertCenterView';
import { RecommendationsView } from './components/views/RecommendationsView';
import { MonitoringSettingsModal } from './components/modals/MonitoringSettingsModal';
import { NotificationCenterModal } from './components/modals/NotificationCenterModal';
import { MonitoringApiClient } from './services/monitoring-api';

import { AiAdvisoryModal } from './components/modals/AiAdvisoryModal';
import { AddTransactionModal } from './components/modals/AddTransactionModal';
import { CsvImportModal } from './components/modals/CsvImportModal';
import { LiveVoiceModal } from './components/modals/LiveVoiceModal';
import { GeminiChatbotModal } from './components/modals/GeminiChatbotModal';
import { GroundingIntelligenceModal } from './components/modals/GroundingIntelligenceModal';
import { AudioTranscriptionModal } from './components/modals/AudioTranscriptionModal';
import { Radio, MessageSquare, Globe, FileAudio, Sparkles as SparklesIcon } from 'lucide-react';

export default function App() {
  // 1. Core Financial State
  const [businessProfile, setBusinessProfile] = useState(DEMO_BUSINESS_PROFILE);
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('expected');
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [dashboardChartMode, setDashboardChartMode] = useState<'scenario_overlay' | 'operational' | 'dual'>('scenario_overlay');

  // Gemini Intelligence Modals
  const [isLiveVoiceOpen, setIsLiveVoiceOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isGroundingOpen, setIsGroundingOpen] = useState(false);
  const [isTranscriptionOpen, setIsTranscriptionOpen] = useState(false);

  const [transactions, setTransactions] = useState<FinancialTransaction[]>(DEMO_TRANSACTIONS);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoiceAR[]>(DEMO_SALES_INVOICES);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoiceAP[]>(DEMO_PURCHASE_INVOICES);
  const [operatingExpenses, setOperatingExpenses] = useState<OperatingExpense[]>(DEMO_OPERATING_EXPENSES);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(DEMO_INVENTORY_ITEMS);
  const [loans, setLoans] = useState<LoanObligation[]>(DEMO_LOANS);
  const [taxes, setTaxes] = useState<TaxObligation[]>(DEMO_TAXES);
  const [varianceRecords, setVarianceRecords] = useState<VarianceDayRecord[]>(DEMO_VARIANCE_RECORDS);
  const [recommendations, setRecommendations] = useState<ActionableRecommendation[]>(DEMO_RECOMMENDATIONS);

  // Scenario parameters for dynamic stress testing
  const [scenarioParams, setScenarioParams] = useState<Record<ScenarioType, ScenarioParameters>>({
    expected: {
      salesMultiplier: 1.0,
      arCollectionDelayDays: 0,
      expenseMultiplier: 1.0,
      apPaymentGraceDays: 0,
    },
    optimistic: {
      salesMultiplier: 1.15,
      arCollectionDelayDays: -3,
      expenseMultiplier: 0.95,
      apPaymentGraceDays: 3,
    },
    pessimistic: {
      salesMultiplier: 0.85,
      arCollectionDelayDays: 7,
      expenseMultiplier: 1.08,
      apPaymentGraceDays: 0,
    },
  });

  // Modal visibility states
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [aiAdvisoryData, setAiAdvisoryData] = useState<AiAdvisoryResponse | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState<Set<string>>(new Set());

  // Phase 7 Monitoring & Notification States
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMonitoringSettingsOpen, setIsMonitoringSettingsOpen] = useState(false);
  const [monitoringAlertsCount, setMonitoringAlertsCount] = useState(0);
  const [monitoringRecsCount, setMonitoringRecsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const syncMonitoringCounts = useCallback(async () => {
    try {
      const [alertsRes, notifsRes, recsRes] = await Promise.all([
        MonitoringApiClient.getAlerts({ status: 'active' }),
        MonitoringApiClient.getNotifications(),
        MonitoringApiClient.getRecommendations(),
      ]);

      if (alertsRes.success && alertsRes.data) {
        setMonitoringAlertsCount(alertsRes.data.length);
      }
      if (notifsRes.success && notifsRes.data) {
        const unread = notifsRes.data.filter((n) => !n.isRead).length;
        setUnreadNotificationsCount(unread);
      }
      if (recsRes.success && recsRes.data) {
        setMonitoringRecsCount(recsRes.data.length);
      }
    } catch {
      // Ignore background sync errors
    }
  }, []);

  useEffect(() => {
    syncMonitoringCounts();
  }, [syncMonitoringCounts]);

  // 2. Deterministic & Stochastic Forecast Engine Computations
  const engineInput: EngineInputState = useMemo(() => ({
    initialCash: businessProfile.openingCash,
    minimumThreshold: businessProfile.minimumCashReserveThreshold,
    warningThreshold: businessProfile.warningCashReserveThreshold,
    startDate: businessProfile.forecastStartDate,
    horizonDays: businessProfile.forecastHorizonDays,
    salesMonthlyTarget: 1200000,
    cashSalesRatio: 0.55,
    creditSalesRatio: 0.45,
    arInvoices: salesInvoices,
    apInvoices: purchaseInvoices,
    operatingExpenses,
    inventoryItems,
    loans,
    taxes,
    adhocTransactions: transactions,
    scenarioParams,
  }), [
    businessProfile,
    salesInvoices,
    purchaseInvoices,
    operatingExpenses,
    inventoryItems,
    loans,
    taxes,
    transactions,
    scenarioParams,
  ]);

  const dailyExpected = useMemo(() => {
    return generateDailyForecast(engineInput, 'expected');
  }, [engineInput]);

  const dailyOptimistic = useMemo(() => {
    return generateDailyForecast(engineInput, 'optimistic');
  }, [engineInput]);

  const dailyPessimistic = useMemo(() => {
    return generateDailyForecast(engineInput, 'pessimistic');
  }, [engineInput]);

  const activeDailyData = useMemo(() => {
    if (activeScenario === 'optimistic') return dailyOptimistic;
    if (activeScenario === 'pessimistic') return dailyPessimistic;
    return dailyExpected;
  }, [activeScenario, dailyExpected, dailyOptimistic, dailyPessimistic]);

  const weeklySummary = useMemo(() => {
    return aggregateWeeklyForecast(activeDailyData);
  }, [activeDailyData]);

  const runwaySummary = useMemo(() => {
    return calculateCashRunway(
      businessProfile.openingCash,
      activeDailyData,
      businessProfile.minimumCashReserveThreshold,
      businessProfile.warningCashReserveThreshold
    );
  }, [businessProfile.openingCash, activeDailyData, businessProfile.minimumCashReserveThreshold, businessProfile.warningCashReserveThreshold]);

  const cccMetrics = useMemo(() => {
    return calculateCashConversionCycle(inventoryItems, salesInvoices, purchaseInvoices);
  }, [inventoryItems, salesInvoices, purchaseInvoices]);

  const monteCarloResult = useMemo(() => {
    return runMonteCarloSimulation(engineInput, 1000);
  }, [engineInput]);

  const bottlenecks = useMemo(() => {
    return detectBottlenecks(
      activeDailyData,
      businessProfile.minimumCashReserveThreshold,
      businessProfile.warningCashReserveThreshold
    );
  }, [activeDailyData, businessProfile.minimumCashReserveThreshold, businessProfile.warningCashReserveThreshold]);

  const varianceMetrics = useMemo(() => {
    return calculateVarianceMetrics(varianceRecords);
  }, [varianceRecords]);

  // Dynamic Alerts
  const rawAlerts: FinancialAlert[] = useMemo(() => {
    const list: FinancialAlert[] = [];

    // Alert 1: Threshold breach check
    if (runwaySummary.isThresholdBreached) {
      list.push({
        id: 'alert-min-breach',
        type: 'threshold_breach',
        severity: 'critical',
        date: runwaySummary.minimumProjectedDate,
        title: 'Projected Minimum Cash Buffer Breach',
        message: `Projected cash falls to ₹${runwaySummary.minimumProjectedCash.toLocaleString('en-IN')}, below the ₹${businessProfile.minimumCashReserveThreshold.toLocaleString('en-IN')} safety threshold.`,
        projectedBalance: runwaySummary.minimumProjectedCash,
        threshold: businessProfile.minimumCashReserveThreshold,
        recommendationAction: 'Postpone non-critical supplier payouts or arrange ₹100,000 credit line extension before Oct 1.',
        acknowledged: false,
      });
    }

    // Alert 2: High concentration day
    const highOutflowDay = activeDailyData.find((d) => d.totalOutflows >= 120000);
    if (highOutflowDay) {
      list.push({
        id: `alert-outflow-${highOutflowDay.date}`,
        type: 'payment_concentration',
        severity: 'warning',
        date: highOutflowDay.date,
        title: 'Heavy Cash Outflow Concentration',
        message: `Total outflows reach ₹${highOutflowDay.totalOutflows.toLocaleString('en-IN')} on ${highOutflowDay.date} (${highOutflowDay.dayOfWeek}).`,
        projectedBalance: highOutflowDay.endingCash,
        threshold: businessProfile.minimumCashReserveThreshold,
        recommendationAction: 'Stagger vendor payment dates across subsequent billing weeks.',
        acknowledged: false,
      });
    }

    // Alert 3: Tax obligation alert
    const imminentTax = taxes.find((t) => t.dueDate <= '2026-09-25' && t.status !== 'paid');
    if (imminentTax) {
      list.push({
        id: 'alert-tax-imminent',
        type: 'large_outflow',
        severity: 'warning',
        date: imminentTax.dueDate,
        title: `Statutory Tax Payment Due: ${imminentTax.taxType.replace('_', ' ')}`,
        message: `Confirmed tax settlement of ₹${imminentTax.confirmedObligation.toLocaleString('en-IN')} due on ${imminentTax.dueDate}.`,
        projectedBalance: runwaySummary.currentCash,
        threshold: businessProfile.minimumCashReserveThreshold,
        recommendationAction: 'Ensure funds are segregated in primary tax debit account.',
        acknowledged: false,
      });
    }

    return list;
  }, [runwaySummary, activeDailyData, businessProfile.minimumCashReserveThreshold, taxes]);

  const activeAlerts = useMemo(() => {
    return rawAlerts.filter((a) => !acknowledgedAlertIds.has(a.id));
  }, [rawAlerts, acknowledgedAlertIds]);

  const handleAcknowledgeAlert = (id: string) => {
    setAcknowledgedAlertIds((prev) => new Set([...prev, id]));
  };

  // 3. User Action Handlers
  const handleUpdateScenarioParams = (scenario: ScenarioType, params: ScenarioParameters) => {
    setScenarioParams((prev) => ({
      ...prev,
      [scenario]: params,
    }));
  };

  const handleToggleRecommendation = (id: string) => {
    setRecommendations((prev) =>
      prev.map((rec) => {
        if (rec.id === id) {
          const willBeImplemented = !rec.isImplemented;

          // If marking implemented, apply realistic cash improvement
          if (willBeImplemented) {
            if (rec.id === 'rec-1') {
              // Stagger Bharat Agro bill: push half to Oct 12
              setPurchaseInvoices((bills) =>
                bills.map((b) =>
                  b.id === 'ap-1'
                    ? { ...b, scheduledPaymentDate: '2026-10-12', notes: 'Staggered 50% via Playbook' }
                    : b
                )
              );
            } else if (rec.id === 'rec-2') {
              // Accelerate Metro Supermarkets collection by 3 days
              setSalesInvoices((invs) =>
                invs.map((i) =>
                  i.id === 'inv-1'
                    ? { ...i, expectedCollectionDate: '2026-09-25', notes: 'Early NEFT rebate offered' }
                    : i
                )
              );
            }
          }

          return { ...rec, isImplemented: willBeImplemented };
        }
        return rec;
      })
    );
  };

  const handleAddTransaction = (tx: FinancialTransaction) => {
    setTransactions((prev) => [tx, ...prev]);
  };

  const handleAddArInvoice = (inv: SalesInvoiceAR) => {
    setSalesInvoices((prev) => [inv, ...prev]);
  };

  const handleAddApInvoice = (bill: PurchaseInvoiceAP) => {
    setPurchaseInvoices((prev) => [bill, ...prev]);
  };

  const handleAddOpex = (opex: OperatingExpense) => {
    setOperatingExpenses((prev) => [opex, ...prev]);
  };

  const handleUpdateInvoice = (updated: SalesInvoiceAR) => {
    setSalesInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const handleUpdateApInvoice = (updated: PurchaseInvoiceAP) => {
    setPurchaseInvoices((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleResetDemo = () => {
    setBusinessProfile(DEMO_BUSINESS_PROFILE);
    setTransactions(DEMO_TRANSACTIONS);
    setSalesInvoices(DEMO_SALES_INVOICES);
    setPurchaseInvoices(DEMO_PURCHASE_INVOICES);
    setOperatingExpenses(DEMO_OPERATING_EXPENSES);
    setInventoryItems(DEMO_INVENTORY_ITEMS);
    setLoans(DEMO_LOANS);
    setTaxes(DEMO_TAXES);
    setVarianceRecords(DEMO_VARIANCE_RECORDS);
    setRecommendations(DEMO_RECOMMENDATIONS);
    setAcknowledgedAlertIds(new Set());
    setActiveScenario('expected');
    setScenarioParams({
      expected: { salesMultiplier: 1.0, arCollectionDelayDays: 0, expenseMultiplier: 1.0, apPaymentGraceDays: 0 },
      optimistic: { salesMultiplier: 1.15, arCollectionDelayDays: -3, expenseMultiplier: 0.95, apPaymentGraceDays: 3 },
      pessimistic: { salesMultiplier: 0.85, arCollectionDelayDays: 7, expenseMultiplier: 1.08, apPaymentGraceDays: 0 },
    });
  };

  const handleExportCsv = () => {
    exportDailyForecastCsv(activeDailyData, businessProfile.name);
  };

  // AI CFO Analysis trigger
  const runAiAnalysis = useCallback(async (customPrompt?: string) => {
    setIsAiLoading(true);
    const payload = {
      businessName: businessProfile.name,
      initialCash: businessProfile.openingCash,
      minimumThreshold: businessProfile.minimumCashReserveThreshold,
      expectedEndingCash: dailyExpected[dailyExpected.length - 1]?.endingCash,
      optimisticEndingCash: dailyOptimistic[dailyOptimistic.length - 1]?.endingCash,
      pessimisticEndingCash: dailyPessimistic[dailyPessimistic.length - 1]?.endingCash,
      lowestCashPoint: runwaySummary.minimumProjectedCash,
      lowestCashDate: runwaySummary.minimumProjectedDate,
      shortfallProbability: monteCarloResult.shortfallProbabilityPercent,
      ccc: cccMetrics,
      topBottlenecks: bottlenecks.map((b) => ({
        date: b.riskDate,
        title: b.title,
        severity: b.severity,
      })),
      customPrompt,
    };

    const result = await requestAiAdvisory(payload);
    setAiAdvisoryData(result);
    setIsAiLoading(false);
  }, [
    businessProfile,
    dailyExpected,
    dailyOptimistic,
    dailyPessimistic,
    runwaySummary,
    monteCarloResult,
    cccMetrics,
    bottlenecks,
  ]);

  const handleOpenAiAdvisory = () => {
    setIsAiModalOpen(true);
    if (!aiAdvisoryData) {
      runAiAnalysis();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 1. Global Header */}
      <Header
        businessName={businessProfile.name}
        currencySymbol={businessProfile.currencySymbol}
        startDate={businessProfile.forecastStartDate}
        horizonDays={businessProfile.forecastHorizonDays}
        activeScenario={activeScenario}
        onScenarioChange={setActiveScenario}
        onRefresh={() => {
          // Trigger dynamic recalculation tick
          setScenarioParams((prev) => ({ ...prev }));
        }}
        onOpenAiAdvisory={handleOpenAiAdvisory}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onExportCsv={handleExportCsv}
        onResetDemo={handleResetDemo}
        isAiLoading={isAiLoading}
        onOpenLiveVoice={() => setIsLiveVoiceOpen(true)}
        onOpenChat={() => setIsChatbotOpen(true)}
        onOpenGrounding={() => setIsGroundingOpen(true)}
        onOpenTranscription={() => setIsTranscriptionOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenMonitoringSettings={() => setIsMonitoringSettingsOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* 2. Horizontal Navigation Tabs */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertsCount={monitoringAlertsCount || activeAlerts.length}
        deviationsCount={varianceMetrics.materialDeviationsCount}
        recommendationsCount={monitoringRecsCount}
      />

      {/* 3. Main Workspace Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Render View based on Active Tab */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Gemini Multimodal Intelligence Command Hub */}
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 p-4 text-white shadow-md">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <SparklesIcon className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-sm font-bold text-white tracking-tight">
                        Gemini AI Multimodal Intelligence Hub
                      </h2>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        @google/genai
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Real-time bidirectional voice, multi-turn role chat, Google Search & Maps grounding, and speech transcription
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* 1. Live Voice (gemini-3.8-live) */}
                  <button
                    onClick={() => setIsLiveVoiceOpen(true)}
                    className="px-3 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-500/40 text-xs font-semibold text-white flex items-center space-x-2 transition-all shadow-sm cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Live Voice CFO</span>
                    <span className="text-[10px] font-mono opacity-80">(gemini-3.8-live)</span>
                  </button>

                  {/* 2. Multi-turn Chat (gemini-3.5-flash / gemini-3.1-flash-lite / gemini-3.1-pro-preview) */}
                  <button
                    onClick={() => setIsChatbotOpen(true)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 flex items-center space-x-2 transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                    <span>AI Chatbot</span>
                    <span className="text-[10px] font-mono opacity-80">(Multi-Role)</span>
                  </button>

                  {/* 3. Search & Maps Grounding (gemini-3.5-flash) */}
                  <button
                    onClick={() => setIsGroundingOpen(true)}
                    className="px-3 py-2 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-800/60 text-xs font-semibold text-cyan-200 flex items-center space-x-2 transition-all cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Search & Maps Grounding</span>
                  </button>

                  {/* 4. Audio Transcription (gemini-3.5-transcribe) */}
                  <button
                    onClick={() => setIsTranscriptionOpen(true)}
                    className="px-3 py-2 rounded-xl bg-violet-950/70 hover:bg-violet-900/80 border border-violet-800/60 text-xs font-semibold text-violet-200 flex items-center space-x-2 transition-all cursor-pointer"
                  >
                    <FileAudio className="w-3.5 h-3.5 text-violet-400" />
                    <span>Transcribe Audio</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Top Liquidity Alerts if any */}
            <AlertsPanel
              alerts={activeAlerts}
              onAcknowledge={handleAcknowledgeAlert}
              currencySymbol={businessProfile.currencySymbol}
            />

            {/* Core KPI Metrics Cards */}
            <KpiCards
              initialCash={businessProfile.openingCash}
              runway={runwaySummary}
              ccc={cccMetrics}
              shortfallProbability={monteCarloResult.shortfallProbabilityPercent}
              currencySymbol={businessProfile.currencySymbol}
            />

            {/* Trajectory Chart View Selector Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Main Chart View:
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
                  <button
                    onClick={() => setDashboardChartMode('scenario_overlay')}
                    className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer flex items-center ${
                      dashboardChartMode === 'scenario_overlay'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                    Scenario Overlay (Expected vs Opt vs Pess)
                  </button>
                  <button
                    onClick={() => setDashboardChartMode('operational')}
                    className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer flex items-center ${
                      dashboardChartMode === 'operational'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                    Operational Cash Flow
                  </button>
                  <button
                    onClick={() => setDashboardChartMode('dual')}
                    className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer flex items-center ${
                      dashboardChartMode === 'dual'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5 mr-1.5" />
                    Dual View (Both Charts)
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 flex items-center space-x-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Deterministic 30-Day Simulation</span>
              </div>
            </div>

            {/* 1. Secondary Scenario Comparison Overlay Chart */}
            {(dashboardChartMode === 'scenario_overlay' || dashboardChartMode === 'dual') && (
              <ScenarioComparisonChart
                expectedData={dailyExpected}
                optimisticData={dailyOptimistic}
                pessimisticData={dailyPessimistic}
                minimumThreshold={businessProfile.minimumCashReserveThreshold}
                warningThreshold={businessProfile.warningCashReserveThreshold}
                currencySymbol={businessProfile.currencySymbol}
                activeScenario={activeScenario}
                onSelectScenario={setActiveScenario}
                onSwitchToOperationalView={
                  dashboardChartMode === 'scenario_overlay'
                    ? () => setDashboardChartMode('operational')
                    : undefined
                }
              />
            )}

            {/* 2. Primary Operational Cash Trajectory Chart */}
            {(dashboardChartMode === 'operational' || dashboardChartMode === 'dual') && (
              <CashTrajectoryChart
                expectedData={dailyExpected}
                optimisticData={dailyOptimistic}
                pessimisticData={dailyPessimistic}
                minimumThreshold={businessProfile.minimumCashReserveThreshold}
                warningThreshold={businessProfile.warningCashReserveThreshold}
                activeScenario={activeScenario}
                currencySymbol={businessProfile.currencySymbol}
                onSwitchToScenarioOverlay={
                  dashboardChartMode === 'operational'
                    ? () => setDashboardChartMode('scenario_overlay')
                    : undefined
                }
              />
            )}

            {/* Weekly Cash Flow Aggregation */}
            <WeeklyFlowSummary
              weeklyData={weeklySummary}
              currencySymbol={businessProfile.currencySymbol}
            />

            {/* Liquidity Bottlenecks & Trough Identification */}
            <BottlenecksList
              bottlenecks={bottlenecks}
              currencySymbol={businessProfile.currencySymbol}
            />

            {/* Actionable Remedies & Working Capital Playbook */}
            <RecommendationsCards
              recommendations={recommendations}
              onToggleImplemented={handleToggleRecommendation}
              currencySymbol={businessProfile.currencySymbol}
            />
          </div>
        )}

        {activeTab === 'trajectory' && (
          <TrajectoryView
            currencySymbol={businessProfile.currencySymbol}
            minimumThreshold={businessProfile.minimumCashReserveThreshold}
            onExportCsv={handleExportCsv}
          />
        )}

        {activeTab === 'scenarios' && (
          <ScenarioStudioView
            currencySymbol={businessProfile.currencySymbol}
            minimumThreshold={businessProfile.minimumCashReserveThreshold}
          />
        )}

        {activeTab === 'receivables' && (
          <ReceivablesView
            invoices={salesInvoices}
            currentDate={businessProfile.forecastStartDate}
            currencySymbol={businessProfile.currencySymbol}
            onUpdateInvoice={handleUpdateInvoice}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertCenterView
            currencySymbol={businessProfile.currencySymbol}
            onNavigateToTab={(tab) => setActiveTab(tab as TabKey)}
            onRefreshForecast={syncMonitoringCounts}
          />
        )}

        {activeTab === 'recommendations' && (
          <RecommendationsView
            currencySymbol={businessProfile.currencySymbol}
            onNavigateToTab={(tab) => setActiveTab(tab as TabKey)}
          />
        )}

        {activeTab === 'payables' && (
          <PayablesView
            apInvoices={purchaseInvoices}
            operatingExpenses={operatingExpenses}
            currencySymbol={businessProfile.currencySymbol}
            onUpdateApInvoice={handleUpdateApInvoice}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            inventoryItems={inventoryItems}
            currencySymbol={businessProfile.currencySymbol}
          />
        )}

        {activeTab === 'obligations' && (
          <ObligationsView
            loans={loans}
            taxes={taxes}
            currencySymbol={businessProfile.currencySymbol}
          />
        )}

        {activeTab === 'variance' && (
          <VarianceView
            varianceMetrics={varianceMetrics}
            currencySymbol={businessProfile.currencySymbol}
            materialThreshold={50000}
          />
        )}

        {activeTab === 'ingestion' && (
          <IngestionView
            transactions={transactions}
            onAddTransactions={(newTxs) => setTransactions((prev) => [...newTxs, ...prev])}
            currencySymbol={businessProfile.currencySymbol}
          />
        )}
      </main>

      {/* 4. Modals */}
      <AiAdvisoryModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        advisoryData={aiAdvisoryData}
        isLoading={isAiLoading}
        onReanalyze={(customPrompt) => runAiAnalysis(customPrompt)}
      />

      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddTransaction={handleAddTransaction}
        onAddArInvoice={handleAddArInvoice}
        onAddApInvoice={handleAddApInvoice}
        onAddOpex={handleAddOpex}
        currencySymbol={businessProfile.currencySymbol}
      />

      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportTransactions={(newTxs) => setTransactions((prev) => [...newTxs, ...prev])}
      />

      {/* 5. Multimodal & Grounding Gemini Modals */}
      <LiveVoiceModal
        isOpen={isLiveVoiceOpen}
        onClose={() => setIsLiveVoiceOpen(false)}
        businessName={businessProfile.name}
        initialCash={businessProfile.openingCash}
      />

      <GeminiChatbotModal
        isOpen={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
        financialContext={{
          businessName: businessProfile.name,
          currency: businessProfile.currencySymbol,
          initialCash: businessProfile.openingCash,
          minimumThreshold: businessProfile.minimumCashReserveThreshold,
          expectedEndingCash: dailyExpected[dailyExpected.length - 1]?.endingCash,
          pessimisticEndingCash: dailyPessimistic[dailyPessimistic.length - 1]?.endingCash,
          runwayDays: runwaySummary.runwayDaysEstimated,
          shortfallProbability: monteCarloResult.shortfallProbabilityPercent,
        }}
      />

      <GroundingIntelligenceModal
        isOpen={isGroundingOpen}
        onClose={() => setIsGroundingOpen(false)}
        financialContext={{
          businessName: businessProfile.name,
          currency: businessProfile.currencySymbol,
          initialCash: businessProfile.openingCash,
          expectedEndingCash: dailyExpected[dailyExpected.length - 1]?.endingCash,
        }}
      />

      <AudioTranscriptionModal
        isOpen={isTranscriptionOpen}
        onClose={() => setIsTranscriptionOpen(false)}
        onApplyTranscription={(text) => {
          // Add transcribed note as a memo or transaction record
          console.log('Applied voice transcription:', text);
        }}
      />

      {/* 6. Phase 7 Risk Monitoring & Notification Modals */}
      <NotificationCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigateToTab={(tab) => setActiveTab(tab as TabKey)}
        onNotificationsChanged={syncMonitoringCounts}
      />

      <MonitoringSettingsModal
        isOpen={isMonitoringSettingsOpen}
        onClose={() => setIsMonitoringSettingsOpen(false)}
        currencySymbol={businessProfile.currencySymbol}
        onSaved={syncMonitoringCounts}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-slate-800">CashFlow Intelligence</span> • 30-Day Predictive Platform for MSMEs
          </div>
          <div className="flex items-center space-x-4">
            <span>Deterministic Cash Scheduling</span>
            <span>•</span>
            <span>Monte Carlo Simulation</span>
            <span>•</span>
            <span>Gemini AI CFO Intelligence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
