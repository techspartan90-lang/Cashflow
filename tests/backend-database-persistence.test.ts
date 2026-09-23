/**
 * Comprehensive Backend Database & Model Persistence Integration Tests
 * CashFlow Intelligence — Persistent SQLite & Full Backend Working Model
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService, getDatabase } from '../server/db';
import { handleForecastGenerate } from '../server/forecast-handler';
import { AlertEngine } from '../src/services/alert-engine';

describe('Persistent SQLite Backend & Full Working Financial Model', () => {
  const DEFAULT_ORG = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    // Reset database to pristine demo state before tests to guarantee determinism
    DatabaseService.resetDatabase(DEFAULT_ORG);
  });

  describe('Database Health & Statistics', () => {
    it('initializes SQLite database with all tables and positive row counts', () => {
      const stats = DatabaseService.getStats();
      expect(stats.connected).toBe(true);
      expect(stats.engine).toContain('SQLite');
      expect(stats.totalRows).toBeGreaterThan(50);
      expect(stats.tableCounts.organizations).toBe(1);
      expect(stats.tableCounts.bank_accounts).toBeGreaterThanOrEqual(2);
      expect(stats.tableCounts.financial_transactions).toBeGreaterThanOrEqual(5);
      expect(stats.tableCounts.accounts_receivable).toBeGreaterThanOrEqual(5);
      expect(stats.tableCounts.accounts_payable).toBeGreaterThanOrEqual(5);
      expect(stats.tableCounts.operating_expenses).toBeGreaterThanOrEqual(5);
      expect(stats.tableCounts.inventory_items).toBeGreaterThanOrEqual(3);
      expect(stats.tableCounts.loan_obligations).toBeGreaterThanOrEqual(1);
      expect(stats.tableCounts.tax_obligations).toBeGreaterThanOrEqual(2);
      expect(stats.tableCounts.recommendations).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Full Financial Model Bootstrap', () => {
    it('loads comprehensive bootstrap payload matching all frontend model types', () => {
      const bootstrap = DatabaseService.getBootstrapData(DEFAULT_ORG);

      // Business Profile
      expect(bootstrap.businessProfile.name).toBe('Prism Wholesale & Retail Supplies');
      expect(bootstrap.businessProfile.currency).toBe('INR');
      expect(bootstrap.businessProfile.openingCash).toBe(250000);
      expect(bootstrap.businessProfile.minimumCashReserveThreshold).toBe(100000);

      // Bank Accounts
      expect(bootstrap.bankAccounts.length).toBeGreaterThanOrEqual(2);
      expect(bootstrap.bankAccounts[0].account_name).toContain('HDFC');

      // Transactions
      expect(bootstrap.transactions.length).toBeGreaterThanOrEqual(5);
      expect(bootstrap.transactions[0]).toHaveProperty('amount');
      expect(bootstrap.transactions[0]).toHaveProperty('type');
      expect(bootstrap.transactions[0]).toHaveProperty('category');

      // Receivables
      expect(bootstrap.salesInvoices.length).toBeGreaterThanOrEqual(5);
      expect(bootstrap.salesInvoices[0]).toHaveProperty('invoiceNumber');
      expect(bootstrap.salesInvoices[0]).toHaveProperty('customerName');

      // Payables
      expect(bootstrap.purchaseInvoices.length).toBeGreaterThanOrEqual(5);
      expect(bootstrap.purchaseInvoices[0]).toHaveProperty('billNumber');
      expect(bootstrap.purchaseInvoices[0]).toHaveProperty('supplierName');

      // Operating Expenses
      expect(bootstrap.operatingExpenses.length).toBeGreaterThanOrEqual(5);

      // Inventory Items
      expect(bootstrap.inventoryItems.length).toBeGreaterThanOrEqual(3);

      // Loans & Taxes
      expect(bootstrap.loans.length).toBeGreaterThanOrEqual(1);
      expect(bootstrap.taxes.length).toBeGreaterThanOrEqual(2);

      // Recommendations & Variance
      expect(bootstrap.recommendations.length).toBeGreaterThanOrEqual(4);
      expect(bootstrap.varianceRecords.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Transaction Persistence & CRUD', () => {
    it('creates, persists, and retrieves new transactions in SQLite', () => {
      const initialCount = DatabaseService.getStats().tableCounts.financial_transactions;

      const created = DatabaseService.createTransaction({
        amount: 85000,
        type: 'inflow',
        category: 'Customer Collections',
        counterparty: 'Apex Mart Distribution',
        notes: 'Real-time invoice settlement via RTGS',
        transactionDate: '2026-09-24',
      }, DEFAULT_ORG);

      expect(created).toBeDefined();
      expect(created.amount).toBe(85000);
      expect(created.counterparty).toBe('Apex Mart Distribution');

      const afterCount = DatabaseService.getStats().tableCounts.financial_transactions;
      expect(afterCount).toBe(initialCount + 1);

      // Verify persistent query
      const db = getDatabase();
      const queried = db.prepare('SELECT * FROM financial_transactions WHERE id = ?').get(created.id) as any;
      expect(queried).toBeDefined();
      expect(queried.amount).toBe(85000);
      expect(queried.transaction_type).toBe('inflow');
      expect(queried.category).toBe('Customer Collections');
    });
  });

  describe('Accounts Receivable (AR) Persistence & Updates', () => {
    it('persists newly issued invoices and updates collection status and paid amount', () => {
      const inv = DatabaseService.createReceivable({
        customerName: 'Reliance Retail Wholesale',
        invoiceNumber: 'INV-2026-889',
        amount: 145000,
        issueDate: '2026-09-23',
        dueDate: '2026-10-15',
        expectedCollectionDate: '2026-10-18',
        status: 'outstanding',
      }, DEFAULT_ORG);

      expect(inv.id).toBeDefined();
      expect(inv.invoice_number).toBe('INV-2026-889');
      expect(inv.amount).toBe(145000);

      // Update invoice in database
      const updated = DatabaseService.updateReceivable(inv.id, {
        status: 'partially_paid',
        paidAmount: 70000,
        notes: 'Customer transferred 70k advance via IMPS',
      }, DEFAULT_ORG);

      expect(updated).toBeDefined();
      expect(updated.status).toBe('partially_paid');
      expect(updated.paid_amount).toBe(70000);
      expect(updated.notes).toBe('Customer transferred 70k advance via IMPS');

      // Verify persisted row
      const db = getDatabase();
      const row = db.prepare('SELECT * FROM accounts_receivable WHERE id = ?').get(inv.id) as any;
      expect(row.paid_amount).toBe(70000);
      expect(row.status).toBe('partially_paid');
    });
  });

  describe('Accounts Payable (AP) Persistence & Updates', () => {
    it('persists supplier bills and updates scheduled payment date and status', () => {
      const bill = DatabaseService.createPayable({
        supplierName: 'Tata Agro Supplies Ltd',
        billNumber: 'BILL-TA-9921',
        amount: 92000,
        billDate: '2026-09-23',
        dueDate: '2026-10-10',
        scheduledPaymentDate: '2026-10-10',
        priority: 'high',
        category: 'raw_materials',
        status: 'unpaid',
      }, DEFAULT_ORG);

      expect(bill.id).toBeDefined();
      expect(bill.bill_number).toBe('BILL-TA-9921');
      expect(bill.amount).toBe(92000);

      // Reschedule bill in database
      const updated = DatabaseService.updatePayable(bill.id, {
        scheduledPaymentDate: '2026-10-18',
        status: 'approved',
      }, DEFAULT_ORG);

      expect(updated).toBeDefined();
      expect(updated.scheduled_payment_date).toBe('2026-10-18');
      expect(updated.status).toBe('approved');

      // Verify persistence
      const db = getDatabase();
      const row = db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(bill.id) as any;
      expect(row.scheduled_payment_date).toBe('2026-10-18');
      expect(row.status).toBe('approved');
    });
  });

  describe('Operating Expenses Persistence', () => {
    it('stores new recurring and fixed operating expenses in SQLite', () => {
      const initialCount = DatabaseService.getStats().tableCounts.operating_expenses;

      const opex = DatabaseService.createOperatingExpense({
        name: 'Cold Storage Refrigeration Power Utility',
        type: 'fixed',
        category: 'Utilities',
        amount: 18500,
        frequency: 'monthly',
        dueDayOfMonth: 15,
        isMandatory: true,
      }, DEFAULT_ORG);

      expect(opex.id).toBeDefined();
      expect(opex.amount).toBe(18500);

      const afterCount = DatabaseService.getStats().tableCounts.operating_expenses;
      expect(afterCount).toBe(initialCount + 1);

      const db = getDatabase();
      const row = db.prepare('SELECT * FROM operating_expenses WHERE id = ?').get(opex.id) as any;
      expect(row.name).toBe('Cold Storage Refrigeration Power Utility');
      expect(row.is_mandatory).toBe(1);
    });
  });

  describe('Recommendations Implementation Toggle', () => {
    it('toggles recommendation implementation status persistently in SQLite', () => {
      const bootstrap = DatabaseService.getBootstrapData(DEFAULT_ORG);
      const targetRec = bootstrap.recommendations[0];
      const initialStatus = targetRec.isImplemented;

      // Toggle status
      const res1 = DatabaseService.toggleRecommendation(targetRec.id, DEFAULT_ORG);
      expect(res1).toBeDefined();
      expect(res1?.isImplemented).toBe(!initialStatus);

      // Verify in DB directly
      const db = getDatabase();
      let row = db.prepare('SELECT is_implemented FROM recommendations WHERE id = ?').get(targetRec.id) as any;
      expect(Boolean(row.is_implemented)).toBe(!initialStatus);

      // Toggle back
      const res2 = DatabaseService.toggleRecommendation(targetRec.id, DEFAULT_ORG);
      expect(res2?.isImplemented).toBe(initialStatus);

      row = db.prepare('SELECT is_implemented FROM recommendations WHERE id = ?').get(targetRec.id) as any;
      expect(Boolean(row.is_implemented)).toBe(initialStatus);
    });
  });

  describe('Forecast Execution & SQLite Persistence', () => {
    it('generates deterministic forecast and saves run + daily projections in SQLite', async () => {
      const initialRuns = DatabaseService.getStats().tableCounts.forecast_runs;

      const res = await handleForecastGenerate({
        organizationId: DEFAULT_ORG,
        horizonDays: 30,
        scenario: 'expected',
        minimumCashThreshold: 100000,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.forecastId).toBeDefined();
        expect(res.data.dailyForecast).toHaveLength(30);

        // Verify SQLite tables
        const db = getDatabase();
        const runRow = db.prepare('SELECT * FROM forecast_runs WHERE id = ?').get(res.data.forecastId) as any;
        expect(runRow).toBeDefined();
        expect(runRow.organization_id).toBe(DEFAULT_ORG);
        expect(runRow.horizon_days).toBe(30);
        expect(runRow.scenario_type).toBe('expected');

        const dailyCount = db.prepare('SELECT COUNT(*) as c FROM forecast_daily_projections WHERE forecast_run_id = ?').get(res.data.forecastId) as any;
        expect(dailyCount.c).toBe(30);

        const currentRuns = DatabaseService.getStats().tableCounts.forecast_runs;
        expect(currentRuns).toBe(initialRuns + 1);
      }
    });
  });

  describe('Reset Demo Dataset Engine', () => {
    it('clears all ad-hoc mutations and restores pristine baseline dataset', () => {
      // Add custom ad-hoc transaction
      DatabaseService.createTransaction({
        amount: 999999,
        type: 'inflow',
        category: 'Other',
        counterparty: 'Temporary Ghost Counterparty',
        notes: 'Will be wiped by reset',
      }, DEFAULT_ORG);

      // Confirm presence
      const db = getDatabase();
      const preCount = db.prepare('SELECT COUNT(*) as c FROM financial_transactions WHERE counterparty = ?').get('Temporary Ghost Counterparty') as any;
      expect(preCount.c).toBe(1);

      // Trigger reset
      const resetResult = DatabaseService.resetDatabase(DEFAULT_ORG);
      expect(resetResult.businessProfile.name).toBe('Prism Wholesale & Retail Supplies');

      // Verify ghost record was wiped
      const postCount = db.prepare('SELECT COUNT(*) as c FROM financial_transactions WHERE counterparty = ?').get('Temporary Ghost Counterparty') as any;
      expect(postCount.c).toBe(0);

      // Verify standard demo transactions restored
      expect(resetResult.transactions.length).toBeGreaterThanOrEqual(5);
    });
  });
});
