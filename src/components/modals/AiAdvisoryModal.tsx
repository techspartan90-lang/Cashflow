import React, { useState } from 'react';
import {
  Sparkles,
  X,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { AiAdvisoryResponse } from '../../services/api-service';

interface AiAdvisoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  advisoryData: AiAdvisoryResponse | null;
  isLoading: boolean;
  onReanalyze: (customPrompt?: string) => void;
}

export const AiAdvisoryModal: React.FC<AiAdvisoryModalProps> = ({
  isOpen,
  onClose,
  advisoryData,
  isLoading,
  onReanalyze,
}) => {
  const [customQuestion, setCustomQuestion] = useState('');

  if (!isOpen) return null;

  const analysis = advisoryData?.analysis;

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;
    onReanalyze(customQuestion);
    setCustomQuestion('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base tracking-tight text-white">
                  Gemini CFO Liquidity Intelligence
                </h3>
                {analysis?.liquidityHealthGrade && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Grade {analysis.liquidityHealthGrade}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-factor contextual analysis of daily cash trajectories and working capital vulnerabilities.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {isLoading ? (
            <div className="py-16 text-center">
              <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-3" />
              <div className="font-bold text-slate-800 text-sm">
                Generating Comprehensive CFO Liquidity Assessment...
              </div>
              <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                Synthesizing 30-day cash commitments, receivables probabilities, debt covenants, and Monte Carlo risk simulations.
              </p>
            </div>
          ) : analysis ? (
            <>
              {/* Executive Summary */}
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <div className="font-bold text-indigo-950 uppercase tracking-wider text-[11px] mb-1.5 flex items-center">
                  <ShieldCheck className="h-4 w-4 mr-1.5 text-indigo-600" />
                  Executive Liquidity Assessment
                </div>
                <p className="text-slate-700 leading-relaxed text-xs">
                  {analysis.executiveSummary}
                </p>
              </div>

              {/* Critical Observation */}
              <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-100">
                <div className="font-bold text-rose-950 uppercase tracking-wider text-[11px] mb-1.5 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1.5 text-rose-600" />
                  Primary Vulnerability Window
                </div>
                <p className="text-rose-900 leading-relaxed text-xs">
                  {analysis.criticalObservation}
                </p>
              </div>

              {/* Tactical Plays */}
              <div>
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-3 flex items-center">
                  <Lightbulb className="h-4 w-4 mr-1.5 text-amber-500" />
                  High-Priority Tactical Playbook
                </div>

                <div className="space-y-3">
                  {analysis.tacticalPlays?.map((play, index) => (
                    <div
                      key={index}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-900 text-xs">
                          {play.title}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {play.expectedImpact}
                        </span>
                      </div>
                      <div className="text-[11px] text-indigo-600 font-semibold mb-1">
                        Target Window: {play.targetWindow}
                      </div>
                      <p className="text-slate-600 leading-relaxed text-xs">
                        {play.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stress Scenario Diagnosis */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1.5">
                  Downside Stress Scenario Diagnosis
                </div>
                <p className="text-slate-700 leading-relaxed text-xs">
                  {analysis.stressScenarioDiagnosis}
                </p>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-500">
              No analysis data available. Click re-analyze below.
            </div>
          )}

          {/* Ask Custom Financial Question */}
          <form onSubmit={handleAskQuestion} className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ask AI CFO a specific question about your 30-day forecast:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="e.g., How can I improve my Cash Conversion Cycle by 10 days?"
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
              >
                Ask CFO
              </button>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => onReanalyze()}
            disabled={isLoading}
            className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh Intelligence Synthesis
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
