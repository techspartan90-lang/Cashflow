import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle2, Download } from 'lucide-react';
import { parseUploadedCsv } from '../../services/api-service';
import { FinancialTransaction } from '../../types/financial';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTransactions: (txs: FinancialTransaction[]) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportTransactions,
}) => {
  const [parsedRows, setParsedRows] = useState<Array<Record<string, string>>>([]);
  const [fileName, setFileName] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const rows = parseUploadedCsv(text);
        setParsedRows(rows);
        setStatusMsg(`Parsed ${rows.length} records successfully.`);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirm = () => {
    if (parsedRows.length === 0) return;

    const newTransactions: FinancialTransaction[] = parsedRows.map((r, i) => {
      const txDate = r.date || '2026-09-28';
      const isOutflow = (r.type as any) === 'outflow';
      return {
        id: `imported-${Date.now()}-${i}`,
        businessId: 'biz_prism_ind_001',
        type: isOutflow ? 'outflow' : 'inflow',
        category: isOutflow ? 'supplier_payment' : 'cash_sale',
        amount: parseFloat(r.amount) || 10000,
        currency: 'INR',
        transactionDate: txDate,
        expectedDate: txDate,
        counterparty: r.counterparty || 'Third Party',
        status: 'cleared',
        confidence: 1.0,
        source: 'csv_import',
        notes: r.description || 'Imported Entry',
      };
    });

    onImportTransactions(newTransactions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UploadCloud className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">
              Import Financial CSV Data
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50">
            <UploadCloud className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
            <div className="font-semibold text-slate-700">Select CSV File to Upload</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Columns: date, type, category, amount, description, counterparty
            </p>
            <div className="mt-3">
              <label className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-xs">
                Browse Files
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {statusMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
              <span>
                {statusMsg} ({fileName})
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer shadow-xs"
            >
              Cancel
            </button>
            <button
              disabled={parsedRows.length === 0}
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-xs disabled:opacity-50"
            >
              Import {parsedRows.length} Rows
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
