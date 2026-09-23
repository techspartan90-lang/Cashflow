import React, { useState } from 'react';
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Download,
  ArrowRight,
  ArrowLeft,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  FinancialImportService,
  CsvImportPreview,
  CsvColumnMapping,
  sanitizeCsvCell,
} from '../../services/import-service';
import { CategorizationService, TransactionCategoryName } from '../../services/categorization-service';
import { FinancialTransaction } from '../../types/financial';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTransactions: (txs: FinancialTransaction[]) => void;
  currencySymbol?: string;
}

type ImportStep = 'upload' | 'mapping' | 'review' | 'success';

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportTransactions,
  currencySymbol = '₹',
}) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [csvRawText, setCsvRawText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);

  // Staged data & mapping
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<CsvColumnMapping>({ dateColumn: '', amountColumn: '' });
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);

  // Active filter tab in review step
  const [reviewFilter, setReviewFilter] = useState<'all' | 'valid' | 'duplicate' | 'error'>('all');

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setFileSize(0);
    setCsvRawText('');
    setFileError(null);
    setHeaders([]);
    setRawRows([]);
    setPreview(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processFile = (file: File) => {
    setFileError(null);
    const check = FinancialImportService.validateUploadedFile({
      name: file.name,
      size: file.size,
    });

    if (!check.isValid) {
      setFileError(check.error || 'Invalid file');
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      setCsvRawText(text);

      const parsed = FinancialImportService.parseCsv(text);
      if (parsed.rows.length === 0) {
        setFileError('The uploaded CSV contains no records or empty headers.');
        return;
      }

      setHeaders(parsed.headers);
      setRawRows(parsed.rows);

      const detected = FinancialImportService.detectColumnMapping(parsed.headers);
      setMapping(detected);

      // Generate preview
      const previewData = FinancialImportService.processTransactionImportBatch(
        '11111111-1111-1111-1111-111111111111',
        parsed.rows,
        detected
      );
      setPreview(previewData);
      setStep('mapping');
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleRecomputePreview = (newMapping: CsvColumnMapping) => {
    setMapping(newMapping);
    if (rawRows.length > 0) {
      const p = FinancialImportService.processTransactionImportBatch(
        '11111111-1111-1111-1111-111111111111',
        rawRows,
        newMapping
      );
      setPreview(p);
    }
  };

  const handleCategoryChange = (rowIndex: number, newCat: TransactionCategoryName) => {
    if (!preview) return;
    const updatedCandidates = [...preview.candidates];
    const candidate = updatedCandidates.find((c) => c.rowNumber === rowIndex);
    if (candidate) {
      candidate.userAssignedCategory = newCat;
      if (candidate.parsed) {
        candidate.parsed.category = newCat;
      }
      setPreview({ ...preview, candidates: updatedCandidates });
    }
  };

  const handleDuplicateResolutionChange = (rowIndex: number, res: 'skip' | 'import_anyway') => {
    if (!preview) return;
    const updatedCandidates = [...preview.candidates];
    const candidate = updatedCandidates.find((c) => c.rowNumber === rowIndex);
    if (candidate) {
      candidate.duplicateResolution = res;
      setPreview({ ...preview, candidates: updatedCandidates });
    }
  };

  const handleDownloadErrorReport = () => {
    if (!preview) return;
    const csvContent = FinancialImportService.generateErrorReportCsv(preview.candidates);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_errors_${fileName || 'batch'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmImport = async () => {
    if (!preview) return;

    // Filter accepted candidates
    const accepted = preview.candidates.filter(
      (c) =>
        (c.status === 'valid' || c.status === 'warning' || (c.status === 'duplicate' && c.duplicateResolution === 'import_anyway')) &&
        c.parsed
    );

    const convertedTxs: FinancialTransaction[] = accepted.map((c) => {
      const p = c.parsed!;
      return {
        id: `tx-imported-${Date.now()}-${c.rowNumber}`,
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

    onImportTransactions(convertedTxs);
    setStep('success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Financial Data Ingestion & Import Center
              </h3>
              <p className="text-xs text-slate-500">
                Audited ingestion pipeline with column normalization, deduplication & category mapping.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-6">
            <span
              className={`flex items-center font-medium ${
                step === 'upload' ? 'text-indigo-600 font-bold' : 'text-slate-600'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-700 mr-1.5 text-[11px] font-bold">
                1
              </span>
              Upload CSV
            </span>
            <span
              className={`flex items-center font-medium ${
                step === 'mapping' ? 'text-indigo-600 font-bold' : 'text-slate-600'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-200 text-slate-700 mr-1.5 text-[11px] font-bold">
                2
              </span>
              Column Mapping
            </span>
            <span
              className={`flex items-center font-medium ${
                step === 'review' ? 'text-indigo-600 font-bold' : 'text-slate-600'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-200 text-slate-700 mr-1.5 text-[11px] font-bold">
                3
              </span>
              Validation & Review
            </span>
            <span
              className={`flex items-center font-medium ${
                step === 'success' ? 'text-emerald-600 font-bold' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-200 text-slate-700 mr-1.5 text-[11px] font-bold">
                4
              </span>
              Completed
            </span>
          </div>
          {fileName && (
            <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
              File: <strong className="text-slate-700">{fileName}</strong>
            </span>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center bg-slate-50/70 hover:bg-slate-50 transition-colors"
              >
                <div className="max-w-md mx-auto">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-600">
                    <FileSpreadsheet className="h-7 w-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Upload Bank Statement or ERP Export (.csv)
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Drag & drop files here or browse. Max file size: 10 MB.
                  </p>
                  <div className="mt-4">
                    <label className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-xs transition-colors">
                      Select CSV File
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

              {fileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 text-rose-600 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Sample Format Guidance
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <p>• Accepted date formats: <code>YYYY-MM-DD</code>, <code>DD/MM/YYYY</code>, <code>DD-MM-YYYY</code>.</p>
                  <p>• Monetary amounts: Numbers without currency symbols, or standard commas.</p>
                  <p>• Inflows/Outflows: Indicated by positive/negative signs or Type columns (<code>CR / DR</code>).</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-5">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Configure Column Header Mapping</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm or adjust which CSV columns correspond to required financial ledger fields.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date Column <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={mapping.dateColumn}
                    onChange={(e) =>
                      handleRecomputePreview({ ...mapping, dateColumn: e.target.value })
                    }
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount Column <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={mapping.amountColumn}
                    onChange={(e) =>
                      handleRecomputePreview({ ...mapping, amountColumn: e.target.value })
                    }
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transaction Type (Credit / Debit / Inflow / Outflow)
                  </label>
                  <select
                    value={mapping.typeColumn || ''}
                    onChange={(e) =>
                      handleRecomputePreview({ ...mapping, typeColumn: e.target.value || undefined })
                    }
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                  >
                    <option value="">-- None (Infer from amount sign) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description / Narration
                  </label>
                  <select
                    value={mapping.descriptionColumn || ''}
                    onChange={(e) =>
                      handleRecomputePreview({
                        ...mapping,
                        descriptionColumn: e.target.value || undefined,
                      })
                    }
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Counterparty / Payee / Customer
                  </label>
                  <select
                    value={mapping.counterpartyColumn || ''}
                    onChange={(e) =>
                      handleRecomputePreview({
                        ...mapping,
                        counterpartyColumn: e.target.value || undefined,
                      })
                    }
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reference Number / UTR / Check #
                  </label>
                  <select
                    value={mapping.referenceColumn || ''}
                    onChange={(e) =>
                      handleRecomputePreview({
                        ...mapping,
                        referenceColumn: e.target.value || undefined,
                      })
                    }
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                  >
                    <option value="">-- None / Auto-detect --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {preview && (
                <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-indigo-900 font-medium">
                    <ShieldCheck className="h-4 w-4 text-indigo-600" />
                    <span>
                      Mapping verified: <strong>{preview.validRowCount}</strong> valid,{' '}
                      <strong>{preview.duplicateRowCount}</strong> duplicates,{' '}
                      <strong>{preview.errorRowCount}</strong> errors out of {preview.totalRows} rows.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: REVIEW & DUPLICATE RESOLUTION */}
          {step === 'review' && preview && (
            <div className="space-y-4">
              {/* Summary Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Rows</div>
                  <div className="text-lg font-bold text-slate-900">{preview.totalRows}</div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase">Valid Records</div>
                  <div className="text-lg font-bold text-emerald-800">{preview.validRowCount}</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-amber-700 uppercase">Duplicates</div>
                  <div className="text-lg font-bold text-amber-800">{preview.duplicateRowCount}</div>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <div className="text-[11px] font-semibold text-indigo-700 uppercase">Net Cash Impact</div>
                  <div className="text-lg font-bold text-indigo-900">
                    {currencySymbol}
                    {preview.summary.netCashImpact.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex space-x-2 text-xs">
                  <button
                    onClick={() => setReviewFilter('all')}
                    className={`px-3 py-1 rounded-lg font-medium cursor-pointer ${
                      reviewFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({preview.candidates.length})
                  </button>
                  <button
                    onClick={() => setReviewFilter('valid')}
                    className={`px-3 py-1 rounded-lg font-medium cursor-pointer ${
                      reviewFilter === 'valid'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Valid ({preview.validRowCount})
                  </button>
                  <button
                    onClick={() => setReviewFilter('duplicate')}
                    className={`px-3 py-1 rounded-lg font-medium cursor-pointer ${
                      reviewFilter === 'duplicate'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Duplicates ({preview.duplicateRowCount})
                  </button>
                  <button
                    onClick={() => setReviewFilter('error')}
                    className={`px-3 py-1 rounded-lg font-medium cursor-pointer ${
                      reviewFilter === 'error'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Errors ({preview.errorRowCount})
                  </button>
                </div>

                {preview.errorRowCount > 0 && (
                  <button
                    onClick={handleDownloadErrorReport}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download Error CSV Report
                  </button>
                )}
              </div>

              {/* Table of Candidates */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72">
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
                    {preview.candidates
                      .filter((c) => {
                        if (reviewFilter === 'valid') return c.status === 'valid' || c.status === 'warning';
                        if (reviewFilter === 'duplicate') return c.status === 'duplicate';
                        if (reviewFilter === 'error') return c.status === 'invalid';
                        return true;
                      })
                      .map((c) => (
                        <tr key={c.rowNumber} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2 font-mono text-slate-500">#{c.rowNumber}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {c.parsed?.transaction_date || c.raw[mapping.dateColumn] || '—'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-800">
                              {c.parsed?.counterparty || '—'}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">
                              {c.parsed?.description || c.raw[mapping.descriptionColumn || ''] || '—'}
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
                                  handleCategoryChange(c.rowNumber, e.target.value as TransactionCategoryName)
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
                              : c.raw[mapping.amountColumn] || '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {c.status === 'valid' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                VALID
                              </span>
                            )}
                            {c.status === 'warning' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                WARNING
                              </span>
                            )}
                            {c.status === 'duplicate' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                                {c.duplicateType === 'exact_duplicate' ? 'EXACT DUP' : 'POSSIBLE DUP'}
                              </span>
                            )}
                            {c.status === 'invalid' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                INVALID
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
                                <option value="import_anyway">Import Anyway</option>
                              </select>
                            ) : c.status === 'invalid' ? (
                              <span className="text-[10px] text-rose-500 font-semibold">Rejected</span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-semibold">Staged</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                Financial Transactions Ingested Successfully!
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Validated records have been committed into the financial ledger and integrated into the 30-day forecast engine.
              </p>
              <div className="pt-4">
                <button
                  onClick={handleClose}
                  className="px-5 py-2 bg-slate-900 text-white font-semibold text-xs rounded-xl hover:bg-slate-800 shadow-xs cursor-pointer"
                >
                  Done & Close Modal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {step !== 'success' && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            {step === 'upload' ? (
              <div className="text-xs text-slate-500">
                CSV files are processed locally before staging.
              </div>
            ) : (
              <button
                onClick={() => setStep(step === 'review' ? 'mapping' : 'upload')}
                className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back
              </button>
            )}

            <div className="flex items-center space-x-2">
              {step === 'mapping' && (
                <button
                  onClick={() => setStep('review')}
                  disabled={!mapping.dateColumn || !mapping.amountColumn}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  Proceed to Review
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </button>
              )}

              {step === 'review' && (
                <button
                  onClick={handleConfirmImport}
                  className="inline-flex items-center px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer"
                >
                  Confirm & Commit Import ({preview?.validRowCount} Rows)
                  <CheckCircle2 className="h-3.5 w-3.5 ml-1.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
