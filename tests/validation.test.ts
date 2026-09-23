/**
 * Backend Validation & Data Rules Unit Tests
 * CashFlow Intelligence — Phase 2: Database Schema & Financial Foundation
 */

import { describe, it, expect } from 'vitest';
import {
  validateCreateOrganization,
  validateCreateBankAccount,
  validateCreateTransaction,
  validateUpdateTransaction,
  validateAccountsReceivable,
  validateAccountsPayable,
  validateRecurringCashFlow,
  validateForecastAssumption,
} from '../src/lib/validation/financial-validators';
import { FinancialImportService } from '../src/services/import-service';

describe('Financial Validation Engine', () => {
  const validOrgId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
  const validCustomerId = 'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e';
  const validSupplierId = 'c3d4e5f6-a1b2-4c3d-ae4f-5a6b7c8d9e0f';
  const validForecastId = 'd4e5f6a1-b2c3-4d4e-bf5a-6b7c8d9e0f1a';

  describe('Organization Validation', () => {
    it('accepts valid organization input', () => {
      const res = validateCreateOrganization({
        name: 'Apex Manufacturing Ltd',
        business_type: 'manufacturing',
        currency: 'USD',
        timezone: 'America/New_York',
        minimum_cash_threshold: 50000,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe('Apex Manufacturing Ltd');
        expect(res.data.currency).toBe('USD');
      }
    });

    it('rejects missing name and invalid currency code', () => {
      const res = validateCreateOrganization({
        name: '',
        business_type: 'retail',
        currency: 'INVALID_CURRENCY',
        minimum_cash_threshold: -100,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('VALIDATION_ERROR');
        expect(res.error.fields.name).toBeDefined();
        expect(res.error.fields.currency).toBeDefined();
        expect(res.error.fields.minimum_cash_threshold).toBeDefined();
      }
    });
  });

  describe('Bank Account Validation', () => {
    it('validates required fields and currency', () => {
      const valid = validateCreateBankAccount({
        organization_id: validOrgId,
        account_name: 'Operating Checking',
        account_type: 'checking',
        opening_balance: 10000.50,
        currency: 'INR',
      });
      expect(valid.success).toBe(true);

      const invalid = validateCreateBankAccount({
        organization_id: 'bad-uuid',
        account_name: '',
        account_type: '',
        currency: '12',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.fields.organization_id).toBeDefined();
        expect(invalid.error.fields.account_name).toBeDefined();
      }
    });
  });

  describe('Transaction Validation', () => {
    it('validates transaction creation schema with settlement date business rule', () => {
      const res = validateCreateTransaction({
        organization_id: validOrgId,
        transaction_type: 'inflow',
        category: 'Client Retainer',
        amount: 5500.00,
        transaction_date: '2026-09-10',
        settlement_date: '2026-09-12',
        counterparty: 'Global Logistics Corp',
      });
      expect(res.success).toBe(true);

      // Settlement date cannot precede transaction date
      const invalidDate = validateCreateTransaction({
        organization_id: validOrgId,
        transaction_type: 'inflow',
        category: 'Sales',
        amount: 1000,
        transaction_date: '2026-09-10',
        settlement_date: '2026-09-08',
        counterparty: 'Test Client',
      });
      expect(invalidDate.success).toBe(false);
      if (!invalidDate.success) {
        expect(invalidDate.error.fields.settlement_date).toBeDefined();
      }
    });

    it('rejects negative or zero monetary amounts', () => {
      const negative = validateCreateTransaction({
        organization_id: validOrgId,
        transaction_type: 'outflow',
        category: 'Supplies',
        amount: -250.00,
        transaction_date: '2026-09-10',
        counterparty: 'Office Store',
      });
      expect(negative.success).toBe(false);

      const zero = validateCreateTransaction({
        organization_id: validOrgId,
        transaction_type: 'outflow',
        category: 'Supplies',
        amount: 0,
        transaction_date: '2026-09-10',
        counterparty: 'Office Store',
      });
      expect(zero.success).toBe(false);
    });

    it('validates partial transaction updates strictly', () => {
      const validUpdate = validateUpdateTransaction({
        amount: 7500.25,
        status: 'completed',
        counterparty: 'Updated Vendor',
      });
      expect(validUpdate.success).toBe(true);

      const invalidUpdate = validateUpdateTransaction({
        amount: -50,
        status: 'unknown_status' as any,
      });
      expect(invalidUpdate.success).toBe(false);
      if (!invalidUpdate.success) {
        expect(invalidUpdate.error.fields.amount).toBeDefined();
        expect(invalidUpdate.error.fields.status).toBeDefined();
      }
    });
  });

  describe('Receivables & Payables Constraint Validation', () => {
    it('enforces that outstanding_amount cannot exceed invoice_amount', () => {
      const invalidAr = validateAccountsReceivable({
        organization_id: validOrgId,
        customer_id: validCustomerId,
        invoice_number: 'INV-2026-001',
        invoice_date: '2026-09-01',
        due_date: '2026-09-30',
        invoice_amount: 10000,
        outstanding_amount: 15000, // Invalid: exceeds invoice amount!
        expected_collection_date: '2026-09-30',
      });

      expect(invalidAr.success).toBe(false);
      if (!invalidAr.success) {
        expect(invalidAr.error.fields.outstanding_amount).toBeDefined();
      }

      const validAr = validateAccountsReceivable({
        organization_id: validOrgId,
        customer_id: validCustomerId,
        invoice_number: 'INV-2026-001',
        invoice_date: '2026-09-01',
        due_date: '2026-09-30',
        invoice_amount: 10000,
        outstanding_amount: 8000,
        expected_collection_date: '2026-09-30',
      });
      expect(validAr.success).toBe(true);
    });

    it('enforces that AP due date cannot precede invoice date', () => {
      const invalidAp = validateAccountsPayable({
        organization_id: validOrgId,
        supplier_id: validSupplierId,
        invoice_number: 'BILL-889',
        invoice_date: '2026-09-15',
        due_date: '2026-09-10', // Invalid: due date is before invoice date
        invoice_amount: 5000,
        outstanding_amount: 5000,
        expected_payment_date: '2026-09-20',
      });

      expect(invalidAp.success).toBe(false);
      if (!invalidAp.success) {
        expect(invalidAp.error.fields.due_date).toBeDefined();
      }
    });
  });

  describe('Recurring Cash Flows & Forecast Assumptions', () => {
    it('validates recurring cash flow frequency enum and end_date constraint', () => {
      const valid = validateRecurringCashFlow({
        organization_id: validOrgId,
        name: 'Office Lease',
        flow_type: 'outflow',
        category: 'Rent',
        amount: 12000,
        frequency: 'monthly',
        next_occurrence_date: '2026-10-01',
        end_date: '2027-09-30',
      });
      expect(valid.success).toBe(true);

      const invalid = validateRecurringCashFlow({
        organization_id: validOrgId,
        name: 'Lease',
        flow_type: 'outflow',
        category: 'Rent',
        amount: 12000,
        frequency: 'bi-annually' as any, // Not in enum
        next_occurrence_date: '2026-10-01',
      });
      expect(invalid.success).toBe(false);
    });

    it('validates forecast assumption confidence bounds (0.0 to 1.0)', () => {
      const valid = validateForecastAssumption({
        forecast_id: validForecastId,
        assumption_type: 'ar_collection_rate',
        description: 'Historical DSO benchmark',
        value: { targetDso: 35 },
        source: 'financial_engine',
        confidence: 0.95,
      });
      expect(valid.success).toBe(true);

      const invalid = validateForecastAssumption({
        forecast_id: validForecastId,
        assumption_type: 'growth',
        description: 'Test',
        value: {},
        source: 'manual',
        confidence: 1.5, // Invalid: exceeds 1.0
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('Import Foundation & Duplicate Detection Strategy', () => {
    it('detects duplicate entries within the same CSV batch and against existing fingerprints', () => {
      const rawRows = [
        { Date: '2026-09-01', Amount: '1500.00', Counterparty: 'Alpha Ltd', Category: 'Sales' },
        { Date: '2026-09-01', Amount: '1500.00', Counterparty: 'Alpha Ltd', Category: 'Sales' }, // duplicate inside batch
        { Date: '2026-09-02', Amount: '2200.00', Counterparty: 'Beta Corp', Category: 'Sales' },  // duplicate against existing DB
      ];

      const existingFp = FinancialImportService.generateFingerprint(
        validOrgId,
        '2026-09-02',
        2200.00,
        'Beta Corp',
        null
      );
      const existingSet = new Set([existingFp]);

      const preview = FinancialImportService.processImportBatch(
        validOrgId,
        rawRows,
        {
          dateColumn: 'Date',
          amountColumn: 'Amount',
          counterpartyColumn: 'Counterparty',
          categoryColumn: 'Category',
        },
        existingSet
      );

      expect(preview.totalRows).toBe(3);
      expect(preview.validRowCount).toBe(1);
      expect(preview.duplicateRowCount).toBe(2);
      expect(preview.errorRowCount).toBe(0);
    });
  });
});
