/**
 * CSV Financial Data Ingestion & Import Foundation
 * CashFlow Intelligence — Phase 2: Database Schema & Financial Foundation
 *
 * Provides auditable batch ingestion, column mapping, schema validation,
 * and duplicate fingerprint detection without claiming bank integration.
 */

import { MonetaryMath } from './financial-calculator';
import type { Database } from '../types/database';

type TransactionInsert = Database['public']['Tables']['financial_transactions']['Insert'];

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
  rowIndex: number;
  column: string;
  value: string;
  message: string;
}

export interface CsvImportCandidate {
  rowIndex: number;
  raw: Record<string, string>;
  parsed?: TransactionInsert;
  isDuplicate: boolean;
  duplicateReason?: string;
  errors: CsvRowError[];
}

export interface CsvImportPreview {
  totalRows: number;
  validRowCount: number;
  duplicateRowCount: number;
  errorRowCount: number;
  candidates: CsvImportCandidate[];
  summary: {
    totalInflowAmount: number;
    totalOutflowAmount: number;
    netCashImpact: number;
  };
}

export class FinancialImportService {
  /**
   * Generates a deterministic transaction fingerprint to prevent duplicate batch imports
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
   * Parses raw tabular records against a column mapping configuration,
   * performs strict type validation, and flags duplicates against existing records.
   */
  static processImportBatch(
    organizationId: string,
    rawRows: Record<string, string>[],
    mapping: CsvColumnMapping,
    existingFingerprints: Set<string> = new Set()
  ): CsvImportPreview {
    const candidates: CsvImportCandidate[] = [];
    const seenBatchFingerprints = new Set<string>();

    let totalInflowCents = 0;
    let totalOutflowCents = 0;

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const errors: CsvRowError[] = [];

      // 1. Date extraction & validation
      const rawDate = row[mapping.dateColumn]?.trim();
      let parsedDate: string | null = null;
      if (!rawDate) {
        errors.push({ rowIndex: index + 1, column: mapping.dateColumn, value: '', message: 'Date is required.' });
      } else {
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) {
          errors.push({ rowIndex: index + 1, column: mapping.dateColumn, value: rawDate, message: 'Invalid date format.' });
        } else {
          parsedDate = d.toISOString().slice(0, 10);
        }
      }

      // 2. Amount extraction & validation
      const rawAmountStr = row[mapping.amountColumn]?.replace(/[$,₹ ]/g, '').trim();
      let parsedAmount: number | null = null;
      let txType: 'inflow' | 'outflow' = 'outflow';

      if (!rawAmountStr) {
        errors.push({ rowIndex: index + 1, column: mapping.amountColumn, value: '', message: 'Amount is required.' });
      } else {
        const rawNum = parseFloat(rawAmountStr);
        if (isNaN(rawNum) || !isFinite(rawNum) || rawNum === 0) {
          errors.push({ rowIndex: index + 1, column: mapping.amountColumn, value: rawAmountStr, message: 'Amount must be non-zero number.' });
        } else {
          if (mapping.typeColumn && row[mapping.typeColumn]) {
            const rawType = row[mapping.typeColumn].trim().toLowerCase();
            const indicator = (mapping.inflowIndicatorValue || 'cr').toLowerCase();
            txType = rawType.includes(indicator) || rawType === 'inflow' ? 'inflow' : 'outflow';
            parsedAmount = Math.abs(rawNum);
          } else {
            // Negative amounts represent outflows, positive represent inflows
            txType = rawNum > 0 ? 'inflow' : 'outflow';
            parsedAmount = Math.abs(rawNum);
          }
        }
      }

      // 3. Counterparty
      const counterparty = (mapping.counterpartyColumn ? row[mapping.counterpartyColumn] : 'Unknown Counterparty')?.trim() || 'General';

      // 4. Category & Description
      const category = (mapping.categoryColumn ? row[mapping.categoryColumn] : 'Uncategorized')?.trim() || 'General';
      const description = (mapping.descriptionColumn ? row[mapping.descriptionColumn] : '')?.trim() || '';
      const referenceNumber = mapping.referenceColumn ? (row[mapping.referenceColumn]?.trim() || null) : null;

      let isDuplicate = false;
      let duplicateReason: string | undefined;

      if (parsedDate && parsedAmount !== null && errors.length === 0) {
        const fp = this.generateFingerprint(organizationId, parsedDate, parsedAmount, counterparty, referenceNumber);

        if (existingFingerprints.has(fp)) {
          isDuplicate = true;
          duplicateReason = 'Transaction already exists in database with identical date, amount, counterparty, and reference.';
        } else if (seenBatchFingerprints.has(fp)) {
          isDuplicate = true;
          duplicateReason = 'Duplicate entry detected within the same import file.';
        } else {
          seenBatchFingerprints.add(fp);
        }

        if (!isDuplicate) {
          if (txType === 'inflow') {
            totalInflowCents += MonetaryMath.toCents(parsedAmount);
          } else {
            totalOutflowCents += MonetaryMath.toCents(parsedAmount);
          }
        }

        candidates.push({
          rowIndex: index + 1,
          raw: row,
          parsed: {
            organization_id: organizationId,
            transaction_type: txType,
            category,
            description,
            amount: parsedAmount,
            transaction_date: parsedDate,
            counterparty,
            reference_number: referenceNumber,
            status: 'completed',
            source: 'csv_import',
            is_recurring: false,
          },
          isDuplicate,
          duplicateReason,
          errors,
        });
      } else {
        candidates.push({
          rowIndex: index + 1,
          raw: row,
          isDuplicate: false,
          errors,
        });
      }
    }

    const validRowCount = candidates.filter((c) => c.errors.length === 0 && !c.isDuplicate).length;
    const duplicateRowCount = candidates.filter((c) => c.isDuplicate).length;
    const errorRowCount = candidates.filter((c) => c.errors.length > 0).length;

    return {
      totalRows: rawRows.length,
      validRowCount,
      duplicateRowCount,
      errorRowCount,
      candidates,
      summary: {
        totalInflowAmount: MonetaryMath.fromCents(totalInflowCents),
        totalOutflowAmount: MonetaryMath.fromCents(totalOutflowCents),
        netCashImpact: MonetaryMath.subtract(
          MonetaryMath.fromCents(totalInflowCents),
          MonetaryMath.fromCents(totalOutflowCents)
        ),
      },
    };
  }
}
