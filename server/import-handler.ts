/**
 * Financial Ingestion & Import API Route Handlers
 * CashFlow Intelligence — Phase 3: Transaction Import & Financial Data Quality
 */

import { FinancialImportService, CsvColumnMapping } from '../src/services/import-service';
import { DataQualityService } from '../src/services/data-quality-service';
import { CategorizationService, TransactionCategoryName } from '../src/services/categorization-service';
import type { Database } from '../src/types/database';

type TransactionRow = Database['public']['Tables']['financial_transactions']['Row'];
type ImportHistoryRow = Database['public']['Tables']['import_history']['Row'];
type ReceivableRow = Database['public']['Tables']['accounts_receivable']['Row'];
type PayableRow = Database['public']['Tables']['accounts_payable']['Row'];

import { getDatabase } from './db';

// In-memory tenant store (fallback / dev cache synced with persistent database)
export const inMemoryStore = {
  transactions: new Map<string, TransactionRow[]>(),
  importHistory: new Map<string, ImportHistoryRow[]>(),
  receivables: new Map<string, ReceivableRow[]>(),
  payables: new Map<string, PayableRow[]>(),
  auditLogs: [] as any[],
};

const DEFAULT_ORG_ID = '11111111-1111-1111-1111-111111111111';

function getOrgTransactions(orgId: string): TransactionRow[] {
  if (!inMemoryStore.transactions.has(orgId) || inMemoryStore.transactions.get(orgId)!.length === 0) {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT * FROM financial_transactions WHERE organization_id = ? ORDER BY transaction_date DESC').all(orgId) as any[];
      if (rows && rows.length > 0) {
        const txs: TransactionRow[] = rows.map((r) => ({
          id: r.id,
          organization_id: r.organization_id,
          bank_account_id: r.bank_account_id,
          transaction_type: r.transaction_type,
          category: r.category,
          description: r.description || '',
          amount: r.amount,
          transaction_date: r.transaction_date,
          settlement_date: r.settlement_date,
          counterparty: r.counterparty,
          reference_number: r.reference_number,
          status: r.status,
          source: r.source,
          is_recurring: Boolean(r.is_recurring),
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));
        inMemoryStore.transactions.set(orgId, txs);
        return txs;
      }
    } catch (e) {
      console.warn('Could not read transactions from SQLite:', e);
    }
    if (!inMemoryStore.transactions.has(orgId)) {
      inMemoryStore.transactions.set(orgId, []);
    }
  }
  return inMemoryStore.transactions.get(orgId)!;
}

function getOrgImportHistory(orgId: string): ImportHistoryRow[] {
  if (!inMemoryStore.importHistory.has(orgId)) {
    inMemoryStore.importHistory.set(orgId, []);
  }
  return inMemoryStore.importHistory.get(orgId)!;
}

function getOrgReceivables(orgId: string): ReceivableRow[] {
  if (!inMemoryStore.receivables.has(orgId) || inMemoryStore.receivables.get(orgId)!.length === 0) {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT * FROM accounts_receivable WHERE organization_id = ? ORDER BY due_date ASC').all(orgId) as any[];
      if (rows && rows.length > 0) {
        const ars: ReceivableRow[] = rows.map((r) => ({
          id: r.id,
          organization_id: r.organization_id,
          customer_id: r.customer_id,
          invoice_number: r.invoice_number,
          invoice_date: r.issue_date || r.invoice_date,
          due_date: r.due_date,
          invoice_amount: r.amount || r.invoice_amount,
          outstanding_amount: (r.amount || r.invoice_amount) - (r.paid_amount || 0),
          expected_collection_date: r.expected_collection_date,
          status: r.status,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));
        inMemoryStore.receivables.set(orgId, ars);
        return ars;
      }
    } catch {}
    if (!inMemoryStore.receivables.has(orgId)) {
      inMemoryStore.receivables.set(orgId, []);
    }
  }
  return inMemoryStore.receivables.get(orgId)!;
}

