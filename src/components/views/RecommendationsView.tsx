import React, { useState, useEffect } from 'react';
import {
  Lightbulb,
  ArrowRight,
  Sliders,
  AlertCircle,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  FileText,
  Shield,
  RefreshCw,
} from 'lucide-react';
import type { RecommendationRow } from '../../services/recommendation-engine';
import { MonitoringApiClient } from '../../services/monitoring-api';

interface RecommendationsViewProps {
  currencySymbol: string;
  onNavigateToTab?: (tab: string) => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  currencySymbol,
  onNavigateToTab,
}) => {
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUrgency, setFilterUrgency] = useState<string>('all');

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await MonitoringApiClient.getRecommendations();
      if (res.success && res.data) {
        setRecommendations(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const filtered = recommendations.filter((r) => {
    if (filterUrgency === 'all') return true;
    return r.urgency === filterUrgency;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
              <Lightbulb className="h-4 w-4 mr-1.5 text-amber-500" />
              Evidence-Based Financial Action Plays & Recommendations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tactical decision plays derived deterministically from overdue accounts, upcoming disbursements, and shortfall forecasts.
            </p>
          </div>
          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Plays
          </button>
        </div>

        {/* Disclaimer Banner */}
        <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start space-x-2 text-xs text-slate-600">
          <Shield className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-semibold text-slate-700">Governance & Advisory Notice:</span> All recommendations are operational review suggestions generated deterministically from recorded ledger data. The system never executes automatic disbursements, credit drawings, or modifications without explicit human approval.
          </p>
        </div>
      </div>

      {/* 2. Filter Pills */}
      <div className="flex items-center space-x-2">
        <span className="text-xs font-semibold text-slate-500">Urgency:</span>
        {['all', 'critical', 'high', 'medium', 'low'].map((u) => (
          <button
            key={u}
            onClick={() => setFilterUrgency(u)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg capitalize transition-colors cursor-pointer ${
              filterUrgency === u
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {u}
          </button>
        ))}
      </div>

      {/* 3. Recommendations Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto text-amber-500 mb-2" />
            Synthesizing factual evidence and cash flow constraints...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <div className="font-semibold text-slate-700 text-sm">No Immediate Action Plays Needed</div>
            <p className="mt-1 text-slate-500">
              No material deviations, severe overdue balances, or critical reserve breaches detected for current filters.
            </p>
          </div>
        ) : (
          filtered.map((rec) => {
            let urgencyColor = 'bg-slate-100 text-slate-700 border-slate-200';
            if (rec.urgency === 'critical') urgencyColor = 'bg-rose-100 text-rose-800 border-rose-200';
            else if (rec.urgency === 'high') urgencyColor = 'bg-amber-100 text-amber-800 border-amber-200';
            else if (rec.urgency === 'medium') urgencyColor = 'bg-sky-100 text-sky-800 border-sky-200';

            return (
              <div
                key={rec.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${urgencyColor}`}>
                      {rec.urgency} Urgency
                    </span>
                    <span className="text-xs text-slate-400 capitalize">
                      {rec.recommendation_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {rec.projected_impact_amount && (
                    <div className="text-xs font-semibold text-slate-700">
                      Working Capital Impact: <span className="font-bold text-emerald-700 font-mono">+{currencySymbol}{rec.projected_impact_amount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{rec.title}</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{rec.rationale}</p>
                </div>

                {/* Evidence Badges */}
                {rec.evidence_data && Object.keys(rec.evidence_data).length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center">
                      <FileText className="h-3 w-3 mr-1" /> Verified Financial Evidence Base
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {Object.entries(rec.evidence_data)
                        .filter(([k]) => k !== 'disclaimer')
                        .map(([key, val]) => (
                          <div key={key} className="bg-white p-2 rounded border border-slate-200">
                            <span className="text-[10px] text-slate-400 uppercase block truncate">
                              {key.replace(/_/g, ' ')}
                            </span>
                            <span className="font-semibold text-slate-800 font-mono text-[11px] truncate block">
                              {typeof val === 'number'
                                ? key.includes('amount') || key.includes('deficit')
                                  ? `${currencySymbol}${val.toLocaleString('en-IN')}`
                                  : val
                                : String(val)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Action CTAs */}
                <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100">
                  {rec.recommendation_type.includes('scenario') || rec.recommendation_type.includes('delay') ? (
                    <button
                      onClick={() => onNavigateToTab && onNavigateToTab('scenarios')}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
                    >
                      <Sliders className="h-3.5 w-3.5 mr-1.5" />
                      Simulate Impact in Scenario Studio
                    </button>
                  ) : rec.recommendation_type.includes('receivable') ? (
                    <button
                      onClick={() => onNavigateToTab && onNavigateToTab('receivables')}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
                    >
                      Review Overdue Accounts (AR)
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </button>
                  ) : rec.recommendation_type.includes('outflow') ? (
                    <button
                      onClick={() => onNavigateToTab && onNavigateToTab('payables')}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
                    >
                      Inspect Payables & Vendor Terms
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onNavigateToTab && onNavigateToTab('variance')}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      View Variance Calibration Log
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
