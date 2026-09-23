import React from 'react';
import {
  Sparkles,
  RefreshCw,
  Download,
  PlusCircle,
  UploadCloud,
  RotateCcw,
  Calendar,
  Building2,
  TrendingUp,
  Bell,
  SlidersHorizontal,
  Database as DatabaseIcon,
} from 'lucide-react';
import { ScenarioType } from '../types/financial';

interface HeaderProps {
  businessName: string;
  currencySymbol: string;
  startDate: string;
  horizonDays: number;
  activeScenario: ScenarioType;
  onScenarioChange: (scenario: ScenarioType) => void;
  onRefresh: () => void;
  onOpenAiAdvisory: () => void;
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onExportCsv: () => void;
  onResetDemo: () => void;
  isAiLoading: boolean;
  databaseStats?: any;
  onRefreshDatabase?: () => void;
  onOpenLiveVoice?: () => void;
  onOpenChat?: () => void;
  onOpenGrounding?: () => void;
  onOpenTranscription?: () => void;
  onOpenNotifications?: () => void;
  onOpenMonitoringSettings?: () => void;
  unreadNotificationsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  businessName,
  currencySymbol,
  startDate,
  horizonDays,
  activeScenario,
  onScenarioChange,
  onRefresh,
  onOpenAiAdvisory,
  onOpenAddModal,
  onOpenImportModal,
  onExportCsv,
  onResetDemo,
  isAiLoading,
  databaseStats,
  onRefreshDatabase,
  onOpenLiveVoice,
  onOpenChat,
  onOpenGrounding,
  onOpenTranscription,
  onOpenNotifications,
  onOpenMonitoringSettings,
  unreadNotificationsCount = 0,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3.5 gap-3">
          {/* Logo & Business Selector */}
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold shadow-xs">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  CashFlow Intelligence
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  30-Day Engine
                </span>
                <span
                  className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                  title={`Database: ${databaseStats?.engine || 'SQLite (Node.js 22 node:sqlite)'} (${databaseStats?.totalRows || 0} rows stored)`}
                >
                  <DatabaseIcon className="w-3 h-3 text-indigo-600" />
                  <span>DB: Connected</span>
                  <span className="text-[10px] text-indigo-700 font-mono font-semibold bg-indigo-100/70 px-1 rounded">
                    {databaseStats?.totalRows ? `${databaseStats.totalRows} records` : 'SQLite'}
                  </span>
                </span>
              </div>
              <div className="flex items-center text-xs text-slate-500 space-x-3 mt-0.5">
                <span className="flex items-center font-medium text-slate-700">
                  <Building2 className="h-3.5 w-3.5 mr-1 text-slate-400" />
                  {businessName}
                </span>
                <span>•</span>
                <span className="flex items-center">
                  <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
                  {startDate} (+{horizonDays}d)
                </span>
                <span>•</span>
                <span className="font-semibold text-slate-600">
                  Currency: {currencySymbol} (INR)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Controls & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Scenario Selector Pills */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium">
              {(['expected', 'optimistic', 'pessimistic'] as ScenarioType[]).map((sc) => (
                <button
                  key={sc}
                  onClick={() => onScenarioChange(sc)}
                  className={`px-2.5 py-1.5 rounded-md capitalize transition-colors ${
                    activeScenario === sc
                      ? sc === 'optimistic'
                        ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                        : sc === 'pessimistic'
                        ? 'bg-rose-600 text-white font-semibold shadow-xs'
                        : 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sc}
                </button>
              ))}
            </div>

            {/* Live API Voice CFO Button */}
            {onOpenLiveVoice && (
              <button
                onClick={onOpenLiveVoice}
                title="Live bidirectional voice conversation (gemini-3.8-live)"
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 shadow-xs transition-colors cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                Live Voice
              </button>
            )}

            {/* Multi-turn Chat Button */}
            {onOpenChat && (
              <button
                onClick={onOpenChat}
                title="Multi-turn Gemini Chat with custom system instructions (gemini-3.5-flash / gemini-3.1-flash-lite / gemini-3.1-pro-preview)"
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-indigo-300" />
                AI Chat
              </button>
            )}

            {/* Grounding Intelligence Button */}
            {onOpenGrounding && (
              <button
                onClick={onOpenGrounding}
                title="Search and Maps Grounding with gemini-3.5-flash"
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-cyan-800 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors shadow-xs cursor-pointer"
              >
                Grounding
              </button>
            )}

            {/* Audio Transcription Button */}
            {onOpenTranscription && (
              <button
                onClick={onOpenTranscription}
                title="Transcribe voice memos with gemini-3.5-transcribe"
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-violet-800 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors shadow-xs cursor-pointer"
              >
                Voice Memo
              </button>
            )}

            {/* AI Deep Advisory Button */}
            <button
              onClick={onOpenAiAdvisory}
              disabled={isAiLoading}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-indigo-200" />
              {isAiLoading ? 'Synthesizing...' : 'CFO Advisory'}
            </button>

            {/* Ingestion & Entry */}
            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1 text-slate-500" />
              Add
            </button>

            <button
              onClick={onOpenImportModal}
              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <UploadCloud className="h-3.5 w-3.5 mr-1 text-slate-500" />
              Import
            </button>

            {/* Export */}
            <button
              onClick={onExportCsv}
              title="Download 30-Day Forecast CSV"
              className="inline-flex items-center p-1.5 rounded-lg text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="h-4 w-4" />
            </button>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              title="Recalculate deterministic forecast"
              className="inline-flex items-center p-1.5 rounded-lg text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              title="Financial Notifications"
              className="relative inline-flex items-center p-1.5 rounded-lg text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <Bell className="h-4 w-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full text-[9px] font-bold bg-rose-600 text-white min-w-[16px] text-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Monitoring Settings */}
            <button
              onClick={onOpenMonitoringSettings}
              title="Risk & Monitoring Threshold Configuration"
              className="inline-flex items-center p-1.5 rounded-lg text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            {/* Reset Demo */}
            <button
              onClick={onResetDemo}
              title="Restore default benchmark demo data"
              className="inline-flex items-center p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

