import React from 'react';
import {
  Flame,
  AlertOctagon,
  Calendar,
  Building,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';
import { BottleneckItem } from '../../types/financial';

interface BottlenecksListProps {
  bottlenecks: BottleneckItem[];
  currencySymbol: string;
}

export const BottlenecksList: React.FC<BottlenecksListProps> = ({
  bottlenecks,
  currencySymbol,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
            <Flame className="h-4 w-4 mr-1.5 text-rose-500" />
            Identified Cash-Flow Bottlenecks & Troughs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dates where outflow concentration or collection delay induces acute liquidity pressure.
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          {bottlenecks.length} Key Pressure Dates
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {bottlenecks.map((item) => {
          const isCritical = item.severity === 'critical';
          const isHigh = item.severity === 'high';

          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                isCritical
                  ? 'border-rose-200 bg-rose-50/40'
                  : isHigh
                  ? 'border-amber-200 bg-amber-50/30'
                  : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center text-xs font-bold text-slate-800">
                    <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" />
                    {item.riskDate}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                      isCritical
                        ? 'bg-rose-100 text-rose-800'
                        : isHigh
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>

                <h3 className="font-bold text-xs text-slate-900 mb-1 leading-snug">
                  {item.title}
                </h3>
                <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                  {item.description}
                </p>

                {/* Contributing entities tags */}
                {item.contributingEntities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.contributingEntities.map((ent, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[10px] font-medium"
                      >
                        {ent}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200/60 mt-auto text-[11px]">
                <div className="font-semibold text-slate-800 flex items-start">
                  <ArrowRight className="h-3 w-3 mr-1 text-indigo-600 shrink-0 mt-0.5" />
                  <span>{item.suggestedAction}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
