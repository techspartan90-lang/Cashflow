/**
 * CashFlow Intelligence — Persistent SQLite Database Engine
 * Implements full schema, seed initialization, and CRUD operations for all financial models.
 * Uses native Node.js 22 node:sqlite (DatabaseSync) with WAL mode for fast synchronous ACID operations.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEMO_CONFIG,
  DEMO_CUSTOMERS,
  DEMO_AR_INVOICES,
  DEMO_AP_INVOICES,
  DEMO_OPERATING_EXPENSES,
  DEMO_INVENTORY_ITEMS,
  DEMO_LOANS,
  DEMO_TAXES,
  DEMO_TRANSACTIONS,
  DEMO_VARIANCE_RECORDS,
  DEMO_RECOMMENDATIONS,
} from '../src/data/demo-dataset';
import type {
  FinancialTransaction,
  SalesInvoiceAR,
  PurchaseInvoiceAP,
  OperatingExpense,
  InventoryItem,
  LoanObligation,
  TaxObligation,
  VarianceDayRecord,
  ActionableRecommendation,
  FinancialAlert,
} from '../src/types/financial';

const DEFAULT_SUPPLIERS = [
  { id: 'sup_01', name: 'Bharat Agro Processing Mills', paymentTermsDays: 30, reliabilityRating: 'High' },
  { id: 'sup_02', name: 'Om Packaging & Corrugated Containers', paymentTermsDays: 21, reliabilityRating: 'High' },
  { id: 'sup_03', name: 'Delta Cold Chain Logistics', paymentTermsDays: 15, reliabilityRating: 'High' },
  { id: 'sup_04', name: 'Hindustan Fast Moving Goods Corp', paymentTermsDays: 30, reliabilityRating: 'High' },
  { id: 'sup_05', name: 'Vanguard Facility Cleaners & Supplies', paymentTermsDays: 30, reliabilityRating: 'High' },
];

const DATA_DIR = path.resolve(import.meta.dirname || '.', 'data');
const DB_PATH = path.join(DATA_DIR, 'cashflow.db');
const DEFAULT_ORG_ID = '11111111-1111-1111-1111-111111111111';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    initSchema(dbInstance);
    seedInitialDataIfEmpty(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      business_type TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      currency_symbol TEXT NOT NULL DEFAULT '₹',
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      opening_cash REAL NOT NULL DEFAULT 250000,
      minimum_cash_threshold REAL NOT NULL DEFAULT 100000,
      warning_cash_threshold REAL NOT NULL DEFAULT 150000,
      material_deviation_threshold REAL NOT NULL DEFAULT 50000,
      forecast_start_date TEXT NOT NULL DEFAULT '2026-09-23',
      forecast_horizon_days INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      opening_balance REAL NOT NULL,
      current_balance REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      payment_terms_days INTEGER NOT NULL DEFAULT 30,
      historical_delay_days REAL NOT NULL DEFAULT 0,
      reliability_score REAL NOT NULL DEFAULT 1.0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      payment_terms_days INTEGER NOT NULL DEFAULT 30,
      historical_delay_days REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS financial_transactions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      bank_account_id TEXT,
      business_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      transaction_date TEXT NOT NULL,
      expected_date TEXT NOT NULL,
      actual_date TEXT,
      counterparty TEXT NOT NULL,
      invoice_id TEXT,
      reference_number TEXT,
      status TEXT NOT NULL DEFAULT 'cleared',
      source TEXT NOT NULL DEFAULT 'manual',
      confidence REAL NOT NULL DEFAULT 1.0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts_receivable (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      expected_collection_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'outstanding',
      payment_terms_days INTEGER NOT NULL DEFAULT 30,
      historical_avg_delay_days REAL NOT NULL DEFAULT 0,
      collection_probability REAL NOT NULL DEFAULT 0.9,
      aging_bucket TEXT NOT NULL DEFAULT 'current',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts_payable (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      bill_number TEXT NOT NULL,
      amount REAL NOT NULL,
      bill_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      scheduled_payment_date TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      category TEXT NOT NULL DEFAULT 'raw_materials',
      status TEXT NOT NULL DEFAULT 'unpaid',
      discount_terms TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operating_expenses (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'fixed',
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      due_day_of_month INTEGER,
      next_due_date TEXT NOT NULL,
      is_mandatory INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      current_stock REAL NOT NULL,
      unit_cost REAL NOT NULL,
      monthly_demand_forecast REAL NOT NULL,
      safety_stock REAL NOT NULL,
      reorder_point REAL NOT NULL,
      supplier_lead_time_days INTEGER NOT NULL,
      supplier_name TEXT NOT NULL,
      payment_terms_days INTEGER NOT NULL,
      planned_purchase_quantity REAL NOT NULL,
      planned_purchase_date TEXT NOT NULL,
      annual_carrying_rate_percent REAL NOT NULL DEFAULT 20.0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loan_obligations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      lender_name TEXT NOT NULL,
      loan_type TEXT NOT NULL,
      principal_remaining REAL NOT NULL,
      annual_interest_rate REAL NOT NULL,
      monthly_emi REAL NOT NULL,
      principal_portion REAL NOT NULL,
      interest_portion REAL NOT NULL,
      due_day_of_month INTEGER NOT NULL,
      next_due_date TEXT NOT NULL,
      remaining_tenure_months INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tax_obligations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      tax_type TEXT NOT NULL,
      period TEXT NOT NULL,
      estimated_obligation REAL NOT NULL,
      confirmed_obligation REAL NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'provisioned',
      mandate_level TEXT NOT NULL DEFAULT 'statutory_mandatory',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_cash_flows (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      flow_type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      next_occurrence_date TEXT NOT NULL,
      end_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS variance_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      date TEXT NOT NULL,
      forecast_net_cash REAL NOT NULL,
      actual_net_cash REAL NOT NULL,
      cash_flow_variance REAL NOT NULL,
      forecast_ending_cash REAL NOT NULL,
      actual_ending_cash REAL NOT NULL,
      balance_variance REAL NOT NULL,
      primary_deviation_category TEXT NOT NULL,
      deviation_reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      priority TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      rationale TEXT NOT NULL,
      financial_impact REAL NOT NULL,
      confidence_level REAL NOT NULL,
      actionable_steps TEXT NOT NULL,
      is_implemented INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS financial_alerts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      fingerprint TEXT,
      related_entity_type TEXT,
      related_entity_id TEXT,
      related_date TEXT,
      forecast_id TEXT,
      trigger_data TEXT,
      recommended_review_action TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      acknowledged_at TEXT,
      resolved_at TEXT,
      dismissed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      description TEXT,
      rule_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      threshold_value REAL NOT NULL,
      condition_operator TEXT NOT NULL,
      lookahead_days INTEGER NOT NULL DEFAULT 30,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forecast_runs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      forecast_version INTEGER NOT NULL,
      scenario_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      horizon_days INTEGER NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      opening_cash REAL NOT NULL,
      minimum_cash_threshold REAL NOT NULL,
      total_expected_inflows REAL NOT NULL,
      total_expected_outflows REAL NOT NULL,
      net_cash_flow REAL NOT NULL,
      minimum_projected_cash REAL NOT NULL,
      shortfall_days INTEGER NOT NULL DEFAULT 0,
      risk_level TEXT NOT NULL DEFAULT 'low',
      assumptions_snapshot TEXT,
      calculation_status TEXT NOT NULL DEFAULT 'completed',
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forecast_daily_projections (
      id TEXT PRIMARY KEY,
      forecast_run_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      day_index INTEGER NOT NULL,
      projection_date TEXT NOT NULL,
      beginning_cash REAL NOT NULL,
      expected_inflows REAL NOT NULL,
      expected_outflows REAL NOT NULL,
      net_cash_flow REAL NOT NULL,
      ending_cash REAL NOT NULL,
      minimum_threshold REAL NOT NULL,
      threshold_status TEXT NOT NULL,
      shortfall_deficit REAL NOT NULL DEFAULT 0,
      risk_factors TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forecast_items (
      id TEXT PRIMARY KEY,
      forecast_run_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      flow_type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      source TEXT NOT NULL,
      description TEXT NOT NULL,
      certainty TEXT NOT NULL,
      entity_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forecast_scenarios (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      base_forecast_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      scenario_type TEXT NOT NULL DEFAULT 'custom',
      status TEXT NOT NULL DEFAULT 'draft',
      result_status TEXT NOT NULL DEFAULT 'none',
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scenario_assumptions (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      assumption_type TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT 'all',
      target_id TEXT,
      adjustment_method TEXT NOT NULL DEFAULT 'percentage_change',
      adjustment_value REAL NOT NULL,
      start_date TEXT,
      end_date TEXT,
      description TEXT,
      source TEXT NOT NULL DEFAULT 'user_defined',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_history (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      import_type TEXT NOT NULL,
      upload_timestamp TEXT NOT NULL,
      total_rows INTEGER NOT NULL,
      imported_rows INTEGER NOT NULL,
      rejected_rows INTEGER NOT NULL,
      duplicate_rows INTEGER NOT NULL,
      warning_rows INTEGER NOT NULL DEFAULT 0,
      total_inflows REAL NOT NULL DEFAULT 0,
      total_outflows REAL NOT NULL DEFAULT 0,
      net_cash_flow REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error_summary TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      previous_value TEXT,
      new_value TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
}

function seedInitialDataIfEmpty(db: DatabaseSync) {
  const rowCount = db.prepare('SELECT COUNT(*) as cnt FROM organizations WHERE id = ?').get(DEFAULT_ORG_ID) as { cnt: number };
  if (rowCount.cnt > 0) return;

  const now = new Date().toISOString();

  // 1. Organization
  db.prepare(`
    INSERT OR REPLACE INTO organizations (
      id, name, business_type, currency, currency_symbol, timezone,
      opening_cash, minimum_cash_threshold, warning_cash_threshold,
      material_deviation_threshold, forecast_start_date, forecast_horizon_days,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    DEFAULT_ORG_ID,
    DEMO_CONFIG.businessName,
    'Wholesale & Retail Supplies',
    DEMO_CONFIG.currency,
    DEMO_CONFIG.currencySymbol,
    'Asia/Kolkata',
    DEMO_CONFIG.initialCash,
    DEMO_CONFIG.minimumCashThreshold,
    DEMO_CONFIG.warningCashThreshold,
    DEMO_CONFIG.materialDeviationThreshold,
    DEMO_CONFIG.forecastStartDate,
    DEMO_CONFIG.forecastHorizonDays,
    now,
    now
  );

  // 2. Bank Accounts
  const insertBankAcc = db.prepare(`
    INSERT OR REPLACE INTO bank_accounts (id, organization_id, account_name, account_type, opening_balance, current_balance, currency, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertBankAcc.run('acc-hdfc-01', DEFAULT_ORG_ID, 'HDFC Bank - Primary Operating', 'checking', 200000.0, 200000.0, 'INR', 1, now, now);
  insertBankAcc.run('acc-icici-02', DEFAULT_ORG_ID, 'ICICI Bank - Reserve & Payroll', 'savings', 50000.0, 50000.0, 'INR', 1, now, now);

  // 3. Customers
  const insertCustomer = db.prepare(`
    INSERT OR REPLACE INTO customers (id, organization_id, name, email, payment_terms_days, historical_delay_days, reliability_score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of DEMO_CUSTOMERS) {
    insertCustomer.run(c.id, DEFAULT_ORG_ID, c.name, null, c.paymentTermsDays, c.historicalDelayDays, c.riskRating === 'Low' ? 0.95 : c.riskRating === 'Medium' ? 0.85 : 0.7, now, now);
  }

  // 4. Suppliers
  const insertSupplier = db.prepare(`
    INSERT OR REPLACE INTO suppliers (id, organization_id, name, payment_terms_days, historical_delay_days, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of DEFAULT_SUPPLIERS) {
    insertSupplier.run(s.id, DEFAULT_ORG_ID, s.name, s.paymentTermsDays, s.reliabilityRating === 'High' ? 1 : 4, now, now);
  }

  // 5. Financial Transactions
  const insertTx = db.prepare(`
    INSERT OR REPLACE INTO financial_transactions (
      id, organization_id, bank_account_id, business_id, transaction_type, category,
      description, amount, currency, transaction_date, expected_date, actual_date,
      counterparty, invoice_id, reference_number, status, source, confidence, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const t of DEMO_TRANSACTIONS) {
    insertTx.run(
      t.id,
      DEFAULT_ORG_ID,
      'acc-hdfc-01',
      t.businessId,
      t.type,
      t.category,
      t.notes || '',
      t.amount,
      t.currency,
      t.transactionDate,
      t.expectedDate,
      t.actualDate || null,
      t.counterparty,
      t.invoiceId || null,
      null,
      t.status,
      t.source,
      t.confidence,
      t.notes || null,
      now,
      now
    );
  }

  // 6. Accounts Receivable (AR) Invoices
  const insertAr = db.prepare(`
    INSERT OR REPLACE INTO accounts_receivable (
      id, organization_id, customer_id, customer_name, invoice_number, amount,
      paid_amount, issue_date, due_date, expected_collection_date, status,
      payment_terms_days, historical_avg_delay_days, collection_probability,
      aging_bucket, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const inv of DEMO_AR_INVOICES) {
    insertAr.run(
      inv.id,
      DEFAULT_ORG_ID,
      inv.customerId,
      inv.customerName,
      inv.invoiceNumber,
      inv.amount,
      inv.paidAmount,
      inv.issueDate,
      inv.dueDate,
      inv.expectedCollectionDate,
      inv.status,
      inv.paymentTermsDays,
      inv.historicalAvgDelayDays,
      inv.collectionProbability,
      inv.agingBucket,
      inv.notes || null,
      now,
      now
    );
  }

  // 7. Accounts Payable (AP) Invoices
  const insertAp = db.prepare(`
    INSERT OR REPLACE INTO accounts_payable (
      id, organization_id, supplier_id, supplier_name, bill_number, amount,
      bill_date, due_date, scheduled_payment_date, priority, category,
      status, discount_terms, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const bill of DEMO_AP_INVOICES) {
    insertAp.run(
      bill.id,
      DEFAULT_ORG_ID,
      bill.supplierId,
      bill.supplierName,
      bill.billNumber,
      bill.amount,
      bill.billDate,
      bill.dueDate,
      bill.scheduledPaymentDate,
      bill.priority,
      bill.category,
      bill.status,
      bill.discountTerms ? JSON.stringify(bill.discountTerms) : null,
      null,
      now,
      now
    );
  }

  // 8. Operating Expenses
  const insertOpex = db.prepare(`
    INSERT OR REPLACE INTO operating_expenses (
      id, organization_id, name, type, category, amount, frequency,
      due_day_of_month, next_due_date, is_mandatory, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const opex of DEMO_OPERATING_EXPENSES) {
    insertOpex.run(
      opex.id,
      DEFAULT_ORG_ID,
      opex.name,
      opex.type,
      opex.category,
      opex.amount,
      opex.frequency,
      opex.dueDayOfMonth || null,
      opex.nextDueDate,
      opex.isMandatory ? 1 : 0,
      opex.notes || null,
      now,
      now
    );
  }

  // 9. Inventory Items
  const insertInventory = db.prepare(`
    INSERT OR REPLACE INTO inventory_items (
      id, organization_id, sku, name, current_stock, unit_cost,
      monthly_demand_forecast, safety_stock, reorder_point, supplier_lead_time_days,
      supplier_name, payment_terms_days, planned_purchase_quantity, planned_purchase_date,
      annual_carrying_rate_percent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of DEMO_INVENTORY_ITEMS) {
    insertInventory.run(
      item.id,
      DEFAULT_ORG_ID,
      item.sku,
      item.name,
      item.currentStock,
      item.unitCost,
      item.monthlyDemandForecast,
      item.safetyStock,
      item.reorderPoint,
      item.supplierLeadTimeDays,
      item.supplierName,
      item.paymentTermsDays,
      item.plannedPurchaseQuantity,
      item.plannedPurchaseDate,
      item.annualCarryingRatePercent,
      now,
      now
    );
  }

  // 10. Loan Obligations
  const insertLoan = db.prepare(`
    INSERT OR REPLACE INTO loan_obligations (
      id, organization_id, lender_name, loan_type, principal_remaining,
      annual_interest_rate, monthly_emi, principal_portion, interest_portion,
      due_day_of_month, next_due_date, remaining_tenure_months, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const loan of DEMO_LOANS) {
    insertLoan.run(
      loan.id,
      DEFAULT_ORG_ID,
      loan.lenderName,
      loan.loanType,
      loan.principalRemaining,
      loan.annualInterestRate,
      loan.monthlyEmi,
      loan.principalPortion,
      loan.interestPortion,
      loan.dueDayOfMonth,
      loan.nextDueDate,
      loan.remainingTenureMonths,
      now,
      now
    );
  }

  // 11. Tax Obligations
  const insertTax = db.prepare(`
    INSERT OR REPLACE INTO tax_obligations (
      id, organization_id, tax_type, period, estimated_obligation,
      confirmed_obligation, due_date, status, mandate_level, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const tax of DEMO_TAXES) {
    insertTax.run(
      tax.id,
      DEFAULT_ORG_ID,
      tax.taxType,
      tax.period,
      tax.estimatedObligation,
      tax.confirmedObligation,
      tax.dueDate,
      tax.status,
      tax.mandateLevel,
      now,
      now
    );
  }

  // 12. Recurring Cash Flows
  const insertRec = db.prepare(`
    INSERT OR REPLACE INTO recurring_cash_flows (
      id, organization_id, name, flow_type, category, amount, frequency,
      next_occurrence_date, end_date, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRec.run('rec-01', DEFAULT_ORG_ID, 'Warehouse & Office Lease', 'outflow', 'Rent', 45000.0, 'monthly', '2026-10-01', null, 1, now, now);
  insertRec.run('rec-02', DEFAULT_ORG_ID, 'Staff Payroll Disbursement', 'outflow', 'Salaries', 95000.0, 'monthly', '2026-09-30', null, 1, now, now);
  insertRec.run('rec-03', DEFAULT_ORG_ID, 'Commercial Fleet Fuel & Logistics', 'outflow', 'Transportation', 8500.0, 'weekly', '2026-09-26', null, 1, now, now);
  insertRec.run('rec-04', DEFAULT_ORG_ID, 'ERP & Cloud Subscriptions', 'outflow', 'Software Subscription', 12000.0, 'monthly', '2026-10-05', null, 1, now, now);
  insertRec.run('rec-05', DEFAULT_ORG_ID, 'Working Capital Loan EMI', 'outflow', 'Loan Repayment', 28500.0, 'monthly', '2026-10-10', null, 1, now, now);

  // 13. Variance Records
  const insertVar = db.prepare(`
    INSERT OR REPLACE INTO variance_records (
      id, organization_id, date, forecast_net_cash, actual_net_cash,
      cash_flow_variance, forecast_ending_cash, actual_ending_cash,
      balance_variance, primary_deviation_category, deviation_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (let i = 0; i < DEMO_VARIANCE_RECORDS.length; i++) {
    const vr = DEMO_VARIANCE_RECORDS[i];
    insertVar.run(
      `var-${i + 1}`,
      DEFAULT_ORG_ID,
      vr.date,
      vr.forecastNetCash,
      vr.actualNetCash,
      vr.cashFlowVariance,
      vr.forecastEndingCash,
      vr.actualEndingCash,
      vr.balanceVariance,
      vr.primaryDeviationCategory,
      vr.deviationReason,
      now
    );
  }

  // 14. Actionable Recommendations
  const insertRecPlay = db.prepare(`
    INSERT OR REPLACE INTO recommendations (
      id, organization_id, priority, category, title, rationale,
      financial_impact, confidence_level, actionable_steps, is_implemented,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of DEMO_RECOMMENDATIONS) {
    insertRecPlay.run(
      r.id,
      DEFAULT_ORG_ID,
      r.priority,
      r.category,
      r.title,
      r.rationale,
      r.financialImpact,
      r.confidenceLevel,
      JSON.stringify(r.actionableSteps),
      r.isImplemented ? 1 : 0,
      now,
      now
    );
  }

  // 15. Standard Alert Rules
  const insertRule = db.prepare(`
    INSERT OR REPLACE INTO alert_rules (
      id, organization_id, rule_name, description, rule_type, severity,
      threshold_value, condition_operator, lookahead_days, is_enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRule.run('rule-min-threshold', DEFAULT_ORG_ID, 'Minimum Cash Buffer Breach', 'Alerts when ending cash falls below safety floor', 'threshold_breach', 'critical', 100000.0, 'LESS_THAN', 30, 1, now, now);
  insertRule.run('rule-heavy-outflow', DEFAULT_ORG_ID, 'Heavy Single-Day Outflow Concentration', 'Flags days with combined disbursements exceeding ₹120,000', 'large_outflow', 'warning', 120000.0, 'GREATER_THAN', 30, 1, now, now);
  insertRule.run('rule-tax-due', DEFAULT_ORG_ID, 'Imminent Statutory Tax Settlement', 'Notifies 3 days prior to GST or Advance Tax obligation', 'large_outflow', 'warning', 50000.0, 'GREATER_THAN', 7, 1, now, now);

  // 16. Initial Baseline Scenarios
  const insertScen = db.prepare(`
    INSERT OR REPLACE INTO forecast_scenarios (
      id, organization_id, base_forecast_id, name, description, scenario_type,
      status, result_status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertScen.run('scen-expected', DEFAULT_ORG_ID, 'fc-v1', 'Deterministic Baseline (Expected)', 'Standard operations reflecting existing collection lags and invoice payment dates', 'baseline', 'approved', 'ready', null, now, now);
  insertScen.run('scen-optimistic', DEFAULT_ORG_ID, 'fc-v1', 'Optimistic (Sales +15%, Collections -3d)', 'Accelerated customer collections and higher demand', 'optimistic', 'draft', 'ready', null, now, now);
  insertScen.run('scen-pessimistic', DEFAULT_ORG_ID, 'fc-v1', 'Stress Test (Sales -15%, Collections +7d)', 'Stressed working capital window with collection delays and higher expense buffer', 'stress_test', 'draft', 'ready', null, now, now);

  // 17. Seed Initial Notifications
  const insertNotif = db.prepare(`
    INSERT OR REPLACE INTO notifications (id, organization_id, type, title, message, link, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertNotif.run('notif-1', DEFAULT_ORG_ID, 'alert', 'Cash Buffer Alert', 'Projected cash approaches minimum threshold around Oct 1-5.', '/alerts', 0, now);
  insertNotif.run('notif-2', DEFAULT_ORG_ID, 'recommendation', 'Action Play Available', 'Stagger Bharat Agro bill to preserve ₹67,500 working capital buffer.', '/recommendations', 0, now);
}

// ==============================================================================
// PUBLIC DATABASE API & CRUD METHODS
// ==============================================================================

export const DatabaseService = {
  getStats() {
    const db = getDatabase();
    const tables = [
      'organizations',
      'bank_accounts',
      'financial_transactions',
      'customers',
      'accounts_receivable',
      'suppliers',
      'accounts_payable',
      'operating_expenses',
      'inventory_items',
      'loan_obligations',
      'tax_obligations',
      'recurring_cash_flows',
      'forecast_runs',
      'forecast_daily_projections',
      'forecast_scenarios',
      'financial_alerts',
      'variance_records',
      'recommendations',
      'import_history',
    ];

    const counts: Record<string, number> = {};
    let totalRows = 0;
    for (const t of tables) {
      try {
        const r = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as { c: number };
        counts[t] = r.c;
        totalRows += r.c;
      } catch {
        counts[t] = 0;
      }
    }

    let fileSize = 0;
    try {
      const stats = fs.statSync(DB_PATH);
      fileSize = stats.size;
    } catch {}

    return {
      connected: true,
      engine: 'SQLite (Node.js 22 node:sqlite)',
      databasePath: DB_PATH,
      fileSizeBytes: fileSize,
      fileSizeFormatted: `${(fileSize / 1024).toFixed(1)} KB`,
      totalRows,
      tableCounts: counts,
      timestamp: new Date().toISOString(),
    };
  },

  getBootstrapData(orgId: string = DEFAULT_ORG_ID) {
    const db = getDatabase();

    const orgRow = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId) as any || {
      name: DEMO_CONFIG.businessName,
      business_type: 'Wholesale & Retail Supplies',
      currency: DEMO_CONFIG.currency,
      currency_symbol: DEMO_CONFIG.currencySymbol,
      timezone: 'Asia/Kolkata',
      opening_cash: DEMO_CONFIG.initialCash,
      minimum_cash_threshold: DEMO_CONFIG.minimumCashThreshold,
      warning_cash_threshold: DEMO_CONFIG.warningCashThreshold,
      material_deviation_threshold: DEMO_CONFIG.materialDeviationThreshold,
      forecast_start_date: DEMO_CONFIG.forecastStartDate,
      forecast_horizon_days: DEMO_CONFIG.forecastHorizonDays,
    };

    const businessProfile = {
      name: orgRow.name,
      businessId: orgId,
      currency: orgRow.currency,
      currencySymbol: orgRow.currency_symbol || '₹',
      forecastStartDate: orgRow.forecast_start_date,
      forecastHorizonDays: orgRow.forecast_horizon_days,
      openingCash: orgRow.opening_cash,
      minimumCashReserveThreshold: orgRow.minimum_cash_threshold,
      warningCashReserveThreshold: orgRow.warning_cash_threshold,
      materialDeviationThreshold: orgRow.material_deviation_threshold,
    };

    // Transactions
    const txRows = db.prepare('SELECT * FROM financial_transactions WHERE organization_id = ? ORDER BY transaction_date DESC').all(orgId) as any[];
    const transactions: FinancialTransaction[] = txRows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      type: r.transaction_type as any,
      category: r.category as any,
      amount: r.amount,
      currency: r.currency,
      transactionDate: r.transaction_date,
      expectedDate: r.expected_date,
      actualDate: r.actual_date || undefined,
      counterparty: r.counterparty,
      invoiceId: r.invoice_id || undefined,
      status: r.status as any,
      confidence: r.confidence,
      notes: r.notes || undefined,
      source: r.source as any,
    }));

    // AR Invoices
    const arRows = db.prepare('SELECT * FROM accounts_receivable WHERE organization_id = ? ORDER BY due_date ASC').all(orgId) as any[];
    const salesInvoices: SalesInvoiceAR[] = arRows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      customerName: r.customer_name,
      customerId: r.customer_id,
      amount: r.amount,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      expectedCollectionDate: r.expected_collection_date,
      status: r.status as any,
      paidAmount: r.paid_amount,
      paymentTermsDays: r.payment_terms_days,
      historicalAvgDelayDays: r.historical_avg_delay_days,
      collectionProbability: r.collection_probability,
      agingBucket: r.aging_bucket as any,
      notes: r.notes || undefined,
    }));

    // AP Invoices
    const apRows = db.prepare('SELECT * FROM accounts_payable WHERE organization_id = ? ORDER BY due_date ASC').all(orgId) as any[];
    const purchaseInvoices: PurchaseInvoiceAP[] = apRows.map((r) => ({
      id: r.id,
      billNumber: r.bill_number,
      supplierName: r.supplier_name,
      supplierId: r.supplier_id,
      amount: r.amount,
      billDate: r.bill_date,
      dueDate: r.due_date,
      scheduledPaymentDate: r.scheduled_payment_date,
      priority: r.priority as any,
      category: r.category as any,
      status: r.status as any,
      discountTerms: r.discount_terms ? JSON.parse(r.discount_terms) : undefined,
      notes: r.notes || undefined,
    }));

    // OpEx
    const opexRows = db.prepare('SELECT * FROM operating_expenses WHERE organization_id = ?').all(orgId) as any[];
    const operatingExpenses: OperatingExpense[] = opexRows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type as any,
      category: r.category as any,
      amount: r.amount,
      frequency: r.frequency as any,
      dueDayOfMonth: r.due_day_of_month || undefined,
      nextDueDate: r.next_due_date,
      isMandatory: Boolean(r.is_mandatory),
      notes: r.notes || undefined,
    }));

    // Inventory
    const invRows = db.prepare('SELECT * FROM inventory_items WHERE organization_id = ?').all(orgId) as any[];
    const inventoryItems: InventoryItem[] = invRows.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      currentStock: r.current_stock,
      unitCost: r.unit_cost,
      monthlyDemandForecast: r.monthly_demand_forecast,
      safetyStock: r.safety_stock,
      reorderPoint: r.reorder_point,
      supplierLeadTimeDays: r.supplier_lead_time_days,
      supplierName: r.supplier_name,
      paymentTermsDays: r.payment_terms_days,
      plannedPurchaseQuantity: r.planned_purchase_quantity,
      plannedPurchaseDate: r.planned_purchase_date,
      annualCarryingRatePercent: r.annual_carrying_rate_percent,
    }));

    // Loans
    const loanRows = db.prepare('SELECT * FROM loan_obligations WHERE organization_id = ?').all(orgId) as any[];
    const loans: LoanObligation[] = loanRows.map((r) => ({
      id: r.id,
      lenderName: r.lender_name,
      loanType: r.loan_type as any,
      principalRemaining: r.principal_remaining,
      annualInterestRate: r.annual_interest_rate,
      monthlyEmi: r.monthly_emi,
      principalPortion: r.principal_portion,
      interestPortion: r.interest_portion,
      dueDayOfMonth: r.due_day_of_month,
      nextDueDate: r.next_due_date,
      remainingTenureMonths: r.remaining_tenure_months,
    }));

    // Taxes
    const taxRows = db.prepare('SELECT * FROM tax_obligations WHERE organization_id = ?').all(orgId) as any[];
    const taxes: TaxObligation[] = taxRows.map((r) => ({
      id: r.id,
      taxType: r.tax_type as any,
      period: r.period,
      estimatedObligation: r.estimated_obligation,
      confirmedObligation: r.confirmed_obligation,
      dueDate: r.due_date,
      status: r.status as any,
      mandateLevel: r.mandate_level as any,
    }));

    // Variance
    const varRows = db.prepare('SELECT * FROM variance_records WHERE organization_id = ? ORDER BY date ASC').all(orgId) as any[];
    const varianceRecords: VarianceDayRecord[] = varRows.map((r) => ({
      date: r.date,
      forecastNetCash: r.forecast_net_cash,
      actualNetCash: r.actual_net_cash,
      cashFlowVariance: r.cash_flow_variance,
      forecastEndingCash: r.forecast_ending_cash,
      actualEndingCash: r.actual_ending_cash,
      balanceVariance: r.balance_variance,
      primaryDeviationCategory: r.primary_deviation_category,
      deviationReason: r.deviation_reason,
    }));

    // Recommendations
    const recRows = db.prepare('SELECT * FROM recommendations WHERE organization_id = ?').all(orgId) as any[];
    const recommendations: ActionableRecommendation[] = recRows.map((r) => ({
      id: r.id,
      priority: r.priority as any,
      category: r.category as any,
      title: r.title,
      rationale: r.rationale,
      financialImpact: r.financial_impact,
      confidenceLevel: r.confidence_level,
      actionableSteps: JSON.parse(r.actionable_steps || '[]'),
      isImplemented: Boolean(r.is_implemented),
    }));

    // Bank accounts
    const bankAccounts = db.prepare('SELECT * FROM bank_accounts WHERE organization_id = ?').all(orgId) as any[];

    return {
      businessProfile,
      transactions,
      salesInvoices,
      purchaseInvoices,
      operatingExpenses,
      inventoryItems,
      loans,
      taxes,
      varianceRecords,
      recommendations,
      bankAccounts,
      stats: this.getStats(),
    };
  },

  // 1. Transaction Operations
  createTransaction(tx: Partial<FinancialTransaction> & { amount: number; type: string; category: string; counterparty: string }, orgId: string = DEFAULT_ORG_ID) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = tx.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const txDate = tx.transactionDate || now.slice(0, 10);

    db.prepare(`
      INSERT INTO financial_transactions (
        id, organization_id, bank_account_id, business_id, transaction_type, category,
        description, amount, currency, transaction_date, expected_date, actual_date,
        counterparty, invoice_id, reference_number, status, source, confidence, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      orgId,
      'acc-hdfc-01',
      tx.businessId || 'biz_prism_ind_001',
      tx.type,
      tx.category,
      tx.notes || '',
      tx.amount,
      tx.currency || 'INR',
      txDate,
      tx.expectedDate || txDate,
      tx.actualDate || null,
      tx.counterparty,
      tx.invoiceId || null,
      null,
      tx.status || 'cleared',
      tx.source || 'manual',
      tx.confidence ?? 1.0,
      tx.notes || null,
      now,
      now
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, previous_value, new_value, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`audit-${Date.now()}`, orgId, null, 'CREATE_TRANSACTION', 'financial_transactions', id, null, JSON.stringify(tx), now);

    return db.prepare('SELECT * FROM financial_transactions WHERE id = ?').get(id);
  },

  // 2. AR Operations
  createReceivable(inv: Partial<SalesInvoiceAR> & { amount: number; customerName: string; invoiceNumber: string }, orgId: string = DEFAULT_ORG_ID) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = inv.id || `ar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    db.prepare(`
      INSERT INTO accounts_receivable (
        id, organization_id, customer_id, customer_name, invoice_number, amount,
        paid_amount, issue_date, due_date, expected_collection_date, status,
        payment_terms_days, historical_avg_delay_days, collection_probability,
        aging_bucket, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      orgId,
      inv.customerId || 'cust_generic',
      inv.customerName,
      inv.invoiceNumber,
      inv.amount,
      inv.paidAmount || 0,
      inv.issueDate || now.slice(0, 10),
      inv.dueDate || now.slice(0, 10),
      inv.expectedCollectionDate || inv.dueDate || now.slice(0, 10),
      inv.status || 'outstanding',
      inv.paymentTermsDays || 30,
      inv.historicalAvgDelayDays || 0,
      inv.collectionProbability || 0.95,
      inv.agingBucket || 'current',
      inv.notes || null,
      now,
      now
    );

    return db.prepare('SELECT * FROM accounts_receivable WHERE id = ?').get(id);
  },

  updateReceivable(id: string, updates: Partial<SalesInvoiceAR>, orgId: string = DEFAULT_ORG_ID) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT * FROM accounts_receivable WHERE id = ? AND organization_id = ?').get(id, orgId) as any;
    if (!existing) return null;

    db.prepare(`
      UPDATE accounts_receivable SET
        status = coalesce(?, status),
        paid_amount = coalesce(?, paid_amount),
        expected_collection_date = coalesce(?, expected_collection_date),
        notes = coalesce(?, notes),
        updated_at = ?
      WHERE id = ? AND organization_id = ?
    `).run(
      updates.status || null,
      updates.paidAmount ?? null,
      updates.expectedCollectionDate || null,
      updates.notes || null,
      now,
      id,
      orgId
    );

    return db.prepare('SELECT * FROM accounts_receivable WHERE id = ?').get(id);
  },

  // 3. AP Operations
  createPayable(bill: Partial<PurchaseInvoiceAP> & { amount: number; supplierName: string; billNumber: string }, orgId: string = DEFAULT_ORG_ID) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = bill.id || `ap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    db.prepare(`
      INSERT INTO accounts_payable (
        id, organization_id, supplier_id, supplier_name, bill_number, amount,
        bill_date, due_date, scheduled_payment_date, priority, category,
        status, discount_terms, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      orgId,
      bill.supplierId || 'supp_generic',
      bill.supplierName,
      bill.billNumber,
      bill.amount,
      bill.billDate || now.slice(0, 10),
      bill.dueDate || now.slice(0, 10),
      bill.scheduledPaymentDate || bill.dueDate || now.slice(0, 10),
      bill.priority || 'medium',
      bill.category || 'raw_materials',
      bill.status || 'unpaid',
      bill.discountTerms ? JSON.stringify(bill.discountTerms) : null,
      (bill as any).notes || null,
      now,
      now
    );

    return db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(id);
  },

  updatePayable(id: string, updates: Partial<PurchaseInvoiceAP>, orgId: string = DEFAULT_ORG_ID) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT * FROM accounts_payable WHERE id = ? AND organization_id = ?').get(id, orgId) as any;
    if (!existing) return null;

    db.prepare(`
      UPDATE accounts_payable SET
        status = coalesce(?, status),
        scheduled_payment_date = coalesce(?, scheduled_payment_date),
        notes = coalesce(?, notes),
        updated_at = ?
      WHERE id = ? AND organization_id = ?
    `).run(
      updates.status || null,
      updates.scheduledPaymentDate || null,
      (updates as any).notes || null,
      now,
      id,
      orgId
    );

    return db.prepare('SELECT * FROM accounts_payable WHERE id = ?').get(id);
  },

  // 4. OpEx Operations
  createOperatingExpense(opex: Partial<OperatingExpense> & { name: string; amount: number; category: string }, orgId: string = DEFAULT_ORG_ID) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = opex.id || `opex-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    db.prepare(`
      INSERT INTO operating_expenses (
        id, organization_id, name, type, category, amount, frequency,
        due_day_of_month, next_due_date, is_mandatory, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      orgId,
      opex.name,
      opex.type || 'fixed',
      opex.category,
      opex.amount,
      opex.frequency || 'monthly',
      opex.dueDayOfMonth || null,
      opex.nextDueDate || now.slice(0, 10),
      opex.isMandatory !== false ? 1 : 0,
      opex.notes || null,
      now,
      now
    );

    return db.prepare('SELECT * FROM operating_expenses WHERE id = ?').get(id);
  },

  // 5. Recommendations Toggle
  toggleRecommendation(id: string, orgId: string = DEFAULT_ORG_ID) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const current = db.prepare('SELECT is_implemented FROM recommendations WHERE id = ? AND organization_id = ?').get(id, orgId) as { is_implemented: number } | undefined;
    if (!current) return null;

    const nextState = current.is_implemented ? 0 : 1;
    db.prepare('UPDATE recommendations SET is_implemented = ?, updated_at = ? WHERE id = ? AND organization_id = ?').run(nextState, now, id, orgId);

    return { id, isImplemented: Boolean(nextState) };
  },

  // 6. Reset to Demo pristine state
  resetDatabase(orgId: string = DEFAULT_ORG_ID) {
    const db = getDatabase();
    db.exec(`
      DELETE FROM forecast_items WHERE organization_id = '${orgId}';
      DELETE FROM forecast_daily_projections WHERE organization_id = '${orgId}';
      DELETE FROM forecast_runs WHERE organization_id = '${orgId}';
      DELETE FROM scenario_assumptions WHERE organization_id = '${orgId}';
      DELETE FROM forecast_scenarios WHERE organization_id = '${orgId}';
      DELETE FROM alert_rules WHERE organization_id = '${orgId}';
      DELETE FROM financial_alerts WHERE organization_id = '${orgId}';
      DELETE FROM recommendations WHERE organization_id = '${orgId}';
      DELETE FROM variance_records WHERE organization_id = '${orgId}';
      DELETE FROM recurring_cash_flows WHERE organization_id = '${orgId}';
      DELETE FROM tax_obligations WHERE organization_id = '${orgId}';
      DELETE FROM loan_obligations WHERE organization_id = '${orgId}';
      DELETE FROM inventory_items WHERE organization_id = '${orgId}';
      DELETE FROM operating_expenses WHERE organization_id = '${orgId}';
      DELETE FROM accounts_payable WHERE organization_id = '${orgId}';
      DELETE FROM accounts_receivable WHERE organization_id = '${orgId}';
      DELETE FROM financial_transactions WHERE organization_id = '${orgId}';
      DELETE FROM suppliers WHERE organization_id = '${orgId}';
      DELETE FROM customers WHERE organization_id = '${orgId}';
      DELETE FROM bank_accounts WHERE organization_id = '${orgId}';
      DELETE FROM notifications WHERE organization_id = '${orgId}';
      DELETE FROM audit_logs WHERE organization_id = '${orgId}';
      DELETE FROM organizations WHERE id = '${orgId}';
    `);

    seedInitialDataIfEmpty(db);
    return this.getBootstrapData(orgId);
  },
};
