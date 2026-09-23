/**
 * Financial Calculation Service Unit Tests
 * CashFlow Intelligence — Phase 2: Database Schema & Financial Foundation
 */

import { describe, it, expect } from 'vitest';
import { FinancialCalculatorService, MonetaryMath } from '../src/services/financial-calculator';
import type { Database } from '../src/types/database';

type TransactionRow = Database['public']['Tables']['financial_transactions']['Row'];
type ReceivableRow = Database['public']['Tables']['accounts_receivable']['Row'];
type PayableRow = Database['public']['Tables']['accounts_payable']['Row'];

function mockTx(overrides: Partial<TransactionRow>): TransactionRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    organization_id: '11111111-1111-1111-1111-111111111111',
    bank_account_id: '22222222-2222-2222-2222-222222222222',
    transaction_type: 'inflow',
    category: 'Sales',
    description: 'Test transaction',
    amount: 100.0,
    transaction_date: '2026-09-01',
    settlement_date: '2026-09-01',
    counterparty: 'Acme Corp',
    reference_number: 'INV-101',
    status: 'completed',
    source: 'manual',
    is_recurring: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

describe('FinancialCalculatorService', () => {
  describe('Decimal & Monetary Precision', () => {
    it('prevents floating point arithmetic drift on currency math', () => {
      // Classic IEEE-754 binary floating drift: 0.1 + 0.2 = 0.30000000000000004
      expect(0.1 + 0.2).not.toBe(0.3);
      expect(MonetaryMath.add(0.1, 0.2)).toBe(0.3);
      expect(MonetaryMath.subtract(10.05, 0.05)).toBe(10.0);
    });

    it('throws error when non-finite monetary values are passed', () => {
      expect(() => MonetaryMath.toCents(NaN)).toThrow();
      expect(() => MonetaryMath.toCents(Infinity)).toThrow();
    });
  });

  describe('Inflow & Outflow Calculations', () => {
    it('calculates positive inflows accurately within a date range', () => {
      const transactions = [
        mockTx({ amount: 1500.50, transaction_type: 'inflow', transaction_date: '2026-09-05' }),
        mockTx({ amount: 2500.25, transaction_type: 'inflow', transaction_date: '2026-09-10' }),
        mockTx({ amount: 5000.00, transaction_type: 'inflow', transaction_date: '2026-09-25' }), // outside range
      ];

      const inflows = FinancialCalculatorService.calculateTotalInflows(transactions, {
        startDate: '2026-09-01',
        endDate: '2026-09-15',
      });

      expect(inflows).toBe(4000.75);
    });

    it('calculates outflows accurately within a date range', () => {
      const transactions = [
        mockTx({ amount: 800.20, transaction_type: 'outflow', transaction_date: '2026-09-03' }),
        mockTx({ amount: 1200.80, transaction_type: 'outflow', transaction_date: '2026-09-07' }),
      ];

      const outflows = FinancialCalculatorService.calculateTotalOutflows(transactions, {
        startDate: '2026-09-01',
        endDate: '2026-09-10',
      });

      expect(outflows).toBe(2001.00);
    });

    it('handles mixed inflows and outflows for net cash flow calculation', () => {
      const transactions = [
        mockTx({ amount: 10000.00, transaction_type: 'inflow', transaction_date: '2026-09-01' }),
        mockTx({ amount: 3500.50, transaction_type: 'outflow', transaction_date: '2026-09-02' }),
        mockTx({ amount: 1500.25, transaction_type: 'outflow', transaction_date: '2026-09-03' }),
      ];

      const net = FinancialCalculatorService.calculateNetCashFlow(transactions, {
        startDate: '2026-09-01',
        endDate: '2026-09-05',
      });

      expect(net).toBe(4999.25);
    });

    it('returns zero for empty transactions list safely without errors', () => {
      const filter = { startDate: '2026-09-01', endDate: '2026-09-30' };
      expect(FinancialCalculatorService.calculateTotalInflows([], filter)).toBe(0.0);
      expect(FinancialCalculatorService.calculateTotalOutflows([], filter)).toBe(0.0);
      expect(FinancialCalculatorService.calculateNetCashFlow([], filter)).toBe(0.0);
      expect(FinancialCalculatorService.calculateEndingCash(50000, [], filter)).toBe(50000.0);
    });
  });

  describe('Ending Cash & Negative Balance Calculations', () => {
    it('calculates ending cash based on beginning cash and net flow', () => {
      const beginningCash = 25000.00;
      const transactions = [
        mockTx({ amount: 8000.00, transaction_type: 'inflow', transaction_date: '2026-09-02' }),
        mockTx({ amount: 3000.00, transaction_type: 'outflow', transaction_date: '2026-09-04' }),
      ];

      const endingCash = FinancialCalculatorService.calculateEndingCash(beginningCash, transactions, {
        startDate: '2026-09-01',
        endDate: '2026-09-05',
      });

      // 25000 + 8000 - 3000 = 30000
      expect(endingCash).toBe(30000.00);
    });

    it('accurately calculates negative cash balances when outflows exceed beginning cash + inflows', () => {
      const beginningCash = 5000.00;
      const transactions = [
        mockTx({ amount: 2000.00, transaction_type: 'inflow', transaction_date: '2026-09-02' }),
        mockTx({ amount: 12000.00, transaction_type: 'outflow', transaction_date: '2026-09-03' }),
      ];

      const endingCash = FinancialCalculatorService.calculateEndingCash(beginningCash, transactions, {
        startDate: '2026-09-01',
        endDate: '2026-09-05',
      });

      // 5000 + 2000 - 12000 = -5000
      expect(endingCash).toBe(-5000.00);
    });
  });

  describe('Edge Cases: Status, Same-Day & Month-End Dates', () => {
    it('excludes cancelled transactions from cash calculations', () => {
      const transactions = [
        mockTx({ amount: 5000, transaction_type: 'inflow', status: 'completed', transaction_date: '2026-09-01' }),
        mockTx({ amount: 3000, transaction_type: 'inflow', status: 'cancelled', transaction_date: '2026-09-01' }),
      ];

      const inflows = FinancialCalculatorService.calculateTotalInflows(transactions, {
        startDate: '2026-09-01',
        endDate: '2026-09-01',
      });

      expect(inflows).toBe(5000.00);
    });

    it('handles pending transactions according to includePending parameter', () => {
      const transactions = [
        mockTx({ amount: 1000, transaction_type: 'inflow', status: 'completed', transaction_date: '2026-09-01' }),
        mockTx({ amount: 2000, transaction_type: 'inflow', status: 'pending', transaction_date: '2026-09-01' }),
      ];

      const settledInflows = FinancialCalculatorService.calculateTotalInflows(transactions, {
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        includePending: false,
      });
      expect(settledInflows).toBe(1000.00);

      const allInflows = FinancialCalculatorService.calculateTotalInflows(transactions, {
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        includePending: true,
      });
      expect(allInflows).toBe(3000.00);
    });

    it('aggregates multiple transactions occurring on the same day correctly', () => {
      const transactions = [
        mockTx({ amount: 100.50, transaction_type: 'inflow', transaction_date: '2026-09-15' }),
        mockTx({ amount: 200.25, transaction_type: 'inflow', transaction_date: '2026-09-15' }),
        mockTx({ amount: 50.75, transaction_type: 'outflow', transaction_date: '2026-09-15' }),
      ];

      const net = FinancialCalculatorService.calculateNetCashFlow(transactions, {
        startDate: '2026-09-15',
        endDate: '2026-09-15',
      });

      // (100.50 + 200.25) - 50.75 = 250.00
      expect(net).toBe(250.00);
    });

    it('handles month-end date boundaries (e.g. Feb 28 to Mar 01)', () => {
      const transactions = [
        mockTx({ amount: 1000, transaction_type: 'inflow', transaction_date: '2026-02-28' }),
        mockTx({ amount: 2000, transaction_type: 'inflow', transaction_date: '2026-03-01' }),
      ];

      const inflows = FinancialCalculatorService.calculateTotalInflows(transactions, {
        startDate: '2026-02-28',
        endDate: '2026-03-01',
      });

      expect(inflows).toBe(3000.00);
    });
  });

  describe('Receivables & Payables Auditability', () => {
    it('calculates outstanding receivables and ignores fully paid and cancelled invoices', () => {
      const receivables: ReceivableRow[] = [
        {
          id: 'ar-1',
          organization_id: 'org-1',
          customer_id: 'cust-1',
          invoice_number: 'INV-001',
          invoice_date: '2026-09-01',
          due_date: '2026-09-15',
          invoice_amount: 10000.00,
          outstanding_amount: 4000.00, // partially paid
          expected_collection_date: '2026-09-15',
          status: 'partially_paid',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
        {
          id: 'ar-2',
          organization_id: 'org-1',
          customer_id: 'cust-2',
          invoice_number: 'INV-002',
          invoice_date: '2026-09-05',
          due_date: '2026-09-20',
          invoice_amount: 5000.00,
          outstanding_amount: 0.00, // fully paid
          expected_collection_date: '2026-09-20',
          status: 'paid',
          created_at: '2026-09-05T00:00:00Z',
          updated_at: '2026-09-05T00:00:00Z',
        },
        {
          id: 'ar-3',
          organization_id: 'org-1',
          customer_id: 'cust-3',
          invoice_number: 'INV-003',
          invoice_date: '2026-09-08',
          due_date: '2026-09-22',
          invoice_amount: 6000.00,
          outstanding_amount: 6000.00,
          expected_collection_date: '2026-09-22',
          status: 'cancelled',
          created_at: '2026-09-08T00:00:00Z',
          updated_at: '2026-09-08T00:00:00Z',
        },
      ];

      const outstanding = FinancialCalculatorService.calculateOutstandingReceivables(receivables);
      expect(outstanding).toBe(4000.00);
    });

    it('identifies overdue receivables as of reference date', () => {
      const receivables: ReceivableRow[] = [
        {
          id: 'ar-1',
          organization_id: 'org-1',
          customer_id: 'cust-1',
          invoice_number: 'INV-101',
          invoice_date: '2026-08-01',
          due_date: '2026-08-31',
          invoice_amount: 2500.00,
          outstanding_amount: 2500.00,
          expected_collection_date: '2026-08-31',
          status: 'open',
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T00:00:00Z',
        },
        {
          id: 'ar-2',
          organization_id: 'org-1',
          customer_id: 'cust-2',
          invoice_number: 'INV-102',
          invoice_date: '2026-09-01',
          due_date: '2026-09-30',
          invoice_amount: 8000.00,
          outstanding_amount: 8000.00,
          expected_collection_date: '2026-09-30',
          status: 'open',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ];

      const overdue = FinancialCalculatorService.identifyOverdueReceivables(receivables, '2026-09-15');
      expect(overdue.length).toBe(1);
      expect(overdue[0].invoice_number).toBe('INV-101');
    });

    it('identifies overdue payables as of reference date', () => {
      const payables: PayableRow[] = [
        {
          id: 'ap-1',
          organization_id: 'org-1',
          supplier_id: 'sup-1',
          invoice_number: 'BILL-501',
          invoice_date: '2026-08-10',
          due_date: '2026-09-01',
          invoice_amount: 3200.00,
          outstanding_amount: 1500.00,
          expected_payment_date: '2026-09-01',
          status: 'partially_paid',
          created_at: '2026-08-10T00:00:00Z',
          updated_at: '2026-08-10T00:00:00Z',
        },
        {
          id: 'ap-2',
          organization_id: 'org-1',
          supplier_id: 'sup-2',
          invoice_number: 'BILL-502',
          invoice_date: '2026-09-10',
          due_date: '2026-10-01',
          invoice_amount: 5000.00,
          outstanding_amount: 5000.00,
          expected_payment_date: '2026-10-01',
          status: 'open',
          created_at: '2026-09-10T00:00:00Z',
          updated_at: '2026-09-10T00:00:00Z',
        },
      ];

      const overdue = FinancialCalculatorService.identifyOverduePayables(payables, '2026-09-15');
      expect(overdue.length).toBe(1);
      expect(overdue[0].invoice_number).toBe('BILL-501');
    });
  });

  describe('Minimum Cash Threshold Breach Identification', () => {
    it('detects threshold breaches and records exact deficit amounts', () => {
      const beginningCash = 100000;
      const minimumThreshold = 50000;
      const transactions = [
        mockTx({ amount: 70000, transaction_type: 'outflow', transaction_date: '2026-09-02' }),
      ];

      const { breaches, dailyProgression } = FinancialCalculatorService.identifyThresholdBreaches(
        beginningCash,
        transactions,
        '2026-09-01',
        4,
        minimumThreshold
      );

      // Day 0 (Sep 01): 100,000 (Safe)
      // Day 1 (Sep 02): 100,000 - 70,000 = 30,000 (Breached! Deficit = 20,000)
      // Day 2 (Sep 03): 30,000 (Breached!)
      // Day 3 (Sep 04): 30,000 (Breached!)
      expect(breaches.length).toBe(3);
      expect(breaches[0].date).toBe('2026-09-02');
      expect(breaches[0].projectedBalance).toBe(30000);
      expect(breaches[0].deficit).toBe(20000);
      expect(dailyProgression.length).toBe(4);
    });
  });
});
