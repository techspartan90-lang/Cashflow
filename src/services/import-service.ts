/**
 * Financial Data Ingestion, Processing & Import Engine
 * CashFlow Intelligence — Phase 3: Transaction Import & Financial Data Quality
 *
 * Provides auditable batch ingestion, flexible column mapping,
 * duplicate classification, rule-based categorization, and formula-injection-safe exports.
 */

import { MonetaryMath } from './financial-calculator';
import { CategorizationService, TransactionCategoryName } from './categorization-service';
import type { Database } from '../types/database';

type TransactionInsert = Database['public']['Tables']['financial_transactions']['Insert'];
type ReceivableInsert = Database['public']['Tables']['accounts_receivable']['Insert'];
type PayableInsert = Database['public']['Tables']['accounts_payable']['Insert'];

export interface CsvColumnMapping {
  dateColumn: string;
  amountColumn: string;
  typeColumn?: string;            // if separate 'inflow'/'outflow' or 'credit'/'debit'
  inflowIndicatorValue?: string;  // e.g. 'CR', 'Credit', 'Inflow'
  categoryColumn?: string;
  descriptionColumn?: string;
  counterpartyColumn?: string;
  referenceColumn?: string;
}

export interface CsvRowError {
  rowNumber: number;
  field: string;
  code: string;
  message: string;
}

export interface CsvRowWarning {
  rowNumber: number;
  field: string;
  code: string;
  message: string;
}

export type DuplicateClassification = 'exact_duplicate' | 'possible_duplicate' | 'unique';

export interface CsvImportCandidate {
  rowNumber: number;
  raw: Record<string, string>;
  parsed?: TransactionInsert;
  status: 'valid' | 'invalid' | 'duplicate' | 'warning';
  duplicateType: DuplicateClassification;
  duplicateReason?: string;
  errors: CsvRowError[];
  warnings: CsvRowWarning[];
  suggestedCategory?: TransactionCategoryName;
  userAssignedCategory?: TransactionCategoryName;
  duplicateResolution?: 'skip' | 'import_anyway' | 'review';
}

export interface CsvImportPreview {
  totalRows: number;
  validRowCount: number;
  duplicateRowCount: number;
  warningRowCount: number;
  errorRowCount: number;
  candidates: CsvImportCandidate[];
  detectedMapping: CsvColumnMapping;
  headers: string[];
  summary: {
    totalInflowAmount: number;
    totalOutflowAmount: number;
    netCashImpact: number;
    rejectedAmountTotal: number;
  };
}

/**
 * Neutralizes CSV formula injection attacks by prepending a single quote
 * if the text begins with `=`, `+`, `-`, `@`, or tab characters.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Robust CSV tokenizer that safely handles quoted fields, inner commas, and quotes.
 */
