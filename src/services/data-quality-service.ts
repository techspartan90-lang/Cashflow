/**
 * Financial Data Quality Audit & Assessment Service
 * CashFlow Intelligence — Phase 3: Transaction Import & Financial Data Quality
 *
 * Evaluates completeness, consistency, and integrity across the financial ledger.
 */

import { MonetaryMath } from './financial-calculator';
import type { Database } from '../types/database';

type TransactionRow = Database['public']['Tables']['financial_transactions']['Row'];
type ReceivableRow = Database['public']['Tables']['accounts_receivable']['Row'];
type PayableRow = Database['public']['Tables']['accounts_payable']['Row'];

export interface DataQualityIssue {
  severity: 'informational' | 'warning' | 'critical';
  title: string;
  description: string;
  affectedCount: number;
  remediationAction: string;
}

export interface DataQualityMetrics {
  totalTransactions: number;
  missingCategoriesCount: number;
  missingReferencesCount: number;
  missingDescriptionsCount: number;
  missingDatesCount: number;
  duplicateCandidatesCount: number;
  invalidRecordsCount: number;

  totalReceivablesCount: number;
  outstandingReceivablesAmount: number;
  overdueReceivablesCount: number;
  overdueReceivablesAmount: number;

  totalPayablesCount: number;
  outstandingPayablesAmount: number;
  overduePayablesCount: number;
  overduePayablesAmount: number;

  completenessScorePercent: number; // 0 to 100
  completenessCalculationFormula: string;
  overallHealthStatus: 'Healthy' | 'Needs Attention' | 'Critical Risk';
  issues: DataQualityIssue[];
}

