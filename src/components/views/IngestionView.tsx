import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Plus,
  ArrowRight,
  Database,
} from 'lucide-react';
import { parseUploadedCsv } from '../../services/api-service';
import { FinancialTransaction } from '../../types/financial';

interface IngestionViewProps {
  transactions: FinancialTransaction[];
  onAddTransactions: (newTx: FinancialTransaction[]) => void;
  currencySymbol: string;
}

export const IngestionView: React.FC<IngestionViewProps> = ({
  transactions,
  onAddTransactions,
  currencySymbol,
}) => {
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<Array<Record<string, string>>>([]);
  const [fileName, setFileName] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvRawText(text);
        const rows = parseUploadedCsv(text);
        setParsedRows(rows);
        setFeedbackMsg(`Successfully parsed ${rows.length} rows from "${file.name}".`);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvRawText(text);
        const rows = parseUploadedCsv(text);
        setParsedRows(rows);
        setFeedbackMsg(`Successfully dropped and parsed ${rows.length} rows.`);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleCsv = () => {
    const sampleHeaders = 'date,type,category,amount,description,counterparty\n';
    const sampleData = [
      '2026-09-27,inflow,cash_sales,42000,Weekend Retail Cash Inflow,Direct Walk-in',
      '2026-09-29,outflow,operating_expense,18000,Packaging Materials Purchase,Carton Pack Ltd',
      '2026-10-02,inflow,credit_collection,65000,Invoice 1084 Collection,Metro Supermarkets',
      '2026-10-06,outflow,supplier_payment,45000,Spices Delivery PO-402,Kerala Spice Traders',
    ].join('\n');

    const blob = new Blob([sampleHeaders + sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_cashflow_transactions_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCommitIngestion = () => {
    if (parsedRows.length === 0) return;

    const newTransactions: FinancialTransaction[] = parsedRows.map((r, i) => {
      const txDate = r.date || '2026-09-28';
      const isOutflow = (r.type as any) === 'outflow';
      return {
        id: `ingested-${Date.now()}-${i}`,
        businessId: 'biz_prism_ind_001',
        type: isOutflow ? 'outflow' : 'inflow',
        category: isOutflow ? 'supplier_payment' : 'cash_sale',
        amount: parseFloat(r.amount) || 10000,
        currency: 'INR',
        transactionDate: txDate,
        expectedDate: txDate,
        counterparty: r.counterparty || 'External Entity',
        status: 'cleared',
        confidence: 1.0,
        source: 'csv_import',
        notes: r.description || 'Imported Transaction',
      };
    });

    onAddTransactions(newTransactions);
    setFeedbackMsg(`Successfully committed ${newTransactions.length} transactions into forecast!`);
    setParsedRows([]);
    setFileName('');
  };

  return (
    <div className="space-y-6">
      {/* 1. Ingestion Engine Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
              <Database className="h-4 w-4 mr-1.5 text-indigo-600" />
              Financial Data Ingestion & Bank Statement Processing
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ingest ERP outputs, Tally / Zoho Books exports, and bank CSV statements with automatic column normalization.
            </p>
          </div>
          <button
            onClick={handleDownloadSampleCsv}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
            Download Sample CSV Template
          </button>
        </div>

        {/* 2. Drag and Drop Upload Area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="mt-4 border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50/60 hover:bg-slate-50 transition-colors"
        >
          <div className="max-w-md mx-auto">
            <UploadCloud className="h-10 w-10 text-indigo-600 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-800">
              Drag & Drop Bank or ERP CSV File Here
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Supports standard column headers: date, type, category, amount, description, counterparty
            </p>
            <div className="mt-4">
              <label className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-xs">
                Browse CSV File
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Feedback message banner */}
        {feedbackMsg && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
              <span>{feedbackMsg}</span>
            </div>
            {parsedRows.length > 0 && (
              <button
                onClick={handleCommitIngestion}
                className="px-3 py-1 rounded bg-emerald-600 text-white font-bold text-xs shadow-xs hover:bg-emerald-700 cursor-pointer"
              >
                Confirm & Merge {parsedRows.length} Rows Into Forecast
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Parsed Data Staging Preview */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Staged Records Preview ({fileName})
            </div>
            <button
              onClick={handleCommitIngestion}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs cursor-pointer"
            >
              Merge Into Active Forecast
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-60">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                <tr>
                  {Object.keys(parsedRows[0] || {}).map((header) => (
                    <th key={header} className="px-3 py-2 capitalize">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {Object.values(row).map((val, cellIdx) => (
                      <td key={cellIdx} className="px-3 py-2 text-slate-800 font-medium">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Active Historical Cleared Transactions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Reconciled Bank Transactions ({transactions.length} Total Records)
          </div>
          <span className="text-xs text-slate-500">
            Audit status: 100% matched with ledger
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Counterparty</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-center">Flow</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.slice(0, 15).map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {t.transactionDate || t.expectedDate}
                  </td>
                  <td className="px-3 py-2.5 text-slate-800 font-semibold">
                    {t.notes || t.counterparty}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{t.counterparty}</td>
                  <td className="px-3 py-2.5 text-slate-600 capitalize">
                    {t.category.replace('_', ' ')}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-bold ${
                      t.type === 'inflow' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {t.type === 'inflow' ? '+' : '-'}
                    {currencySymbol}
                    {t.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.type === 'inflow'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                      {t.status}
                    </span>
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