function getOrgPayables(orgId: string): PayableRow[] {
  if (!inMemoryStore.payables.has(orgId) || inMemoryStore.payables.get(orgId)!.length === 0) {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT * FROM accounts_payable WHERE organization_id = ? ORDER BY due_date ASC').all(orgId) as any[];
      if (rows && rows.length > 0) {
        const aps: PayableRow[] = rows.map((r) => ({
          id: r.id,
          organization_id: r.organization_id,
          supplier_id: r.supplier_id,
          invoice_number: r.bill_number || r.invoice_number,
          invoice_date: r.bill_date || r.invoice_date,
          due_date: r.due_date,
          invoice_amount: r.amount || r.invoice_amount,
          outstanding_amount: r.amount || r.outstanding_amount,
          expected_payment_date: r.scheduled_payment_date || r.expected_payment_date,
          status: r.status,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));
        inMemoryStore.payables.set(orgId, aps);
        return aps;
      }
    } catch {}
    if (!inMemoryStore.payables.has(orgId)) {
      inMemoryStore.payables.set(orgId, []);
    }
  }
  return inMemoryStore.payables.get(orgId)!;
}

/**
 * 1. POST /api/imports/preview
 */
export async function handleImportPreview(payload: {
  organizationId?: string;
  fileName: string;
  fileSize: number;
  csvText: string;
  customMapping?: CsvColumnMapping;
}) {
  const orgId = payload.organizationId || DEFAULT_ORG_ID;

  // File validation
  const fileCheck = FinancialImportService.validateUploadedFile({
    name: payload.fileName,
    size: payload.fileSize,
  });

  if (!fileCheck.isValid) {
    return {
      success: false,
      error: {
        code: 'INVALID_FILE',
        message: fileCheck.error,
      },
    };
  }

  const { headers, rows } = FinancialImportService.parseCsv(payload.csvText);
  if (rows.length === 0) {
    return {
      success: false,
      error: {
        code: 'EMPTY_FILE',
        message: 'No data records found in CSV file.',
      },
    };
  }

  const mapping = payload.customMapping || FinancialImportService.detectColumnMapping(headers);

  // Build existing fingerprints set
  const existingTxs = getOrgTransactions(orgId);
  const existingFingerprints = new Set<string>();
  const existingLooseFingerprints = new Set<string>();

  for (const tx of existingTxs) {
    const { exactFingerprint, looseFingerprint } = FinancialImportService.generateFingerprints(
      orgId,
      tx.transaction_date,
      tx.amount,
      tx.counterparty,
      tx.reference_number
    );
    existingFingerprints.add(exactFingerprint);
    existingLooseFingerprints.add(looseFingerprint);
  }

  const preview = FinancialImportService.processTransactionImportBatch(
    orgId,
    rows,
    mapping,
    existingFingerprints,
    existingLooseFingerprints
  );

  return {
    success: true,
    data: preview,
  };
}

/**
 * 2. POST /api/imports/confirm
 */
