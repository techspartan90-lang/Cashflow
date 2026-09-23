import React, { useState } from 'react';
import { SalesInvoiceAR, AgingBucket } from '../../types/financial';
import { ArrowDownLeft, Clock, AlertTriangle, CheckCircle, Plus } from 'lucide-react';
import { calculateArAging } from '../../lib/financial-engine';

interface ReceivablesViewProps {
  invoices: SalesInvoiceAR[];
  currentDate: string;
  currencySymbol: string;
  onUpdateInvoice: (invoice: SalesInvoiceAR) => void;
  onOpenAddModal: () => void;
}

export const ReceivablesView: React.FC<ReceivablesViewProps> = ({
  invoices,
  currentDate,
  currencySymbol,
  onUpdateInvoice,
  onOpenAddModal,
}) => {
  const [filterBucket, setFilterBucket] = useState<string>('all');
  const arAging = calculateArAging(invoices, currentDate);

  const bucketsList: Array<{ key: AgingBucket; label: string; desc: string }> = [
    { key: 'current', label: 'Current', desc: 'Not yet due' },
    { key: '1-30', label: '1 - 30 Days', desc: 'Slight delay' },
    { key: '31-60', label: '31 - 60 Days', desc: 'Moderate risk' },
    { key: '61-90', label: '61 - 90 Days', desc: 'High risk' },
    { key: '90+', label: '90+ Days', desc: 'Critical / Bad debt' },
  ];

  const filteredInvoices = invoices.filter((inv) => {
    if (filterBucket === 'all') return true;
    return inv.agingBucket === filterBucket;
  });

  const handleMarkCollected = (inv: SalesInvoiceAR) => {
    onUpdateInvoice({
      ...inv,
      status: 'collected',
      paidAmount: inv.amount,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Aggregate Metrics */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
              <ArrowDownLeft className="h-4 w-4 mr-1.5 text-emerald-600" />
              Accounts Receivable (AR) & Collection Timing Schedule
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks customer payment terms, historical delays, aging buckets, and expected cash inflow dates.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Customer Invoice
            </button>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Total Outstanding AR</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {currencySymbol}
              {arAging.totalOutstanding.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Across {invoices.filter((i) => i.status !== 'collected').length} active invoices
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Weighted Average Payment Delay</span>
            <div className="text-xl font-bold text-amber-700 mt-0.5 flex items-center">
              <Clock className="h-4 w-4 mr-1 text-amber-600" />
              {arAging.weightedAvgDelayDays} Days
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Formula: ∑(Amount × Delay) / ∑(Amount)
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Expected 30-Day Collections</span>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">
              {currencySymbol}
              {invoices
                .filter((i) => i.status !== 'collected')
                .reduce((sum, i) => sum + (i.amount - i.paidAmount) * i.collectionProbability, 0)
                .toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Probability-weighted expected cash
            </div>
          </div>
        </div>
      </div>

      {/* 2. Aging Buckets Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {bucketsList.map((b) => {
          const bucketData = arAging.buckets[b.key];
          const isSelected = filterBucket === b.key;

          return (
            <button
              key={b.key}
              onClick={() => setFilterBucket(isSelected ? 'all' : b.key)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-semibold text-slate-800">{b.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 font-bold">
                  {bucketData.count} inv
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {currencySymbol}
                {bucketData.totalAmount.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{b.desc}</div>
            </button>
          );
        })}
      </div>

      {/* 3. Invoices Detailed Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Scheduled Invoices & Expected Collection Windows
          </div>
          {filterBucket !== 'all' && (
            <button
              onClick={() => setFilterBucket('all')}
              className="text-xs text-indigo-600 font-semibold cursor-pointer"
            >
              Clear Filter (Show All)
            </button>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">Invoice #</th>
                <th className="px-3 py-2">Customer Name</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Due Date</th>
                <th className="px-3 py-2">Expected Date</th>
                <th className="px-3 py-2 text-center">Probability</th>
                <th className="px-3 py-2 text-center">Aging Bucket</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-semibold text-indigo-700">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    <div>{inv.customerName}</div>
                    {inv.notes && (
                      <div className="text-[10px] text-slate-500 italic mt-0.5">
                        {inv.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                    {currencySymbol}
                    {inv.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{inv.dueDate}</td>
                  <td className="px-3 py-2.5 font-medium text-emerald-700">
                    {inv.expectedCollectionDate}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800">
                      {Math.round(inv.collectionProbability * 100)}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        inv.agingBucket === 'current'
                          ? 'bg-slate-100 text-slate-700'
                          : inv.agingBucket === '1-30'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {inv.agingBucket}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        inv.status === 'collected'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {inv.status !== 'collected' && (
                      <button
                        onClick={() => handleMarkCollected(inv)}
                        className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold shadow-xs cursor-pointer"
                      >
                        Mark Collected
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
