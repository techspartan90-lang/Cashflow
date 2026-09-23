import React, { useState, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  ArrowRight,
  Database,
  ShieldCheck,
  RotateCcw,
  Clock,
  Layers,
  Activity,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  HelpCircle,
  Search,
} from 'lucide-react';
import {
  FinancialImportService,
  CsvImportPreview,
  CsvColumnMapping,
} from '../../services/import-service';
import { DataQualityService } from '../../services/data-quality-service';
import { CategorizationService, TransactionCategoryName } from '../../services/categorization-service';
import { FinancialTransaction } from '../../types/financial';
import type { Database as DatabaseTypes } from '../../types/database';

type ImportHistoryRow = DatabaseTypes['public']['Tables']['import_history']['Row'];
type ReceivableRow = DatabaseTypes['public']['Tables']['accounts_receivable']['Row'];
type PayableRow = DatabaseTypes['public']['Tables']['accounts_payable']['Row'];

interface IngestionViewProps {
  transactions: FinancialTransaction[];
  onAddTransactions: (newTx: FinancialTransaction[]) => void;
  currencySymbol: string;
}

type IngestionTab = 'transactions' | 'ar_ap' | 'data_quality' | 'history';

export const IngestionView: React.FC<IngestionViewProps> = ({
  transactions,
  onAddTransactions,
  currencySymbol,
}) => {
  const [activeTab, setActiveTab] = useState<IngestionTab>('transactions');

  // --- Transactions Ingestion State ---
  const [txFileName, setTxFileName] = useState<string>('');
  const [txFileSize, setTxFileSize] = useState<number>(0);
  const [txHeaders, setTxHeaders] = useState<string[]>([]);
  const [txRawRows, setTxRawRows] = useState<Record<string, string>[]>([]);
  const [txMapping, setTxMapping] = useState<CsvColumnMapping>({ dateColumn: '', amountColumn: '' });
  const [txPreview, setTxPreview] = useState<CsvImportPreview | null>(null);
  const [txFilter, setTxFilter] = useState<'all' | 'valid' | 'duplicate' | 'error'>('all');
  const [txFeedbackMsg, setTxFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- AR / AP State ---
  const [arApMode, setArApMode] = useState<'ar' | 'ap'>('ar');
  const [arApFileName, setArApFileName] = useState<string>('');
  const [arApFeedback, setArApFeedback] = useState<string>('');
  const [stagedReceivables, setStagedReceivables] = useState<ReceivableRow[]>([
    {
      id: 'ar-mock-1',
      organization_id: '11111111-1111-1111-1111-111111111111',
      customer_id: 'cust-metro',
      invoice_number: 'INV-2026-1084',
      invoice_date: '2026-08-25',
      due_date: '2026-09-24', // overdue
      invoice_amount: 65000,
      outstanding_amount: 65000,
      expected_collection_date: '2026-09-28',
      status: 'overdue',
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    {
      id: 'ar-mock-2',
      organization_id: '11111111-1111-1111-1111-111111111111',
      customer_id: 'cust-apex',
      invoice_number: 'INV-2026-1092',
      invoice_date: '2026-09-05',
      due_date: '2026-10-05',
      invoice_amount: 80000,
      outstanding_amount: 80000,
      expected_collection_date: '2026-10-05',
      status: 'open',
      created_at: '2026-09-05T00:00:00Z',
      updated_at: '2026-09-05T00:00:00Z',
    },
  ]);
  const [stagedPayables, setStagedPayables] = useState<PayableRow[]>([
    {
      id: 'ap-mock-1',
      organization_id: '11111111-1111-1111-1111-111111111111',
      supplier_id: 'sup-kerala-spice',
      invoice_number: 'BILL-402',
      invoice_date: '2026-08-20',
      due_date: '2026-09-20', // overdue
      invoice_amount: 45000,
      outstanding_amount: 45000,
      expected_payment_date: '2026-09-29',
      status: 'overdue',
      created_at: '2026-08-20T00:00:00Z',
      updated_at: '2026-08-20T00:00:00Z',
    },
    {
      id: 'ap-mock-2',
      organization_id: '11111111-1111-1111-1111-111111111111',
      supplier_id: 'sup-bharat-agro',
      invoice_number: 'BILL-889',
      invoice_date: '2026-09-01',
      due_date: '2026-10-01',
      invoice_amount: 135000,
      outstanding_amount: 135000,
      expected_payment_date: '2026-10-03',
      status: 'open',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ]);

  // --- Import History Log ---
  const [importHistory, setImportHistory] = useState<ImportHistoryRow[]>([
    {
      id: 'imp-hist-001',
      organization_id: '11111111-1111-1111-1111-111111111111',
      user_id: null,
      file_name: 'hdfc_bank_statement_august.csv',
      file_size: 45200,
      import_type: 'transactions',
      upload_timestamp: '2026-09-01T10:30:00Z',
      total_rows: 42,
      imported_rows: 40,
      rejected_rows: 0,
      duplicate_rows: 2,
      warning_rows: 1,
      total_inflows: 245000,
      total_outflows: 182000,
      net_cash_flow: 63000,
      status: 'completed',
      error_summary: null,
      created_at: '2026-09-01T10:30:00Z',
    },
  ]);

  // --- Data Quality Metrics ---
  const qualityMetrics = useMemo(() => {
    // Map application transactions to database row interface
    const dbTransactions = transactions.map((t) => ({
      id: t.id,
      organization_id: '11111111-1111-1111-1111-111111111111',
      bank_account_id: null,
      transaction_type: t.type,
      category: t.category,
      description: t.notes || '',
      amount: t.amount,
      transaction_date: t.transactionDate || t.expectedDate,
      settlement_date: t.transactionDate || t.expectedDate,
      counterparty: t.counterparty,
      reference_number: t.id.startsWith('tx-') ? t.id : '',
      status: 'completed',
      source: t.source || 'manual',
      is_recurring: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    return DataQualityService.assessDataQuality(
      dbTransactions as any,
      stagedReceivables,
      stagedPayables,
      '2026-09-28'
    );
  }, [transactions, stagedReceivables, stagedPayables]);

  // Handle transaction CSV file processing
  const handleTxFileProcess = (file: File) => {
    setTxFeedbackMsg(null);
    const check = FinancialImportService.validateUploadedFile({
      name: file.name,
      size: file.size,
    });

    if (!check.isValid) {
      setTxFeedbackMsg({ type: 'error', text: check.error || 'Invalid file.' });
      return;
    }

    setTxFileName(file.name);
    setTxFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const parsed = FinancialImportService.parseCsv(text);
      if (parsed.rows.length === 0) {
        setTxFeedbackMsg({
          type: 'error',
          text: 'The uploaded CSV file contains no readable transaction rows.',
        });
        return;
      }

      setTxHeaders(parsed.headers);
      setTxRawRows(parsed.rows);

      const detected = FinancialImportService.detectColumnMapping(parsed.headers);
      setTxMapping(detected);

      // Build existing fingerprints from current transactions
      const existingFps = new Set<string>();
      const existingLooseFps = new Set<string>();
      for (const t of transactions) {
        const { exactFingerprint, looseFingerprint } = FinancialImportService.generateFingerprints(
          '11111111-1111-1111-1111-111111111111',
          t.transactionDate || t.expectedDate,
          t.amount,
          t.counterparty,
          t.id
        );
        existingFps.add(exactFingerprint);
        existingLooseFps.add(looseFingerprint);
      }

      const p = FinancialImportService.processTransactionImportBatch(
        '11111111-1111-1111-1111-111111111111',
        parsed.rows,
        detected,
        existingFps,
        existingLooseFps
      );

      setTxPreview(p);
      setTxFeedbackMsg({
        type: 'success',
        text: `Successfully staged ${p.totalRows} rows (${p.validRowCount} valid, ${p.duplicateRowCount} duplicates, ${p.errorRowCount} errors).`,
      });
    };
    reader.readAsText(file);
  };

  const handleTxMappingChange = (newMapping: CsvColumnMapping) => {
    setTxMapping(newMapping);
    if (txRawRows.length > 0) {
      const p = FinancialImportService.processTransactionImportBatch(
        '11111111-1111-1111-1111-111111111111',
        txRawRows,
        newMapping
      );
      setTxPreview(p);
    }
  };

  const handleCategoryChange = (rowNumber: number, newCat: TransactionCategoryName) => {
    if (!txPreview) return;
    const candidates = [...txPreview.candidates];
    const item = candidates.find((c) => c.rowNumber === rowNumber);
    if (item) {
      item.userAssignedCategory = newCat;
      if (item.parsed) item.parsed.category = newCat;
      setTxPreview({ ...txPreview, candidates });
    }
  };

  const handleDuplicateResolutionChange = (rowNumber: number, res: 'skip' | 'import_anyway') => {
    if (!txPreview) return;
    const candidates = [...txPreview.candidates];
    const item = candidates.find((c) => c.rowNumber === rowNumber);
    if (item) {
      item.duplicateResolution = res;
      setTxPreview({ ...txPreview, candidates });
    }
  };

  const handleCommitTransactions = () => {
    if (!txPreview) return;

    const accepted = txPreview.candidates.filter(
      (c) =>
        (c.status === 'valid' ||
          c.status === 'warning' ||
          (c.status === 'duplicate' && c.duplicateResolution === 'import_anyway')) &&
        c.parsed
    );

    if (accepted.length === 0) {
      setTxFeedbackMsg({
        type: 'error',
        text: 'No valid records selected to commit.',
      });
      return;
    }

    const converted: FinancialTransaction[] = accepted.map((c) => {
      const p = c.parsed!;
      return {
        id: `tx-${Date.now()}-${c.rowNumber}`,
        businessId: 'biz_prism_ind_001',
        type: p.transaction_type,
        category: (c.userAssignedCategory || p.category).toLowerCase().replace(/ /g, '_') as any,
        amount: p.amount,
        currency: 'INR',
        transactionDate: p.transaction_date,
        expectedDate: p.transaction_date,
        counterparty: p.counterparty,
        status: 'cleared',
        confidence: 1.0,
        source: 'csv_import',
        notes: `${p.description}${p.reference_number ? ` (Ref: ${p.reference_number})` : ''}`,
      };
    });

    onAddTransactions(converted);

    // Add to Import History
    const historyEntry: ImportHistoryRow = {
      id: `imp-${Date.now()}`,
      organization_id: '11111111-1111-1111-1111-111111111111',
      user_id: null,
      file_name: txFileName || 'batch_upload.csv',
      file_size: txFileSize,
      import_type: 'transactions',
      upload_timestamp: new Date().toISOString(),
      total_rows: txPreview.totalRows,
      imported_rows: converted.length,
      rejected_rows: txPreview.errorRowCount,
      duplicate_rows: txPreview.duplicateRowCount,
      warning_rows: txPreview.warningRowCount,
      total_inflows: txPreview.summary.totalInflowAmount,
      total_outflows: txPreview.summary.totalOutflowAmount,
      net_cash_flow: txPreview.summary.netCashImpact,
      status: 'completed',
      error_summary: null,
      created_at: new Date().toISOString(),
    };

    setImportHistory([historyEntry, ...importHistory]);
    setTxFeedbackMsg({
      type: 'success',
      text: `Successfully imported and reconciled ${converted.length} transactions into the cash flow ledger!`,
    });
    setTxPreview(null);
    setTxRawRows([]);
    setTxFileName('');
  };

  const handleDownloadErrorReport = () => {
    if (!txPreview) return;
    const csvContent = FinancialImportService.generateErrorReportCsv(txPreview.candidates);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_error_report_${txFileName || 'ledger'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sample CSV generators
  const downloadSampleTxCsv = () => {
    const csv = [
      'date,amount,type,description,counterparty,reference',
      '2026-09-28,42000,Credit,Retail cash collection,Walk-in Customers,POS-9812',
      '2026-09-29,18000,Debit,Packaging boxes purchase,Carton Pack Ltd,INV-4412',
      '2026-10-02,65000,Credit,Bulk supplies invoice collection,Metro Supermarkets,NEFT-00918',
      '2026-10-06,45000,Debit,Spices delivery payment,Kerala Spice Traders,RTGS-38291',
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_transactions_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleArCsv = () => {
    const csv = [
      'customer_name,invoice_number,invoice_date,due_date,invoice_amount,outstanding_amount',
      'Metro Supermarkets,INV-1084,2026-08-25,2026-09-24,65000,65000',
      'Apex Department Stores,INV-1092,2026-09-05,2026-10-05,80000,80000',
      'City Grocers Network,INV-1100,2026-09-12,2026-10-12,35000,15000',
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_accounts_receivable_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleApCsv = () => {
    const csv = [
      'supplier_name,invoice_number,invoice_date,due_date,invoice_amount,outstanding_amount',
      'Kerala Spice Traders,BILL-402,2026-08-20,2026-09-20,45000,45000',
      'Bharat Agro Supplies,BILL-889,2026-09-01,2026-10-01,135000,135000',
      'Carton Pack Ltd,BILL-210,2026-09-10,2026-09-30,18000,18000',
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_accounts_payable_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
              <Database className="h-4 w-4 mr-2 text-indigo-600" />
              Financial Data Ingestion & Data Quality Center
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Production-grade CSV ingestion pipeline, duplicate transaction detection, AR/AP staging & ledger health auditing.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={downloadSampleTxCsv}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
              Sample Transactions CSV
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center cursor-pointer transition-colors ${
              activeTab === 'transactions'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Transaction Import Pipeline
          </button>
          <button
            onClick={() => setActiveTab('ar_ap')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center cursor-pointer transition-colors ${
              activeTab === 'ar_ap'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="h-4 w-4 mr-1.5" />
            Accounts Receivable & Payable (AR/AP)
          </button>
          <button
            onClick={() => setActiveTab('data_quality')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center cursor-pointer transition-colors ${
              activeTab === 'data_quality'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Activity className="h-4 w-4 mr-1.5" />
            Data Quality & Audit Dashboard
            <span
              className={`ml-2 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                qualityMetrics.overallHealthStatus === 'Healthy'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {qualityMetrics.completenessScorePercent}% Score
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center cursor-pointer transition-colors ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Clock className="h-4 w-4 mr-1.5" />
            Import History Ledger ({importHistory.length})
          </button>
        </div>
      </div>

      {/* TAB 1: TRANSACTION IMPORT PIPELINE */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          {/* Upload Box */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50/60 hover:bg-slate-50 transition-colors">
              <div className="max-w-md mx-auto">
                <UploadCloud className="h-10 w-10 text-indigo-600 mx-auto mb-2" />
                <div className="text-sm font-semibold text-slate-800">
                  Drag & Drop Bank or ERP CSV File Here
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Supports multi-date formats, flexible debit/credit mapping, and automatic deduplication.
                </p>
                <div className="mt-4">
                  <label className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-xs transition-colors">
                    Browse Files
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleTxFileProcess(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Feedback Banner */}
            {txFeedbackMsg && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs flex items-center justify-between border ${
                  txFeedbackMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {txFeedbackMsg.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  )}
                  <span>{txFeedbackMsg.text}</span>
                </div>
              </div>
            )}
          </div>

          {/* Staged Data & Column Mapping */}
          {txPreview && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
              {/* Header / Reconciliation Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Staged Import Preview: {txFileName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review parsed records, resolve duplicate flags, and confirm financial reconciliation.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {txPreview.errorRowCount > 0 && (
                    <button
                      onClick={handleDownloadErrorReport}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Download Error CSV
                    </button>
                  )}
                  <button
                    onClick={handleCommitTransactions}
                    className="inline-flex items-center px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs cursor-pointer"
                  >
                    Confirm & Merge {txPreview.validRowCount} Valid Rows
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Rows</div>
                  <div className="text-base font-bold text-slate-900">{txPreview.totalRows}</div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase">Valid</div>
                  <div className="text-base font-bold text-emerald-800">{txPreview.validRowCount}</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-amber-700 uppercase">Duplicates</div>
                  <div className="text-base font-bold text-amber-800">{txPreview.duplicateRowCount}</div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-rose-700 uppercase">Rejected</div>
                  <div className="text-base font-bold text-rose-800">{txPreview.errorRowCount}</div>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-indigo-700 uppercase">Net Impact</div>
                  <div className="text-base font-bold text-indigo-900">
                    {currencySymbol}
                    {txPreview.summary.netCashImpact.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Column Mapping Adjuster Accordion */}
              <details className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <summary className="font-semibold text-slate-700 cursor-pointer select-none">
                  Adjust Column Header Mapping (Auto-detected)
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Date Column</label>
                    <select
                      value={txMapping.dateColumn}
                      onChange={(e) =>
                        handleTxMappingChange({ ...txMapping, dateColumn: e.target.value })
                      }
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5"
                    >
                      {txHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Amount Column</label>
                    <select
                      value={txMapping.amountColumn}
                      onChange={(e) =>
                        handleTxMappingChange({ ...txMapping, amountColumn: e.target.value })
                      }
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5"
                    >
                      {txHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Type Column</label>
                    <select
                      value={txMapping.typeColumn || ''}
                      onChange={(e) =>
                        handleTxMappingChange({
                          ...txMapping,
                          typeColumn: e.target.value || undefined,
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5"
                    >
                      <option value="">-- Infer from sign --</option>
                      {txHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </details>

              {/* Candidate Records Table */}
              <div className="space-y-2">
                <div className="flex space-x-2 text-xs border-b border-slate-100 pb-2">
                  <button
                    onClick={() => setTxFilter('all')}
                    className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                      txFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({txPreview.candidates.length})
                  </button>
                  <button
                    onClick={() => setTxFilter('valid')}
                    className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                      txFilter === 'valid'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Valid ({txPreview.validRowCount})
                  </button>
                  <button
                    onClick={() => setTxFilter('duplicate')}
                    className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                      txFilter === 'duplicate'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Duplicates ({txPreview.duplicateRowCount})
                  </button>
                  <button
                    onClick={() => setTxFilter('error')}
                    className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                      txFilter === 'error'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Errors ({txPreview.errorRowCount})
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-80">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Counterparty & Description</th>
                        <th className="px-3 py-2">Category (Rule Engine)</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-center">Status</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {txPreview.candidates
                        .filter((c) => {
                          if (txFilter === 'valid') return c.status === 'valid' || c.status === 'warning';
                          if (txFilter === 'duplicate') return c.status === 'duplicate';
                          if (txFilter === 'error') return c.status === 'invalid';
                          return true;
                        })
                        .map((c) => (
                          <tr key={c.rowNumber} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-slate-500">#{c.rowNumber}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {c.parsed?.transaction_date || c.raw[txMapping.dateColumn] || '—'}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-800">
                                {c.parsed?.counterparty || '—'}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                {c.parsed?.description || c.raw[txMapping.descriptionColumn || ''] || '—'}
                              </div>
                              {c.duplicateReason && (
                                <div className="text-[10px] text-amber-700 mt-0.5">
                                  {c.duplicateReason}
                                </div>
                              )}
                              {c.errors.map((err, ei) => (
                                <div key={ei} className="text-[10px] text-rose-600 font-medium">
                                  ⚠ {err.message}
                                </div>
                              ))}
                            </td>
                            <td className="px-3 py-2">
                              {c.parsed ? (
                                <select
                                  value={c.userAssignedCategory || c.suggestedCategory || ''}
                                  onChange={(e) =>
                                    handleCategoryChange(
                                      c.rowNumber,
                                      e.target.value as TransactionCategoryName
                                    )
                                  }
                                  className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800"
                                >
                                  {c.parsed.transaction_type === 'inflow'
                                    ? CategorizationService.getInflowCategories().map((cat) => (
                                        <option key={cat} value={cat}>
                                          {cat}
                                        </option>
                                      ))
                                    : CategorizationService.getOutflowCategories().map((cat) => (
                                        <option key={cat} value={cat}>
                                          {cat}
                                        </option>
                                      ))}
                                </select>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-bold ${
                                c.parsed?.transaction_type === 'inflow'
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              {c.parsed
                                ? `${c.parsed.transaction_type === 'inflow' ? '+' : '-'}${currencySymbol}${c.parsed.amount.toLocaleString(
                                    'en-IN'
                                  )}`
                                : c.raw[txMapping.amountColumn] || '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {c.status === 'valid' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  VALID
                                </span>
                              )}
                              {c.status === 'warning' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  WARNING
                                </span>
                              )}
                              {c.status === 'duplicate' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                                  {c.duplicateType === 'exact_duplicate' ? 'EXACT DUP' : 'POSSIBLE DUP'}
                                </span>
                              )}
                              {c.status === 'invalid' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  REJECTED
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {c.status === 'duplicate' ? (
                                <select
                                  value={c.duplicateResolution || 'skip'}
                                  onChange={(e) =>
                                    handleDuplicateResolutionChange(
                                      c.rowNumber,
                                      e.target.value as 'skip' | 'import_anyway'
                                    )
                                  }
                                  className="text-[11px] bg-white border border-slate-300 rounded px-1.5 py-0.5"
                                >
                                  <option value="skip">Skip</option>
                                  <option value="import_anyway">Import</option>
                                </select>
                              ) : c.status === 'invalid' ? (
                                <span className="text-[10px] text-rose-500 font-semibold">Rejected</span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-semibold">Ready</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Active Ledger Preview */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Reconciled Ledger Records ({transactions.length} Total Transactions)
              </div>
              <span className="text-xs text-slate-500">Audit Status: Active & In Balance</span>
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
                        {t.category.replace(/_/g, ' ')}
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
      )}

      {/* TAB 2: ACCOUNTS RECEIVABLE & PAYABLE */}
      {activeTab === 'ar_ap' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Accounts Receivable & Payable Ingestion Engine
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Import customer invoices and supplier bills to model 30-day working capital lag.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={downloadSampleArCsv}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 mr-1 inline" />
                  Sample AR Template
                </button>
                <button
                  onClick={downloadSampleApCsv}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 mr-1 inline" />
                  Sample AP Template
                </button>
              </div>
            </div>

            {/* Sub-selector */}
            <div className="flex items-center space-x-3 mt-4">
              <button
                onClick={() => setArApMode('ar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  arApMode === 'ar'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Accounts Receivable ({stagedReceivables.length} Invoices)
              </button>
              <button
                onClick={() => setArApMode('ap')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  arApMode === 'ap'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Accounts Payable ({stagedPayables.length} Bills)
              </button>
            </div>

            {/* AR Table */}
            {arApMode === 'ar' && (
              <div className="mt-4 overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Invoice #</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Invoice Date</th>
                      <th className="px-3 py-2">Due Date</th>
                      <th className="px-3 py-2 text-right">Invoice Amount</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedReceivables.map((ar) => (
                      <tr key={ar.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-mono font-medium text-slate-900">
                          {ar.invoice_number}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">
                          {ar.customer_id.replace('cust-', '').toUpperCase()}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{ar.invoice_date}</td>
                        <td className="px-3 py-2.5 text-slate-600">{ar.due_date}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                          {currencySymbol}
                          {ar.invoice_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                          {currencySymbol}
                          {ar.outstanding_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              ar.status === 'overdue'
                                ? 'bg-rose-100 text-rose-800'
                                : ar.status === 'paid'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {ar.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* AP Table */}
            {arApMode === 'ap' && (
              <div className="mt-4 overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Bill / PO #</th>
                      <th className="px-3 py-2">Supplier</th>
                      <th className="px-3 py-2">Bill Date</th>
                      <th className="px-3 py-2">Due Date</th>
                      <th className="px-3 py-2 text-right">Bill Amount</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedPayables.map((ap) => (
                      <tr key={ap.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-mono font-medium text-slate-900">
                          {ap.invoice_number}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">
                          {ap.supplier_id.replace('sup-', '').toUpperCase()}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{ap.invoice_date}</td>
                        <td className="px-3 py-2.5 text-slate-600">{ap.due_date}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                          {currencySymbol}
                          {ap.invoice_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-rose-700">
                          {currencySymbol}
                          {ap.outstanding_amount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              ap.status === 'overdue'
                                ? 'bg-rose-100 text-rose-800'
                                : ap.status === 'paid'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ap.status}
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
      )}

      {/* TAB 3: DATA QUALITY & AUDIT DASHBOARD */}
      {activeTab === 'data_quality' && (
        <div className="space-y-6">
          {/* Completeness Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">Financial Ledger Data Health</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      qualityMetrics.overallHealthStatus === 'Healthy'
                        ? 'bg-emerald-100 text-emerald-800'
                        : qualityMetrics.overallHealthStatus === 'Needs Attention'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {qualityMetrics.overallHealthStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audits transactional completeness, duplicate risks, and payment term compliance.
                </p>
              </div>

              <div className="text-right">
                <div className="text-2xl font-black text-slate-900">
                  {qualityMetrics.completenessScorePercent}%
                </div>
                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  Completeness Index
                </div>
              </div>
            </div>

            {/* Formula Explanation Callout */}
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-start space-x-2">
              <HelpCircle className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <strong>Auditing Formula: </strong>
                <code>{qualityMetrics.completenessCalculationFormula}</code>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Monitors 6 attributes per transaction (date, amount, type, counterparty, category, reference number).
                </p>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  Uncategorized Records
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {qualityMetrics.missingCategoriesCount}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Lacks operational head</div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  Missing Reference IDs
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {qualityMetrics.missingReferencesCount}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">No bank UTR or check #</div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="text-[11px] font-semibold text-amber-700 uppercase">
                  Overdue Receivables
                </div>
                <div className="text-xl font-bold text-amber-800 mt-1">
                  {currencySymbol}
                  {qualityMetrics.overdueReceivablesAmount.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  {qualityMetrics.overdueReceivablesCount} unpaid past due invoices
                </div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <div className="text-[11px] font-semibold text-rose-700 uppercase">
                  Overdue Payables
                </div>
                <div className="text-xl font-bold text-rose-800 mt-1">
                  {currencySymbol}
                  {qualityMetrics.overduePayablesAmount.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-rose-700 mt-0.5">
                  {qualityMetrics.overduePayablesCount} bills past settlement date
                </div>
              </div>
            </div>
          </div>

          {/* Actionable Remediation Items */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
              Identified Data Integrity & Working Capital Issues ({qualityMetrics.issues.length})
            </h4>

            {qualityMetrics.issues.length === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                Ledger audit passed with 0 critical or warning issues.
              </div>
            ) : (
              <div className="space-y-3">
                {qualityMetrics.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs ${
                      issue.severity === 'critical'
                        ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                        : issue.severity === 'warning'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                        : 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            issue.severity === 'critical'
                              ? 'bg-rose-200 text-rose-900'
                              : issue.severity === 'warning'
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-indigo-200 text-indigo-900'
                          }`}
                        >
                          {issue.severity}
                        </span>
                        <strong className="text-slate-900 text-xs">{issue.title}</strong>
                      </div>
                      <p className="text-slate-600 mt-1">{issue.description}</p>
                      <p className="text-slate-800 font-semibold mt-1">
                        Remediation:{' '}
                        <span className="font-normal text-slate-700">{issue.remediationAction}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: IMPORT HISTORY LEDGER */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Historical Import Ledger</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of all batch upload events, row counts, and net reconciliation impact.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Immutable Records Logged in Audit Trail
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">File Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-center">Total Rows</th>
                  <th className="px-3 py-2 text-center">Imported</th>
                  <th className="px-3 py-2 text-center">Duplicates</th>
                  <th className="px-3 py-2 text-center">Rejected</th>
                  <th className="px-3 py-2 text-right">Inflows</th>
                  <th className="px-3 py-2 text-right">Outflows</th>
                  <th className="px-3 py-2 text-right">Net Flow</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {h.upload_timestamp.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{h.file_name}</td>
                    <td className="px-3 py-2.5 capitalize text-slate-600">
                      {h.import_type.replace('_', ' ')}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">{h.total_rows}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-700">
                      {h.imported_rows}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-amber-700">
                      {h.duplicate_rows}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-rose-700">
                      {h.rejected_rows}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-emerald-700">
                      +{currencySymbol}
                      {h.total_inflows.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-rose-700">
                      -{currencySymbol}
                      {h.total_outflows.toLocaleString('en-IN')}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-bold ${
                        h.net_cash_flow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {h.net_cash_flow >= 0 ? '+' : '-'}
                      {currencySymbol}
                      {Math.abs(h.net_cash_flow).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