export async function handleImportConfirm(payload: {
  organizationId?: string;
  userId?: string;
  fileName: string;
  fileSize: number;
  candidates: any[];
  userRole?: string;
}) {
  const orgId = payload.organizationId || DEFAULT_ORG_ID;

  // Authorization check: viewers cannot import
  if (payload.userRole === 'viewer') {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Viewer role lacks authorization to modify financial ledger records.',
      },
    };
  }

  const importId = `imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const validCandidates = (payload.candidates || []).filter(
    (c: any) =>
      (c.status === 'valid' || c.status === 'warning' || (c.status === 'duplicate' && c.duplicateResolution === 'import_anyway')) &&
      c.parsed
  );

  const orgTxs = getOrgTransactions(orgId);
  const insertedTxs: TransactionRow[] = [];

  let totalInflows = 0;
  let totalOutflows = 0;

  for (const c of validCandidates) {
    const p = c.parsed;
    const finalCategory = c.userAssignedCategory || c.suggestedCategory || p.category;

    const newTx: TransactionRow = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      organization_id: orgId,
      bank_account_id: null,
      transaction_type: p.transaction_type,
      category: finalCategory,
      description: p.description || '',
      amount: p.amount,
      transaction_date: p.transaction_date,
      settlement_date: p.settlement_date || p.transaction_date,
      counterparty: p.counterparty,
      reference_number: p.reference_number || null,
      status: 'completed',
      source: 'csv_import',
      is_recurring: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (p.transaction_type === 'inflow') {
      totalInflows += p.amount;
    } else {
      totalOutflows += p.amount;
    }

    orgTxs.push(newTx);
    insertedTxs.push(newTx);
  }

  const historyRow: ImportHistoryRow = {
    id: importId,
    organization_id: orgId,
    user_id: payload.userId || null,
    file_name: payload.fileName,
    file_size: payload.fileSize,
    import_type: 'transactions',
    upload_timestamp: new Date().toISOString(),
    total_rows: payload.candidates?.length || 0,
    imported_rows: insertedTxs.length,
    rejected_rows: (payload.candidates?.length || 0) - insertedTxs.length,
    duplicate_rows: (payload.candidates || []).filter((c: any) => c.status === 'duplicate').length,
    warning_rows: (payload.candidates || []).filter((c: any) => c.status === 'warning').length,
    total_inflows: Math.round(totalInflows * 100) / 100,
    total_outflows: Math.round(totalOutflows * 100) / 100,
    net_cash_flow: Math.round((totalInflows - totalOutflows) * 100) / 100,
    status: insertedTxs.length > 0 ? 'completed' : 'failed',
    error_summary: {
      rejectedCount: (payload.candidates?.length || 0) - insertedTxs.length,
    },
    created_at: new Date().toISOString(),
  };

  getOrgImportHistory(orgId).unshift(historyRow);

  try {
    const db = getDatabase();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO financial_transactions (
        id, organization_id, bank_account_id, business_id, transaction_type, category,
        description, amount, currency, transaction_date, expected_date, actual_date,
        counterparty, invoice_id, reference_number, status, source, confidence, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const tx of insertedTxs) {
      insertStmt.run(
        tx.id,
        tx.organization_id,
        tx.bank_account_id || null,
        orgId,
        tx.transaction_type,
        tx.category,
        tx.description || '',
        tx.amount,
        'INR',
        tx.transaction_date,
        tx.settlement_date || tx.transaction_date,
        tx.settlement_date || null,
        tx.counterparty,
        null,
        tx.reference_number || null,
        tx.status,
        tx.source,
        1.0,
        tx.description || null,
        tx.created_at,
        tx.updated_at
      );
    }

    db.prepare(`
      INSERT OR REPLACE INTO import_history (
        id, organization_id, user_id, file_name, file_size, import_type, upload_timestamp,
        total_rows, imported_rows, rejected_rows, duplicate_rows, warning_rows,
        total_inflows, total_outflows, net_cash_flow, status, error_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      historyRow.id,
      historyRow.organization_id,
      historyRow.user_id || null,
      historyRow.file_name,
      historyRow.file_size,
      historyRow.import_type,
      historyRow.upload_timestamp,
      historyRow.total_rows,
      historyRow.imported_rows,
      historyRow.rejected_rows,
      historyRow.duplicate_rows,
      historyRow.warning_rows || 0,
      historyRow.total_inflows,
      historyRow.total_outflows,
      historyRow.net_cash_flow,
      historyRow.status,
      historyRow.error_summary ? JSON.stringify(historyRow.error_summary) : null,
      historyRow.created_at
    );
  } catch (e) {
    console.error('Failed to persist confirmed import to SQLite:', e);
  }

  // Audit Log
  inMemoryStore.auditLogs.unshift({
    id: `audit-${Date.now()}`,
    organization_id: orgId,
    action: 'CONFIRM_CSV_IMPORT',
    entity_type: 'import_history',
    entity_id: importId,
    previous_value: null,
    new_value: {
      imported_rows: insertedTxs.length,
      net_cash_flow: historyRow.net_cash_flow,
    },
    created_at: new Date().toISOString(),
  });

  return {
    success: true,
    data: {
      importId,
      importedCount: insertedTxs.length,
      totalInflows: historyRow.total_inflows,
      totalOutflows: historyRow.total_outflows,
      netCashFlow: historyRow.net_cash_flow,
      status: historyRow.status,
    },
  };
}

/**
 * 3. GET /api/imports
 */
export async function handleGetImportHistory(query: { organizationId?: string }) {
  const orgId = query.organizationId || DEFAULT_ORG_ID;
  return {
    success: true,
    data: getOrgImportHistory(orgId),
  };
}

/**
 * 4. GET /api/transactions
 */
