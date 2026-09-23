/**
 * Transaction Import, Processing & Quality Tests
 * CashFlow Intelligence — Phase 3: Transaction Import & Financial Data Quality
 */

import { describe, it, expect } from 'vitest';
import {
  FinancialImportService,
  sanitizeCsvCell,
  tokenizeCsvLine,
} from '../src/services/import-service';
import { CategorizationService } from '../src/services/categorization-service';
import { handleImportConfirm } from '../server/import-handler';

describe('CSV Parsing, Column Mapping & Ingestion Pipeline', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';

  describe('File Validation & Security Protection', () => {
    it('rejects unsupported non-CSV files', () => {
      const res = FinancialImportService.validateUploadedFile({
        name: 'statement.xlsx',
        size: 1024,
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Only standard comma-separated (.csv) files');
    });

    it('rejects files exceeding 10MB limit', () => {
      const res = FinancialImportService.validateUploadedFile({
        name: 'huge_statement.csv',
        size: 15 * 1024 * 1024,
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('File size exceeds the 10 MB threshold');
    });

    it('rejects empty files', () => {
      const res = FinancialImportService.validateUploadedFile({
        name: 'empty.csv',
        size: 0,
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('empty');
    });

    it('neutralizes CSV formula injection attacks', () => {
      expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
      expect(sanitizeCsvCell('+cmd|/c')).toBe("'+cmd|/c");
      expect(sanitizeCsvCell('-500')).toBe("'-500");
      expect(sanitizeCsvCell('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      expect(sanitizeCsvCell('Normal Text')).toBe('Normal Text');
    });

    it('safely tokenizes CSV lines with quoted commas', () => {
      const line = '2026-09-01,"Apex Supplies, Inc.",15000,"Raw Materials, Batch #10",CR';
      const tokens = tokenizeCsvLine(line);
      expect(tokens.length).toBe(5);
      expect(tokens[1]).toBe('Apex Supplies, Inc.');
      expect(tokens[3]).toBe('Raw Materials, Batch #10');
    });
  });

  describe('Flexible Date Parsing & Multi-Format Support', () => {
    it('parses standard ISO YYYY-MM-DD', () => {
      expect(FinancialImportService.parseFlexibleDate('2026-09-28')).toBe('2026-09-28');
    });

    it('parses DD/MM/YYYY and DD-MM-YYYY formats', () => {
      expect(FinancialImportService.parseFlexibleDate('28/09/2026')).toBe('2026-09-28');
      expect(FinancialImportService.parseFlexibleDate('15-08-2026')).toBe('2026-08-15');
    });

    it('rejects impossible calendar dates (e.g. Feb 30, April 31)', () => {
      expect(FinancialImportService.parseFlexibleDate('2026-02-30')).toBeNull();
      expect(FinancialImportService.parseFlexibleDate('31/04/2026')).toBeNull();
      expect(FinancialImportService.parseFlexibleDate('invalid-date')).toBeNull();
    });
  });

  describe('Debit/Credit & Amount Inference', () => {
    it('maps credit indicators to inflows and debit to outflows', () => {
      const rows = [
        { Date: '2026-09-10', Amount: '45000', Type: 'Credit', Details: 'Customer collection' },
        { Date: '2026-09-11', Amount: '12000', Type: 'Debit', Details: 'Office Rent payment' },
        { Date: '2026-09-12', Amount: '8500', Type: 'CR', Details: 'Interest received' },
        { Date: '2026-09-13', Amount: '3000', Type: 'DR', Details: 'Fuel expense' },
      ];

      const preview = FinancialImportService.processTransactionImportBatch(orgId, rows, {
        dateColumn: 'Date',
        amountColumn: 'Amount',
        typeColumn: 'Type',
        descriptionColumn: 'Details',
      });

      expect(preview.validRowCount).toBe(4);
      expect(preview.candidates[0].parsed?.transaction_type).toBe('inflow');
      expect(preview.candidates[1].parsed?.transaction_type).toBe('outflow');
      expect(preview.candidates[2].parsed?.transaction_type).toBe('inflow');
      expect(preview.candidates[3].parsed?.transaction_type).toBe('outflow');
      expect(preview.summary.totalInflowAmount).toBe(53500.00);
      expect(preview.summary.totalOutflowAmount).toBe(15000.00);
      expect(preview.summary.netCashImpact).toBe(38500.00);
    });

    it('infers inflows and outflows from positive and negative numeric amounts when type column is absent', () => {
      const rows = [
        { Date: '2026-09-15', Amount: '50000', Description: 'Sales proceeds' },
        { Date: '2026-09-16', Amount: '-15000', Description: 'Supplier wire' },
      ];

      const preview = FinancialImportService.processTransactionImportBatch(orgId, rows, {
        dateColumn: 'Date',
        amountColumn: 'Amount',
        descriptionColumn: 'Description',
      });

      expect(preview.candidates[0].parsed?.transaction_type).toBe('inflow');
      expect(preview.candidates[0].parsed?.amount).toBe(50000);
      expect(preview.candidates[1].parsed?.transaction_type).toBe('outflow');
      expect(preview.candidates[1].parsed?.amount).toBe(15000);
      expect(preview.summary.netCashImpact).toBe(35000.00);
    });
  });

  describe('Duplicate Transaction Detection', () => {
    it('classifies exact duplicates and allows user-selected resolution', () => {
      const existingFp = FinancialImportService.generateFingerprints(
        orgId,
        '2026-09-20',
        25000,
        'Acme Distributors',
        'UTR-9912'
      );
      const existingSet = new Set([existingFp.exactFingerprint]);
      const existingLooseSet = new Set([existingFp.looseFingerprint]);

      const rows = [
        { Date: '2026-09-20', Amount: '25000', Party: 'Acme Distributors', Ref: 'UTR-9912' }, // Exact DB duplicate
        { Date: '2026-09-20', Amount: '25000', Party: 'Acme Distributors', Ref: 'UTR-9999' }, // Possible duplicate (same date, amount, party, different ref)
        { Date: '2026-09-21', Amount: '18000', Party: 'Global Tech', Ref: 'UTR-1001' },       // Unique
      ];

      const preview = FinancialImportService.processTransactionImportBatch(
        orgId,
        rows,
        {
          dateColumn: 'Date',
          amountColumn: 'Amount',
          counterpartyColumn: 'Party',
          referenceColumn: 'Ref',
        },
        existingSet,
        existingLooseSet
      );

      expect(preview.duplicateRowCount).toBe(2);
      expect(preview.candidates[0].duplicateType).toBe('exact_duplicate');
      expect(preview.candidates[1].duplicateType).toBe('possible_duplicate');
      expect(preview.candidates[2].duplicateType).toBe('unique');
    });
  });

  describe('Rule-Based Categorization', () => {
    it('accurately assigns operational categories based on transaction description', () => {
      expect(CategorizationService.categorizeTransaction('outflow', 'Monthly office rent for September').category).toBe('Rent');
      expect(CategorizationService.categorizeTransaction('outflow', 'Staff payroll disbursement for 20 employees').category).toBe('Salaries');
      expect(CategorizationService.categorizeTransaction('outflow', 'GST electronic challan payment').category).toBe('Taxes');
      expect(CategorizationService.categorizeTransaction('outflow', 'AWS Cloud hosting subscription').category).toBe('Software Subscription');
      expect(CategorizationService.categorizeTransaction('inflow', 'Customer invoice collection from Retailer').category).toBe('Accounts Receivable Collection');
    });
  });

  describe('Accounts Receivable Batch Ingestion', () => {
    it('validates invoices, detects overdue items, and rejects invalid outstanding amounts', () => {
      const rows = [
        {
          customer_name: 'Metro Hypermarkets',
          invoice_number: 'INV-1001',
          invoice_date: '2026-08-01',
          due_date: '2026-08-31',
          invoice_amount: '100000',
          outstanding_amount: '40000', // partial payment
        },
        {
          customer_name: 'City Mart',
          invoice_number: 'INV-1002',
          invoice_date: '2026-09-10',
          due_date: '2026-10-10',
          invoice_amount: '50000',
          outstanding_amount: '70000', // Invalid: outstanding > invoice!
        },
      ];

      const res = FinancialImportService.processReceivablesBatch(orgId, rows, '2026-09-15');
      expect(res.validCount).toBe(1);
      expect(res.errorCount).toBe(1);
      expect(res.overdueCount).toBe(1); // INV-1001 is past Aug 31
      expect(res.candidates[0].parsed?.status).toBe('overdue');
      expect(res.candidates[1].errors[0]).toContain('Outstanding amount cannot exceed invoice amount');
    });
  });

  describe('Security & Access Control Authorization', () => {
    it('blocks viewer role from confirming imports', async () => {
      const res = await handleImportConfirm({
        organizationId: orgId,
        fileName: 'transactions.csv',
        fileSize: 1024,
        candidates: [],
        userRole: 'viewer',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('FORBIDDEN');
    });
  });
});
