import React from 'react';
import { InventoryItem } from '../../types/financial';
import { Package, Truck, AlertTriangle, DollarSign, Layers } from 'lucide-react';

interface InventoryViewProps {
  inventoryItems: InventoryItem[];
  currencySymbol: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventoryItems,
  currencySymbol,
}) => {
  const totalInventoryValue = inventoryItems.reduce(
    (sum, item) => sum + item.currentStock * item.unitCost,
    0
  );

  const totalPlannedProcurementOutflows = inventoryItems.reduce(
    (sum, item) => sum + item.plannedPurchaseQuantity * item.unitCost,
    0
  );

  const totalAnnualCarryingCost = inventoryItems.reduce((sum, item) => {
    const val = item.currentStock * item.unitCost;
    return sum + (val * (item.annualCarryingRatePercent || 18)) / 100;
  }, 0);

  return (
    <div className="space-y-6">
      {/* 1. Header with Aggregate Metrics */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
              <Package className="h-4 w-4 mr-1.5 text-indigo-600" />
              Inventory Cash Planning & Working Capital Optimization
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks warehouse inventory values, reorder thresholds, scheduled procurement POs, and carrying cost leakage.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Current Warehouse Stock Value</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {currencySymbol}
              {totalInventoryValue.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {inventoryItems.length} active wholesale inventory SKUs
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Planned 30-Day Procurement Outflows</span>
            <div className="text-xl font-bold text-rose-700 mt-0.5">
              {currencySymbol}
              {totalPlannedProcurementOutflows.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Linked to scheduled purchase order delivery dates
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Annual Estimated Carrying Costs</span>
            <div className="text-xl font-bold text-amber-700 mt-0.5">
              {currencySymbol}
              {Math.round(totalAnnualCarryingCost).toLocaleString('en-IN')}/yr
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Storage, insurance, shrinkage & capital tie-up (~17% avg rate)
            </div>
          </div>
        </div>
      </div>

      {/* 2. Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 mb-4">
          Warehouse Inventory Positions & Planned Reorders
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">SKU & Item Name</th>
                <th className="px-3 py-2 text-right">Unit Cost</th>
                <th className="px-3 py-2 text-center">Stock Level</th>
                <th className="px-3 py-2 text-center">Safety Stock</th>
                <th className="px-3 py-2 text-right">Valuation</th>
                <th className="px-3 py-2">Supplier & Lead Time</th>
                <th className="px-3 py-2 text-right">Planned PO</th>
                <th className="px-3 py-2">PO Payment Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventoryItems.map((item) => {
                const isLowStock = item.currentStock <= item.reorderPoint;
                const poCost = item.plannedPurchaseQuantity * item.unitCost;

                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      <div>{item.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {item.sku}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                      {currencySymbol}
                      {item.unitCost.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="font-bold text-slate-900">{item.currentStock} units</div>
                      {isLowStock && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 mt-0.5">
                          At Reorder ({item.reorderPoint})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600 font-medium">
                      {item.safetyStock} units
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                      {currencySymbol}
                      {(item.currentStock * item.unitCost).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      <div>{item.supplierName}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.supplierLeadTimeDays}d lead time | {item.paymentTermsDays}d terms
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-rose-700">
                      <div>
                        {currencySymbol}
                        {poCost.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        ({item.plannedPurchaseQuantity} units)
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">
                      {item.plannedPurchaseDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
