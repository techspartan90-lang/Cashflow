/**
 * Financial Data Quality Tests
 * CashFlow Intelligence — Phase 3: Transaction Import & Financial Data Quality
 */

import { describe, it, expect } from 'vitest';
import { DataQualityService } from '../src/services/data-quality-service';
import type { Database } from '../src/types/database';

type TransactionRow = Database['public']['Tables']['financial_transactions']['Row'];
type ReceivableRow = Database['public']['Tables']['accounts_receivable']['Row'];
type PayableRow = Database['public']['Tables']['accounts_payable']['Row'];

function makeTx(overrides: Partial<TransactionRow>): TransactionRow {
  return {
    id: 'tx-1',
    organization_id: 'org-1',
    bank_account_id: null,
    transaction_type: 'inflow',
    category: 'Cash Sales',
    description: 'Daily Store Sales',
    amount: 5000,
    transaction_date: '2026-09-01',
    settlement_date: '2026-09-01',
    counterparty: 'Retail Counter',
    reference_number: 'REF-001',
    status: 'completed',
    source: 'manual',
    is_recurring: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

describe('DataQualityService', () => {
  it('computes 100% completeness score for complete pristine dataset', () => {
    const transactions = [
      makeTx({ id: 'tx-1', reference_number: 'REF-1', description: 'Store cash', counterparty: 'Walk-in Customers', transaction_date: '2026-09-01' }),
      makeTx({ id: 'tx-2', reference_number: 'REF-2', description: 'Online UPI', counterparty: 'Website Gateway', transaction_date: '2026-09-02' }),
    ];

    const metrics = DataQualityService.assessDataQuality(transactions, [], [], '2026-09-15');
    expect(metrics.completenessScorePercent).toBe(100);
    expect(metrics.overallHealthStatus).toBe('Healthy');
    expect(metrics.missingCategoriesCount).toBe(0);
    expect(metrics.missingReferencesCount).toBe(0);
  });

  it('detects missing categories, missing references, and penalizes completeness score', () => {
    const transactions = [
      makeTx({ id: 'tx-1', category: 'Uncategorized', reference_number: '' }),
      makeTx({ id: 'tx-2', category: 'Cash Sales', reference_number: 'REF-2' }),
    ];

    const metrics = DataQualityService.assessDataQuality(transactions, [], [], '2026-09-15');
    expect(metrics.missingCategoriesCount).toBe(1);
    expect(metrics.missingReferencesCount).toBe(1);
    // 2 rows * 6 checks = 12 total checks. 2 missing attributes -> (10/12) * 100 = 83%
    expect(metrics.completenessScorePercent).toBe(83);
    expect(metrics.overallHealthStatus).toBe('Needs Attention');
  });

  it('flags critical status when invalid non-positive monetary records are present', () => {
    const transactions = [
      makeTx({ id: 'tx-1', amount: -500 }), // Corrupted amount!
    ];

    const metrics = DataQualityService.assessDataQuality(transactions, [], [], '2026-09-15');
    expect(metrics.invalidRecordsCount).toBe(1);
    expect(metrics.overallHealthStatus).toBe('Critical Risk');
    expect(metrics.issues.some((i) => i.severity === 'critical')).toBe(true);
  });

  it('evaluates overdue receivables impairment and payables obligations', () => {
    const receivables: ReceivableRow[] = [
      {
        id: 'ar-1',
        organization_id: 'org-1',
        customer_id: 'cust-1',
        invoice_number: 'INV-1',
        invoice_date: '2026-08-01',
        due_date: '2026-08-20',
        invoice_amount: 150000,
        outstanding_amount: 150000,
        expected_collection_date: '2026-08-20',
        status: 'open',
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
    ];

    const payables: PayableRow[] = [
      {
        id: 'ap-1',
        organization_id: 'org-1',
        supplier_id: 'sup-1',
        invoice_number: 'BILL-1',
        invoice_date: '2026-08-10',
        due_date: '2026-08-25',
        invoice_amount: 80000,
        outstanding_amount: 80000,
        expected_payment_date: '2026-08-25',
        status: 'open',
        created_at: '2026-08-10T00:00:00Z',
        updated_at: '2026-08-10T00:00:00Z',
      },
    ];

    const metrics = DataQualityService.assessDataQuality([], receivables, payables, '2026-09-15');
    expect(metrics.overdueReceivablesCount).toBe(1);
    expect(metrics.overdueReceivablesAmount).toBe(150000);
    expect(metrics.overduePayablesCount).toBe(1);
    expect(metrics.overduePayablesAmount).toBe(80000);
  });
});
