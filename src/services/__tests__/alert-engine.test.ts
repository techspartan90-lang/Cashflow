/**
 * Alert Engine & Deduplication Test Suite
 * Validates deterministic fingerprint generation, duplicate prevention,
 * and evidence-based alert generation rules.
 */
import { describe, it, expect } from 'vitest';
import { AlertEngine } from '../alert-engine';

describe('AlertEngine Deduplication', () => {
  const orgId = 'org-test-alert-001';

  it('generates deterministic fingerprints for identical financial alert events', () => {
    const fp1 = AlertEngine.calculateFingerprint(
      orgId,
      'projected_cash_shortfall',
      'forecast_day',
      'day-2026-09-28',
      '2026-09-28',
      'deficit_25000'
    );

    const fp2 = AlertEngine.calculateFingerprint(
      orgId,
      'projected_cash_shortfall',
      'forecast_day',
      'day-2026-09-28',
      '2026-09-28',
      'deficit_25000'
    );

    expect(fp1).toBe(fp2);
    expect(fp1).toContain('projected_cash_shortfall');
    expect(fp1).toContain('2026-09-28');
  });

  it('generates distinct fingerprints for different dates or amounts', () => {
    const fpA = AlertEngine.calculateFingerprint(
      orgId,
      'projected_cash_shortfall',
      'forecast_day',
      'day-2026-09-28',
      '2026-09-28',
      'deficit_25000'
    );

    const fpB = AlertEngine.calculateFingerprint(
      orgId,
      'projected_cash_shortfall',
      'forecast_day',
      'day-2026-09-29',
      '2026-09-29',
      'deficit_35000'
    );

    expect(fpA).not.toBe(fpB);
  });

  it('evaluates overdue receivables without generating duplicates if fingerprint matches existing active alert', () => {
    const fp = AlertEngine.calculateFingerprint(
      orgId,
      'overdue_receivable',
      'accounts_receivable',
      'rec-100',
      '2026-09-10'
    );

    const existingAlerts = [
      {
        id: 'alert-existing-1',
        organization_id: orgId,
        alert_type: 'overdue_receivable',
        severity: 'high',
        title: 'Overdue Receivable: INV-100',
        fingerprint: fp,
        status: 'active',
        created_at: '2026-09-20T00:00:00Z',
        updated_at: '2026-09-20T00:00:00Z',
      } as any,
    ];

    const result = AlertEngine.evaluateAll({
      organizationId: orgId,
      asOfDate: '2026-09-23',
      receivables: [
        {
          id: 'rec-100',
          customer_id: 'cust-1',
          invoice_number: 'INV-100',
          invoice_amount: 50000,
          outstanding_amount: 50000,
          due_date: '2026-09-10', // 13 days overdue
          status: 'overdue',
        },
      ],
      existingAlerts,
    });

    // The alert for rec-100 is deduplicated
    expect(result.newAlerts.length).toBe(0);
    expect(result.activeAlerts.length).toBe(1);
  });
});
