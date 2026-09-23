import React, { useState } from 'react';
import { PurchaseInvoiceAP, OperatingExpense } from '../../types/financial';
import { ArrowUpRight, ShieldAlert, CheckCircle, Tag, Plus } from 'lucide-react';

interface PayablesViewProps {
  apInvoices: PurchaseInvoiceAP[];
  operatingExpenses: OperatingExpense[];
  currencySymbol: string;
  onUpdateApInvoice: (bill: PurchaseInvoiceAP) => void;
  onOpenAddModal: () => void;
}

export const PayablesView: React.FC<PayablesViewProps> = ({
  apInvoices,
  operatingExpenses,
  currencySymbol,
  onUpdateApInvoice,
  onOpenAddModal,
}) => {
  const [activeTab, setActiveTab] = useState<'ap' | 'opex'>('ap');

  const totalAp = apInvoices
    .filter((ap) => ap.status !== 'paid')
    .reduce((sum, ap) => sum + ap.amount, 0);

  const totalMonthlyOpex = operatingExpenses.reduce((sum, op) => sum + op.amount, 0);

  const handleMarkPaid = (bill: PurchaseInvoiceAP) => {
    onUpdateApInvoice({
      ...bill,
      status: 'paid',
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Aggregate Metrics */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
              <ArrowUpRight className="h-4 w-4 mr-1.5 text-rose-600" />
              Accounts Payable (AP) & Operating Expenses (OpEx)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Scheduled supplier commitments, contractual due dates, priority tiers, and recurring fixed/variable overhead.
            </p>
          </div>
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Bill or Expense
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Unpaid Supplier Bills (AP)</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {currencySymbol}
              {totalAp.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {apInvoices.filter((a) => a.status !== 'paid').length} scheduled supplier commitments
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Monthly Operating Expenses</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {currencySymbol}
              {totalMonthlyOpex.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Fixed: ₹
              {operatingExpenses
                .filter((o) => o.type === 'fixed')
                .reduce((s, o) => s + o.amount, 0)
                .toLocaleString('en-IN')}{' '}
              | Variable: ₹
              {operatingExpenses
                .filter((o) => o.type === 'variable')
                .reduce((s, o) => s + o.amount, 0)
                .toLocaleString('en-IN')}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Critical Priority Outflows</span>
            <div className="text-xl font-bold text-rose-700 mt-0.5 flex items-center">
              <ShieldAlert className="h-4 w-4 mr-1.5 text-rose-600" />
              {currencySymbol}
              {apInvoices
                .filter((a) => a.priority === 'critical' && a.status !== 'paid')
                .reduce((s, a) => s + a.amount, 0)
                .toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Essential raw material & vendor supply lines
            </div>
          </div>
        </div>
      </div>

      {/* 2. Tabs Selector: Supplier AP vs Operating Expenses */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex space-x-2 border-b border-slate-100 pb-3 mb-4">
          <button
            onClick={() => setActiveTab('ap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeTab === 'ap'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Supplier Invoices (AP Schedule)
          </button>
          <button
            onClick={() => setActiveTab('opex')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeTab === 'opex'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Operating Expenses (Payroll, Rent, Overhead)
          </button>
        </div>

        {activeTab === 'ap' ? (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">Bill #</th>
                  <th className="px-3 py-2">Supplier Name</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Due Date</th>
                  <th className="px-3 py-2">Scheduled Pay Date</th>
                  <th className="px-3 py-2 text-center">Priority</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apInvoices.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      {bill.billNumber}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      <div>{bill.supplierName}</div>
                      {bill.discountTerms && (
                        <div className="text-[10px] text-emerald-600 font-medium flex items-center mt-0.5">
                          <Tag className="h-3 w-3 mr-1" />
                          {bill.discountTerms.discountPercent}% discount if paid within{' '}
                          {bill.discountTerms.daysBeforeDue}d
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-slate-600">
                      {bill.category.replace('_', ' ')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                      {currencySymbol}
                      {bill.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{bill.dueDate}</td>
                    <td className="px-3 py-2.5 font-medium text-rose-700">
                      {bill.scheduledPaymentDate}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          bill.priority === 'critical'
                            ? 'bg-rose-100 text-rose-800'
                            : bill.priority === 'high'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {bill.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          bill.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {bill.status !== 'paid' && (
                        <button
                          onClick={() => handleMarkPaid(bill)}
                          className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold shadow-xs cursor-pointer"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">Expense Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Frequency</th>
                  <th className="px-3 py-2">Next Due Date</th>
                  <th className="px-3 py-2 text-center">Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operatingExpenses.map((opex) => (
                  <tr key={opex.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      <div>{opex.name}</div>
                      {opex.notes && (
                        <div className="text-[10px] text-slate-500 italic mt-0.5">
                          {opex.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 capitalize font-medium text-slate-700">
                      {opex.type}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-slate-600">
                      {opex.category}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                      {currencySymbol}
                      {opex.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-slate-600">
                      {opex.frequency}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {opex.nextDueDate}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          opex.isMandatory
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {opex.isMandatory ? 'Mandatory' : 'Discretionary'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
