import React from 'react';
import {
  Lightbulb,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { ActionableRecommendation } from '../../types/financial';

interface RecommendationsCardsProps {
  recommendations: ActionableRecommendation[];
  onToggleImplemented: (id: string) => void;
  currencySymbol: string;
}

export const RecommendationsCards: React.FC<RecommendationsCardsProps> = ({
  recommendations,
  onToggleImplemented,
  currencySymbol,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
            <Lightbulb className="h-4 w-4 mr-1.5 text-amber-500" />
            Actionable Financial Remedies & Working Capital Optimization
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Prescriptive tactical levers with quantifiable financial impact to protect liquidity and eliminate deficits.
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          Rule-Based + AI Verified
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.map((rec) => {
          const isUrgent = rec.priority === 'urgent';
          const isHigh = rec.priority === 'high';

          return (
            <div
              key={rec.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                rec.isImplemented
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : isUrgent
                  ? 'bg-white border-rose-300 shadow-xs ring-1 ring-rose-100'
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isUrgent
                          ? 'bg-rose-100 text-rose-800'
                          : isHigh
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {rec.priority}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 capitalize">
                      {rec.category}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-500">Est. Liquidity Impact</span>
                    <div className="text-xs font-bold text-emerald-600">
                      +{currencySymbol}
                      {rec.financialImpact.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <h3 className="font-bold text-xs text-slate-900 mb-1.5 leading-snug">
                  {rec.title}
                </h3>
                <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                  {rec.rationale}
                </p>

                {/* Steps checklist */}
                <div className="space-y-1.5 mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Execution Steps:
                  </div>
                  {rec.actionableSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start text-[11px] text-slate-700"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2 shrink-0 mt-1.5"></span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Implement toggle button */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 flex items-center">
                  <Sparkles className="h-3 w-3 mr-1 text-indigo-500" />
                  Confidence: {Math.round(rec.confidenceLevel * 100)}%
                </span>

                <button
                  onClick={() => onToggleImplemented(rec.id)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    rec.isImplemented
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs'
                  }`}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  {rec.isImplemented ? 'Action Implemented' : 'Mark Implemented'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