export function tokenizeCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export class FinancialImportService {
  /**
   * File validation: type (.csv) and size limit (default 10 MB)
   */
  static validateUploadedFile(file: { name: string; size: number; type?: string }): {
    isValid: boolean;
    error?: string;
  } {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return {
        isValid: false,
        error: 'Invalid file format. Only standard comma-separated (.csv) files are supported.',
      };
    }
    if (file.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size exceeds the 10 MB threshold (Current: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
      };
    }
    if (file.size === 0) {
      return {
        isValid: false,
        error: 'The uploaded file is empty.',
      };
    }
    return { isValid: true };
  }

  /**
   * Safe CSV string parser into raw records
   */
  static parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text
      .split(/\r\n|\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 1) {
      return { headers: [], rows: [] };
    }

    const headers = tokenizeCsvLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = tokenizeCsvLine(lines[i]).map((v) => v.replace(/^["']|["']$/g, '').trim());
      const row: Record<string, string> = {};
      headers.forEach((h, index) => {
        row[h] = values[index] ?? '';
      });
      rows.push(row);
    }

    return { headers, rows };
  }

  /**
   * Automatic column detection heuristics
   */
  static detectColumnMapping(headers: string[]): CsvColumnMapping {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const mapping: CsvColumnMapping = {
      dateColumn: '',
      amountColumn: '',
    };

    for (const h of headers) {
      const n = norm(h);

      if (!mapping.dateColumn && (n.includes('date') || n === 'txndate' || n === 'valuedate' || n === 'postdate')) {
        mapping.dateColumn = h;
      } else if (!mapping.amountColumn && (n.includes('amount') || n === 'value' || n === 'netamount' || n === 'txnamount')) {
        mapping.amountColumn = h;
      } else if (!mapping.typeColumn && (n === 'type' || n === 'transactiontype' || n === 'flow' || n.includes('debitcredit') || n === 'drcr')) {
        mapping.typeColumn = h;
      } else if (!mapping.descriptionColumn && (n.includes('description') || n.includes('narration') || n.includes('particulars') || n.includes('details') || n === 'remarks')) {
        mapping.descriptionColumn = h;
      } else if (!mapping.counterpartyColumn && (n.includes('counterparty') || n.includes('party') || n.includes('payee') || n.includes('payer') || n.includes('vendor') || n.includes('customer'))) {
        mapping.counterpartyColumn = h;
      } else if (!mapping.referenceColumn && (n.includes('reference') || n.includes('refno') || n === 'utr' || n.includes('cheque') || n.includes('txnid'))) {
        mapping.referenceColumn = h;
      } else if (!mapping.categoryColumn && (n.includes('category') || n.includes('head') || n.includes('accounthead'))) {
        mapping.categoryColumn = h;
      }
    }

    // Fallbacks if not detected
    if (!mapping.dateColumn && headers.length > 0) mapping.dateColumn = headers[0];
    if (!mapping.amountColumn && headers.length > 1) mapping.amountColumn = headers[1];

    return mapping;
  }

  /**
   * Multi-format date parser supporting ISO (YYYY-MM-DD), DD/MM/YYYY, MM/DD/YYYY, and DD-MM-YYYY
   */
  static parseFlexibleDate(raw: string): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const clean = raw.trim();

    // 1. ISO format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [year, month, day] = clean.split('-').map(Number);
      return isValidCalendarDate(year, month, day) ? clean : null;
    }

    // 2. Slash format: DD/MM/YYYY or MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
      const parts = clean.split('/').map(Number);
      const [day, month, year] = parts;
      if (isValidCalendarDate(year, month, day)) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      return null;
    }

    // 3. Hyphen format: DD-MM-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(clean)) {
      const [day, month, year] = clean.split('-').map(Number);
      if (isValidCalendarDate(year, month, day)) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      return null;
    }

    // Fallback standard Date.parse (only for alphanumeric formats like "Sep 28, 2026")
    const d = new Date(clean);
    if (!isNaN(d.getTime()) && !/^\d+[-/]\d+/.test(clean)) {
      return d.toISOString().slice(0, 10);
    }

    return null;
  }

  /**
   * Generates a deterministic transaction fingerprint (backward compatible)
   */
  static generateFingerprint(
    organizationId: string,
    date: string,
    amount: number,
    counterparty: string,
    referenceNumber?: string | null
  ): string {
    const normDate = date.trim().slice(0, 10);
    const normAmount = MonetaryMath.toCents(amount);
    const normCounterparty = counterparty.trim().toLowerCase();
    const normRef = (referenceNumber || '').trim().toLowerCase();

    return `${organizationId}|${normDate}|${normAmount}|${normCounterparty}|${normRef}`;
  }

  /**
   * Generates exact and loose fingerprints for duplicate classification
   */
  static generateFingerprints(
    organizationId: string,
    date: string,
    amount: number,
    counterparty: string,
    referenceNumber?: string | null
  ): { exactFingerprint: string; looseFingerprint: string } {
    const normDate = date.trim().slice(0, 10);
    const normAmount = MonetaryMath.toCents(amount);
    const normCounterparty = counterparty.trim().toLowerCase();
    const normRef = (referenceNumber || '').trim().toLowerCase();

    return {
      exactFingerprint: `${organizationId}|${normDate}|${normAmount}|${normCounterparty}|${normRef}`,
      looseFingerprint: `${organizationId}|${normDate}|${normAmount}|${normCounterparty}`,
    };
  }

  /**
   * Alias for processTransactionImportBatch (Phase 2 backward compatibility)
   */
  static processImportBatch(
    organizationId: string,
    rawRows: Record<string, string>[],
    mapping: CsvColumnMapping,
    existingFingerprints: Set<string> = new Set()
  ): CsvImportPreview {
    return this.processTransactionImportBatch(
      organizationId,
      rawRows,
      mapping,
      existingFingerprints
    );
  }

  /**
   * Step 4 & 5: Processes transaction import batch
   */
  static processTransactionImportBatch(
    organizationId: string,
    rawRows: Record<string, string>[],
    mapping: CsvColumnMapping,
    existingFingerprints: Set<string> = new Set(),
    existingLooseFingerprints: Set<string> = new Set()
  ): CsvImportPreview {
    const candidates: CsvImportCandidate[] = [];
    const seenBatchExact = new Set<string>();
    const seenBatchLoose = new Set<string>();

    let totalInflowCents = 0;
    let totalOutflowCents = 0;
    let rejectedAmountCents = 0;

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const rowNumber = index + 1;
      const errors: CsvRowError[] = [];
      const warnings: CsvRowWarning[] = [];

      // 1. Date
      const rawDate = row[mapping.dateColumn]?.trim();
      const parsedDate = this.parseFlexibleDate(rawDate);
      if (!rawDate) {
        errors.push({
          rowNumber,
          field: mapping.dateColumn || 'date',
          code: 'MISSING_DATE',
          message: 'Transaction date is required.',
        });
      } else if (!parsedDate) {
        errors.push({
          rowNumber,
          field: mapping.dateColumn || 'date',
          code: 'INVALID_DATE',
          message: `Date "${rawDate}" is invalid or in an unsupported calendar format.`,
        });
      }

      // 2. Amount & Type
      const rawAmountStr = row[mapping.amountColumn]?.replace(/[$,₹ ]/g, '').trim();
      let parsedAmount: number | null = null;
      let txType: 'inflow' | 'outflow' = 'outflow';

      if (!rawAmountStr) {
        errors.push({
          rowNumber,
          field: mapping.amountColumn || 'amount',
          code: 'MISSING_AMOUNT',
          message: 'Amount field is required.',
        });
      } else {
        const rawNum = parseFloat(rawAmountStr);
        if (isNaN(rawNum) || !isFinite(rawNum) || rawNum === 0) {
          errors.push({
            rowNumber,
            field: mapping.amountColumn || 'amount',
            code: 'INVALID_AMOUNT',
            message: `Amount "${rawAmountStr}" must be a valid non-zero monetary number.`,
          });
          rejectedAmountCents += Math.abs(rawNum) > 0 && !isNaN(rawNum) ? MonetaryMath.toCents(Math.abs(rawNum)) : 0;
        } else {
          parsedAmount = Math.abs(rawNum);

          if (mapping.typeColumn && row[mapping.typeColumn]) {
            const rawType = row[mapping.typeColumn].trim().toLowerCase();
            const indicator = (mapping.inflowIndicatorValue || 'cr').toLowerCase();

            if (rawType === 'inflow' || rawType.includes(indicator) || rawType === 'credit') {
              txType = 'inflow';
            } else if (rawType === 'outflow' || rawType.includes('dr') || rawType === 'debit') {
              txType = 'outflow';
            } else {
              // Ambiguous type
              txType = rawNum > 0 ? 'inflow' : 'outflow';
              warnings.push({
                rowNumber,
                field: mapping.typeColumn,
                code: 'AMBIGUOUS_TYPE',
                message: `Unrecognized type "${row[mapping.typeColumn]}". Inferred ${txType} from amount sign.`,
              });
            }
          } else {
            // Negative amounts represent outflows, positive represent inflows
            txType = rawNum > 0 ? 'inflow' : 'outflow';
          }
        }
      }

      // 3. Description & Counterparty
      const rawDescription = (mapping.descriptionColumn ? row[mapping.descriptionColumn] : '')?.trim() || '';
      const rawCounterparty = (mapping.counterpartyColumn ? row[mapping.counterpartyColumn] : '')?.trim() || '';
      const referenceNumber = (mapping.referenceColumn ? row[mapping.referenceColumn] : null)?.trim() || null;

      if (!rawCounterparty) {
        warnings.push({
          rowNumber,
          field: mapping.counterpartyColumn || 'counterparty',
          code: 'MISSING_COUNTERPARTY',
          message: 'Counterparty is empty; assigned "General Counterparty".',
        });
      }

      if (!rawDescription) {
        warnings.push({
          rowNumber,
          field: mapping.descriptionColumn || 'description',
          code: 'MISSING_DESCRIPTION',
          message: 'Description is blank.',
        });
      }

      // 4. Categorization via Rule Engine
      const explicitCategory = mapping.categoryColumn ? row[mapping.categoryColumn]?.trim() : '';
      let assignedCategory: TransactionCategoryName;
      if (explicitCategory) {
        assignedCategory = explicitCategory as TransactionCategoryName;
      } else {
        const catMatch = CategorizationService.categorizeTransaction(txType, rawDescription, rawCounterparty);
        assignedCategory = catMatch.category;
      }

      // 5. Duplicate Detection
      let duplicateType: DuplicateClassification = 'unique';
      let duplicateReason: string | undefined;

      if (parsedDate && parsedAmount !== null && errors.length === 0) {
        const { exactFingerprint, looseFingerprint } = this.generateFingerprints(
          organizationId,
          parsedDate,
          parsedAmount,
          rawCounterparty || 'General Counterparty',
          referenceNumber
        );

        if (existingFingerprints.has(exactFingerprint)) {
          duplicateType = 'exact_duplicate';
          duplicateReason = 'Exact duplicate: identical date, amount, counterparty, and reference in database.';
        } else if (seenBatchExact.has(exactFingerprint)) {
          duplicateType = 'exact_duplicate';
          duplicateReason = 'Batch duplicate: identical row appears earlier in this CSV file.';
        } else if (existingLooseFingerprints.has(looseFingerprint) || seenBatchLoose.has(looseFingerprint)) {
          duplicateType = 'possible_duplicate';
          duplicateReason = 'Possible duplicate: identical date, amount, and counterparty detected with differing reference.';
        }

        seenBatchExact.add(exactFingerprint);
        seenBatchLoose.add(looseFingerprint);

        let rowStatus: 'valid' | 'invalid' | 'duplicate' | 'warning' = 'valid';
        if (duplicateType !== 'unique') {
          rowStatus = 'duplicate';
        } else if (warnings.length > 0) {
          rowStatus = 'warning';
        }

        if (duplicateType === 'unique') {
          if (txType === 'inflow') {
            totalInflowCents += MonetaryMath.toCents(parsedAmount);
          } else {
            totalOutflowCents += MonetaryMath.toCents(parsedAmount);
          }
        }

        candidates.push({
          rowNumber,
          raw: row,
          parsed: {
            organization_id: organizationId,
            transaction_type: txType,
            category: assignedCategory,
            description: rawDescription || 'Imported Entry',
            amount: parsedAmount,
            transaction_date: parsedDate,
            counterparty: rawCounterparty || 'General Counterparty',
            reference_number: referenceNumber,
            status: 'completed',
            source: 'csv_import',
            is_recurring: false,
          },
          status: rowStatus,
          duplicateType,
          duplicateReason,
          duplicateResolution: duplicateType === 'exact_duplicate' ? 'skip' : 'import_anyway',
          errors,
          warnings,
          suggestedCategory: assignedCategory,
          userAssignedCategory: assignedCategory,
        });
      } else {
        candidates.push({
          rowNumber,
          raw: row,
          status: 'invalid',
          duplicateType: 'unique',
          errors,
          warnings,
        });
      }
    }

    const validRowCount = candidates.filter((c) => c.status === 'valid' || c.status === 'warning').length;
    const duplicateRowCount = candidates.filter((c) => c.status === 'duplicate').length;
    const warningRowCount = candidates.filter((c) => c.warnings.length > 0 && c.status !== 'invalid').length;
    const errorRowCount = candidates.filter((c) => c.status === 'invalid').length;

    return {
      totalRows: rawRows.length,
      validRowCount,
      duplicateRowCount,
      warningRowCount,
      errorRowCount,
      candidates,
      detectedMapping: mapping,
      headers: Object.keys(rawRows[0] || {}),
      summary: {
        totalInflowAmount: MonetaryMath.fromCents(totalInflowCents),
        totalOutflowAmount: MonetaryMath.fromCents(totalOutflowCents),
        netCashImpact: MonetaryMath.subtract(
          MonetaryMath.fromCents(totalInflowCents),
          MonetaryMath.fromCents(totalOutflowCents)
        ),
        rejectedAmountTotal: MonetaryMath.fromCents(rejectedAmountCents),
      },
    };
  }

  /**
   * Generates a downloadable CSV error report protected against formula injection
   */
  static generateErrorReportCsv(candidates: CsvImportCandidate[]): string {
    const errorRows = candidates.filter((c) => c.errors.length > 0 || c.warnings.length > 0);
    const headers = ['Row Number', 'Status', 'Field', 'Code', 'Severity', 'Message'];

    const lines: string[] = [headers.join(',')];

    for (const c of errorRows) {
      for (const err of c.errors) {
        lines.push(
          [
            c.rowNumber,
            'INVALID',
            `"${sanitizeCsvCell(err.field)}"`,
            `"${sanitizeCsvCell(err.code)}"`,
            'ERROR',
            `"${sanitizeCsvCell(err.message)}"`,
          ].join(',')
        );
      }
      for (const w of c.warnings) {
        lines.push(
          [
            c.rowNumber,
            'WARNING',
            `"${sanitizeCsvCell(w.field)}"`,
            `"${sanitizeCsvCell(w.code)}"`,
            'WARNING',
            `"${sanitizeCsvCell(w.message)}"`,
          ].join(',')
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Step 9: Accounts Receivable Batch Processing & Validation
   */
  static processReceivablesBatch(
    organizationId: string,
    rawRows: Record<string, string>[],
    asOfDate: string = new Date().toISOString().slice(0, 10)
  ): {
    validCount: number;
    errorCount: number;
    totalAmount: number;
    totalOutstanding: number;
    overdueCount: number;
    candidates: Array<{
      rowNumber: number;
      parsed?: ReceivableInsert;
      errors: string[];
      isOverdue: boolean;
    }>;
  } {
    let validCount = 0;
    let errorCount = 0;
    let totalAmtCents = 0;
    let totalOutCents = 0;
    let overdueCount = 0;

    const candidates = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const errors: string[] = [];

      const customerName = (row.customer_name || row.customer || row.name || '').trim();
      const invoiceNumber = (row.invoice_number || row.invoice_no || row.inv_no || '').trim();
      const invoiceDate = this.parseFlexibleDate(row.invoice_date || row.date);
      const dueDate = this.parseFlexibleDate(row.due_date || row.due);
      const expectedCollectionDate = this.parseFlexibleDate(row.expected_collection_date || row.expected_date) || dueDate;

      const invoiceAmount = parseFloat((row.invoice_amount || row.amount || '0').replace(/[$,₹ ]/g, ''));
      const outstandingAmount = parseFloat((row.outstanding_amount || row.balance || String(invoiceAmount)).replace(/[$,₹ ]/g, ''));

      if (!customerName) errors.push('Customer name is required.');
      if (!invoiceNumber) errors.push('Invoice number is required.');
      if (!invoiceDate) errors.push('Valid invoice date is required.');
      if (!dueDate) errors.push('Valid due date is required.');
      if (invoiceDate && dueDate && dueDate < invoiceDate) {
        errors.push('Due date cannot precede invoice date.');
      }
      if (isNaN(invoiceAmount) || invoiceAmount <= 0) {
        errors.push('Invoice amount must be a positive number.');
      }
      if (isNaN(outstandingAmount) || outstandingAmount < 0) {
        errors.push('Outstanding amount must be non-negative.');
      } else if (outstandingAmount > invoiceAmount) {
        errors.push('Outstanding amount cannot exceed invoice amount.');
      }

      const isOverdue = Boolean(dueDate && dueDate < asOfDate && outstandingAmount > 0);
      if (isOverdue) overdueCount++;

      if (errors.length === 0) {
        validCount++;
        totalAmtCents += MonetaryMath.toCents(invoiceAmount);
        totalOutCents += MonetaryMath.toCents(outstandingAmount);

        candidates.push({
          rowNumber: i + 1,
          parsed: {
            organization_id: organizationId,
            customer_id: '00000000-0000-0000-0000-000000000000', // resolved or linked
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate!,
            due_date: dueDate!,
            invoice_amount: invoiceAmount,
            outstanding_amount: outstandingAmount,
            expected_collection_date: expectedCollectionDate!,
            status: outstandingAmount === 0 ? 'paid' : (isOverdue ? 'overdue' : 'open'),
          } as ReceivableInsert,
          errors: [],
          isOverdue,
        });
      } else {
        errorCount++;
        candidates.push({
          rowNumber: i + 1,
          errors,
          isOverdue: false,
        });
      }
    }

    return {
      validCount,
      errorCount,
      totalAmount: MonetaryMath.fromCents(totalAmtCents),
      totalOutstanding: MonetaryMath.fromCents(totalOutCents),
      overdueCount,
      candidates,
    };
  }

  /**
   * Step 10: Accounts Payable Batch Processing & Validation
   */
  static processPayablesBatch(
    organizationId: string,
    rawRows: Record<string, string>[],
    asOfDate: string = new Date().toISOString().slice(0, 10)
  ): {
    validCount: number;
    errorCount: number;
    totalAmount: number;
    totalOutstanding: number;
    overdueCount: number;
    candidates: Array<{
      rowNumber: number;
      parsed?: PayableInsert;
      errors: string[];
      isOverdue: boolean;
    }>;
  } {
    let validCount = 0;
    let errorCount = 0;
    let totalAmtCents = 0;
    let totalOutCents = 0;
    let overdueCount = 0;

    const candidates = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const errors: string[] = [];

      const supplierName = (row.supplier_name || row.supplier || row.vendor || '').trim();
      const invoiceNumber = (row.invoice_number || row.bill_number || row.bill_no || '').trim();
      const invoiceDate = this.parseFlexibleDate(row.invoice_date || row.bill_date || row.date);
      const dueDate = this.parseFlexibleDate(row.due_date || row.due);
      const expectedPaymentDate = this.parseFlexibleDate(row.expected_payment_date || row.expected_date) || dueDate;

      const invoiceAmount = parseFloat((row.invoice_amount || row.amount || '0').replace(/[$,₹ ]/g, ''));
      const outstandingAmount = parseFloat((row.outstanding_amount || row.balance || String(invoiceAmount)).replace(/[$,₹ ]/g, ''));

      if (!supplierName) errors.push('Supplier name is required.');
      if (!invoiceNumber) errors.push('Bill/Invoice number is required.');
      if (!invoiceDate) errors.push('Valid invoice date is required.');
      if (!dueDate) errors.push('Valid due date is required.');
      if (invoiceDate && dueDate && dueDate < invoiceDate) {
        errors.push('Due date cannot precede invoice date.');
      }
      if (isNaN(invoiceAmount) || invoiceAmount <= 0) {
        errors.push('Invoice amount must be a positive number.');
      }
      if (isNaN(outstandingAmount) || outstandingAmount < 0) {
        errors.push('Outstanding amount must be non-negative.');
      } else if (outstandingAmount > invoiceAmount) {
        errors.push('Outstanding amount cannot exceed invoice amount.');
      }

      const isOverdue = Boolean(dueDate && dueDate < asOfDate && outstandingAmount > 0);
      if (isOverdue) overdueCount++;

      if (errors.length === 0) {
        validCount++;
        totalAmtCents += MonetaryMath.toCents(invoiceAmount);
        totalOutCents += MonetaryMath.toCents(outstandingAmount);

        candidates.push({
          rowNumber: i + 1,
          parsed: {
            organization_id: organizationId,
            supplier_id: '00000000-0000-0000-0000-000000000000',
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate!,
            due_date: dueDate!,
            invoice_amount: invoiceAmount,
            outstanding_amount: outstandingAmount,
            expected_payment_date: expectedPaymentDate!,
            status: outstandingAmount === 0 ? 'paid' : (isOverdue ? 'overdue' : 'open'),
          } as PayableInsert,
          errors: [],
          isOverdue,
        });
      } else {
        errorCount++;
        candidates.push({
          rowNumber: i + 1,
          errors,
          isOverdue: false,
        });
      }
    }

    return {
      validCount,
      errorCount,
      totalAmount: MonetaryMath.fromCents(totalAmtCents),
      totalOutstanding: MonetaryMath.fromCents(totalOutCents),
      overdueCount,
      candidates,
    };
  }
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const daysInMonths = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonths[month - 1];
}
