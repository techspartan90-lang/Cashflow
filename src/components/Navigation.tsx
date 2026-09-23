import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  ShieldCheck,
  GitCompare,
  Database,
} from 'lucide-react';

export type TabKey =
  | 'dashboard'
  | 'trajectory'
  | 'receivables'
  | 'payables'
  | 'inventory'
  | 'obligations'
  | 'variance'
  | 'ingestion';

interface NavigationProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  alertsCount?: number;
  deviationsCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  alertsCount = 0,
  deviationsCount = 0,
}) => {
  const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { key: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { key: 'trajectory', label: 'Forecast & Scenarios', icon: TrendingUp },
    { key: 'receivables', label: 'Receivables (AR)', icon: ArrowDownLeft },
    { key: 'payables', label: 'Payables & OpEx', icon: ArrowUpRight },
    { key: 'inventory', label: 'Inventory Planning', icon: Package },
    { key: 'obligations', label: 'Loans & Taxes', icon: ShieldCheck },
    { key: 'variance', label: 'Variance Analysis', icon: GitCompare, badge: deviationsCount },
    { key: 'ingestion', label: 'Data Ingestion', icon: Database },
  ];

  return (
    <nav className="bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon
                  className={`h-4 w-4 mr-2 ${
                    isActive ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span className="ml-2 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