export async function handleGetTransactions(query: {
  organizationId?: string;
  category?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const orgId = query.organizationId || DEFAULT_ORG_ID;
  let txs = [...getOrgTransactions(orgId)];

  if (query.category) {
    txs = txs.filter((t) => t.category.toLowerCase() === query.category!.toLowerCase());
  }
  if (query.type) {
    txs = txs.filter((t) => t.transaction_type === query.type);
  }
  if (query.startDate) {
    txs = txs.filter((t) => t.transaction_date >= query.startDate!);
  }
  if (query.endDate) {
    txs = txs.filter((t) => t.transaction_date <= query.endDate!);
  }

  // Sort by date desc
  txs.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 50;
  const startIndex = (page - 1) * limit;
  const paginated = txs.slice(startIndex, startIndex + limit);

  return {
    success: true,
    data: paginated,
    pagination: {
      total: txs.length,
      page,
      limit,
      totalPages: Math.ceil(txs.length / limit),
    },
  };
}

/**
 * 5. POST /api/transactions/:id/categorize
 */
export async function handleCategorizeTransaction(payload: {
  transactionId: string;
  organizationId?: string;
  category: TransactionCategoryName;
  userRole?: string;
}) {
  if (payload.userRole === 'viewer') {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Viewer role cannot recategorize transactions.' },
    };
  }

  const orgId = payload.organizationId || DEFAULT_ORG_ID;
  const txs = getOrgTransactions(orgId);
  const tx = txs.find((t) => t.id === payload.transactionId);

  if (!tx) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Transaction not found.' },
    };
  }

  const oldCat = tx.category;
  tx.category = payload.category;
  tx.updated_at = new Date().toISOString();

  // Audit log
  inMemoryStore.auditLogs.unshift({
    id: `audit-${Date.now()}`,
    organization_id: orgId,
    action: 'RECATEGORIZE_TRANSACTION',
    entity_type: 'financial_transactions',
    entity_id: tx.id,
    previous_value: { category: oldCat },
    new_value: { category: payload.category },
    created_at: new Date().toISOString(),
  });

  return {
    success: true,
    data: tx,
  };
}

/**
 * 6. POST /api/accounts-receivable/import
 */
export async function handleImportReceivables(payload: {
  organizationId?: string;
  csvText: string;
  userRole?: string;
}) {
  if (payload.userRole === 'viewer') {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Viewer role cannot import accounts receivable.' },
    };
  }

  const orgId = payload.organizationId || DEFAULT_ORG_ID;
  const { rows } = FinancialImportService.parseCsv(payload.csvText);
  const result = FinancialImportService.processReceivablesBatch(orgId, rows);

  const orgAr = getOrgReceivables(orgId);
  let importedCount = 0;

  for (const c of result.candidates) {
    if (c.parsed) {
      const newAr: ReceivableRow = {
        id: `ar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...c.parsed,
        status: c.parsed.status || 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      orgAr.push(newAr);
      importedCount++;
    }
  }

  return {
    success: true,
    data: {
      totalRows: rows.length,
      importedCount,
      errorCount: result.errorCount,
      totalAmount: result.totalAmount,
      totalOutstanding: result.totalOutstanding,
      overdueCount: result.overdueCount,
    },
  };
}

/**
 * 7. POST /api/accounts-payable/import
 */
export async function handleImportPayables(payload: {
  organizationId?: string;
  csvText: string;
  userRole?: string;
}) {
  if (payload.userRole === 'viewer') {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Viewer role cannot import accounts payable.' },
    };
  }

  const orgId = payload.organizationId || DEFAULT_ORG_ID;
  const { rows } = FinancialImportService.parseCsv(payload.csvText);
  const result = FinancialImportService.processPayablesBatch(orgId, rows);

  const orgAp = getOrgPayables(orgId);
  let importedCount = 0;

  for (const c of result.candidates) {
    if (c.parsed) {
      const newAp: PayableRow = {
        id: `ap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...c.parsed,
        status: c.parsed.status || 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      orgAp.push(newAp);
      importedCount++;
    }
  }

  return {
    success: true,
    data: {
      totalRows: rows.length,
      importedCount,
      errorCount: result.errorCount,
      totalAmount: result.totalAmount,
      totalOutstanding: result.totalOutstanding,
      overdueCount: result.overdueCount,
    },
  };
}

/**
 * 8. GET /api/data-quality/summary
 */
export async function handleGetDataQualitySummary(query: { organizationId?: string }) {
  const orgId = query.organizationId || DEFAULT_ORG_ID;
  const txs = getOrgTransactions(orgId);
  const receivables = getOrgReceivables(orgId);
  const payables = getOrgPayables(orgId);

  const metrics = DataQualityService.assessDataQuality(txs, receivables, payables);

  return {
    success: true,
    data: metrics,
  };
}