export class DataQualityService {
  /**
   * Evaluates the active dataset for integrity, missing metadata, and liquidity exposure
   */
  static assessDataQuality(
    transactions: readonly TransactionRow[],
    receivables: readonly ReceivableRow[] = [],
    payables: readonly PayableRow[] = [],
    asOfDate: string = new Date().toISOString().slice(0, 10)
  ): DataQualityMetrics {
    const issues: DataQualityIssue[] = [];

    let missingCategories = 0;
    let missingReferences = 0;
    let missingDescriptions = 0;
    let missingDates = 0;
    let invalidRecords = 0;

    const seenFingerprints = new Map<string, number>();

    // 1. Transaction evaluation
    for (const tx of transactions) {
      if (!tx.category || tx.category === 'Uncategorized' || tx.category === 'General') {
        missingCategories++;
      }
      if (!tx.reference_number || tx.reference_number.trim() === '') {
        missingReferences++;
      }
      if (!tx.description || tx.description.trim() === '') {
        missingDescriptions++;
      }
      if (!tx.transaction_date) {
        missingDates++;
      }
      if (typeof tx.amount !== 'number' || tx.amount <= 0 || isNaN(tx.amount)) {
        invalidRecords++;
      }

      // Check duplicates
      const fp = `${tx.transaction_date}|${tx.amount}|${(tx.counterparty || '').toLowerCase().trim()}`;
      seenFingerprints.set(fp, (seenFingerprints.get(fp) || 0) + 1);
    }

    let duplicateCandidates = 0;
    for (const count of seenFingerprints.values()) {
      if (count > 1) {
        duplicateCandidates += count - 1;
      }
    }

    // 2. Receivables evaluation
    let outstandingArCents = 0;
    let overdueArCents = 0;
    let overdueArCount = 0;

    for (const ar of receivables) {
      if (ar.status === 'paid' || ar.status === 'cancelled') continue;
      const outstanding = MonetaryMath.toCents(ar.outstanding_amount);
      outstandingArCents += outstanding;

      const dueDate = ar.due_date.slice(0, 10);
      if (dueDate < asOfDate && outstanding > 0) {
        overdueArCount++;
        overdueArCents += outstanding;
      }
    }

    // 3. Payables evaluation
    let outstandingApCents = 0;
    let overdueApCents = 0;
    let overdueApCount = 0;

    for (const ap of payables) {
      if (ap.status === 'paid' || ap.status === 'cancelled') continue;
      const outstanding = MonetaryMath.toCents(ap.outstanding_amount);
      outstandingApCents += outstanding;

      const dueDate = ap.due_date.slice(0, 10);
      if (dueDate < asOfDate && outstanding > 0) {
        overdueApCount++;
        overdueApCents += outstanding;
      }
    }

    // 4. Data Completeness Percentage Calculation
    // Total monitored fields = date, amount, type, counterparty, category, reference
    const totalTransactions = transactions.length;
    let completenessScore = 100;

    if (totalTransactions > 0) {
      const totalRequiredFieldChecks = totalTransactions * 6;
      const missingFieldsTotal =
        missingDates +
        invalidRecords +
        missingCategories +
        missingReferences +
        missingDescriptions;

      const validChecks = Math.max(0, totalRequiredFieldChecks - missingFieldsTotal);
      completenessScore = Math.round((validChecks / totalRequiredFieldChecks) * 100);
    }

    // 5. Synthesize Issues & Severity
    if (invalidRecords > 0) {
      issues.push({
        severity: 'critical',
        title: 'Corrupted Monetary Amounts Detected',
        description: `${invalidRecords} transactions have non-numeric or non-positive amounts.`,
        affectedCount: invalidRecords,
        remediationAction: 'Audit and correct transaction amount values to prevent forecast distortion.',
      });
    }

    if (overdueArCount > 0) {
      const overdueArAmt = MonetaryMath.fromCents(overdueArCents);
      issues.push({
        severity: overdueArAmt > 100000 ? 'critical' : 'warning',
        title: 'Overdue Accounts Receivable Impairment',
        description: `${overdueArCount} invoices totaling ₹${overdueArAmt.toLocaleString('en-IN')} are past due.`,
        affectedCount: overdueArCount,
        remediationAction: 'Initiate collection escalation to protect forward working capital.',
      });
    }

    if (overdueApCount > 0) {
      const overdueApAmt = MonetaryMath.fromCents(overdueApCents);
      issues.push({
        severity: 'warning',
        title: 'Overdue Accounts Payable Detected',
        description: `${overdueApCount} supplier bills totaling ₹${overdueApAmt.toLocaleString('en-IN')} have passed due date.`,
        affectedCount: overdueApCount,
        remediationAction: 'Reschedule or execute vendor settlement to maintain credit terms.',
      });
    }

    if (missingCategories > 0) {
      issues.push({
        severity: missingCategories > totalTransactions * 0.2 ? 'warning' : 'informational',
        title: 'Uncategorized Cash Movements',
        description: `${missingCategories} transactions lack explicit operational category classification.`,
        affectedCount: missingCategories,
        remediationAction: 'Run auto-categorization engine or assign heads manually.',
      });
    }

    if (missingReferences > 0) {
      issues.push({
        severity: 'informational',
        title: 'Missing Reference Identifiers',
        description: `${missingReferences} transactions have no UTR, check, or bank reference number.`,
        affectedCount: missingReferences,
        remediationAction: 'Include bank transaction references to improve automated duplicate detection.',
      });
    }

    if (duplicateCandidates > 0) {
      issues.push({
        severity: 'warning',
        title: 'Potential Duplicate Transactions',
        description: `${duplicateCandidates} transactions share identical date, amount, and counterparty.`,
        affectedCount: duplicateCandidates,
        remediationAction: 'Review staged duplicates before finalizing reconciliation.',
      });
    }

    let overallHealthStatus: 'Healthy' | 'Needs Attention' | 'Critical Risk' = 'Healthy';
    if (issues.some((i) => i.severity === 'critical') || completenessScore < 70) {
      overallHealthStatus = 'Critical Risk';
    } else if (issues.some((i) => i.severity === 'warning') || completenessScore < 85) {
      overallHealthStatus = 'Needs Attention';
    }

    return {
      totalTransactions,
      missingCategoriesCount: missingCategories,
      missingReferencesCount: missingReferences,
      missingDescriptionsCount: missingDescriptions,
      missingDatesCount: missingDates,
      duplicateCandidatesCount: duplicateCandidates,
      invalidRecordsCount: invalidRecords,

      totalReceivablesCount: receivables.length,
      outstandingReceivablesAmount: MonetaryMath.fromCents(outstandingArCents),
      overdueReceivablesCount: overdueArCount,
      overdueReceivablesAmount: MonetaryMath.fromCents(overdueArCents),

      totalPayablesCount: payables.length,
      outstandingPayablesAmount: MonetaryMath.fromCents(outstandingApCents),
      overduePayablesCount: overdueApCount,
      overduePayablesAmount: MonetaryMath.fromCents(overdueApCents),

      completenessScorePercent: completenessScore,
      completenessCalculationFormula:
        'Completeness (%) = ((Total Monitored Checks [6 per row] - Missing/Invalid Attributes) / Total Monitored Checks) * 100',
      overallHealthStatus,
      issues,
    };
  }
}
