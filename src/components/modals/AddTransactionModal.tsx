import React, { useState } from 'react';
import { X, PlusCircle } from 'lucide-react';
import {
  FinancialTransaction,
  SalesInvoiceAR,
  PurchaseInvoiceAP,
  OperatingExpense,
} from '../../types/financial';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: FinancialTransaction) => void;
  onAddArInvoice: (inv: SalesInvoiceAR) => void;
  onAddApInvoice: (bill: PurchaseInvoiceAP) => void;
  onAddOpex: (opex: OperatingExpense) => void;
  currencySymbol: string;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
  onAddArInvoice,
  onAddApInvoice,
  onAddOpex,
  currencySymbol,
}) => {
  const [entryType, setEntryType] = useState<
    'cash_sale' | 'ar_invoice' | 'ap_bill' | 'operating_expense'
  >('cash_sale');

  const [date, setDate] = useState('2026-09-28');
  const [amount, setAmount] = useState('25000');
  const [counterparty, setCounterparty] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('2026-10-05');
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'discretionary'>('high');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 0;
    const nowId = `custom-${Date.now()}`;

    if (entryType === 'cash_sale') {
      onAddTransaction({
        id: nowId,
        businessId: 'biz_prism_ind_001',
        type: 'inflow',
        category: 'cash_sale',
        amount: numAmount,
        currency: 'INR',
        transactionDate: date,
        expectedDate: date,
        counterparty: counterparty || 'Walk-in Retail Buyer',
        status: 'cleared',
        confidence: 1.0,
        source: 'manual',
        notes: description || 'Direct Cash Sale',
      });
    } else if (entryType === 'ar_invoice') {
      onAddArInvoice({
        id: nowId,
        customerId: 'cust_adhoc',
        invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: counterparty || 'Custom Wholesale Buyer',
        issueDate: date,
        dueDate,
        expectedCollectionDate: dueDate,
        amount: numAmount,
        paidAmount: 0,
        status: 'outstanding',
        agingBucket: 'current',
        paymentTermsDays: 15,
        historicalAvgDelayDays: 2,
        collectionProbability: 0.95,
        notes: description || 'New Wholesale Invoice',
      });
    } else if (entryType === 'ap_bill') {
      onAddApInvoice({
        id: nowId,
        supplierId: 'sup_adhoc',
        billNumber: `BILL-${Math.floor(1000 + Math.random() * 9000)}`,
        supplierName: counterparty || 'Raw Materials Vendor',
        category: 'raw_materials',
        amount: numAmount,
        billDate: date,
        dueDate,
        scheduledPaymentDate: dueDate,
        status: 'scheduled',
        priority,
      });
    } else if (entryType === 'operating_expense') {
      onAddOpex({
        id: nowId,
        name: description || 'Operations Overhead',
        type: 'fixed',
        category: 'rent',
        amount: numAmount,
        frequency: 'monthly',
        nextDueDate: dueDate,
        isMandatory: true,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PlusCircle className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">
              Add Financial Record to 30-Day Engine
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Entry Type Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Record Classification
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'cash_sale', label: 'Cash Inflow (Sales)' },
                { key: 'ar_invoice', label: 'Credit Invoice (AR)' },
                { key: 'ap_bill', label: 'Supplier Bill (AP)' },
                { key: 'operating_expense', label: 'Operating Expense' },
              ].map((t) => (
                <button
                  type="button"
                  key={t.key}
                  onClick={() => setEntryType(t.key as any)}
                  className={`p-2 rounded-lg border text-left font-medium cursor-pointer transition-colors ${
                    entryType === t.key
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Amount ({currencySymbol})
              </label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Effective / Issue Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Counterparty & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Counterparty (Customer / Vendor)
              </label>
              <input
                type="text"
                placeholder="e.g., Royal Mart or Bharat Agro"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Settlement / Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Description & Priority */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Description / Notes
            </label>
            <input
              type="text"
              placeholder="e.g., Bulk grain supply invoice 4092"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {entryType === 'ap_bill' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Payment Priority Tier
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="critical">Critical (Supplier halts deliveries if late)</option>
                <option value="high">High (Standard contractual vendor)</option>
                <option value="medium">Medium (Grace period available)</option>
                <option value="discretionary">Discretionary (Can defer safely)</option>
              </select>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-xs"
            >
              Save & Recalculate 30-Day Forecast
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
