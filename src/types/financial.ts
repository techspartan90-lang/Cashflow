/**
 * CashFlow Intelligence - Domain Types
 * Strict typing for financial calculations, forecasting models, and scenarios.
 */

export type TransactionType = 'inflow' | 'outflow';

export type TransactionCategory =
  | 'cash_sale'
  | 'credit_sale_collection'
  | 'loan_proceeds'
  | 'investment_inflow'
  | 'other_inflow'
  | 'supplier_payment'
  | 'payroll'
  | 'rent'
  | 'utilities'
  | 'marketing'
  | 'logistics'
  | 'inventory_procurement'
  | 'loan_emi'
  | 'tax_gst'
  | 'tax_advance'
  | 'tax_tds'
  | 'miscellaneous_expense';

export type TransactionStatus = 'cleared' | 'pending' | 'overdue' | 'projected';

export interface FinancialTransaction {
  id: string;
  businessId: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency: string;
  transactionDate: string; // ISO date YYYY-MM-DD
  expectedDate: string;
  actualDate?: string;
  counterparty: string;
  invoiceId?: string;
  status: TransactionStatus;
  confidence: number; // 0 to 1
  notes?: string;
  source: 'bank_feed' | 'manual' | 'csv_import' | 'forecast_engine';
}

export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export interface SalesInvoiceAR {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerId: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  expectedCollectionDate: string;
  status: 'outstanding' | 'collected' | 'partially_collected' | 'bad_debt';
  paidAmount: number;
  paymentTermsDays: number;
  historicalAvgDelayDays: number;
  collectionProbability: number; // 0 - 1
  agingBucket: AgingBucket;
  notes?: string;
}

export interface PurchaseInvoiceAP {
  id: string;
  billNumber: string;
  supplierName: string;
  supplierId: string;
  amount: number;
  billDate: string;
  dueDate: string;
  scheduledPaymentDate: string;
  priority: 'critical' | 'high' | 'medium' | 'discretionary';
  category: 'raw_materials' | 'finished_goods' | 'services' | 'utilities' | 'packaging';
  status: 'unpaid' | 'scheduled' | 'paid';
  discountTerms?: {
    discountPercent: number;
    daysBeforeDue: number;
  };
}

export interface OperatingExpense {
  id: string;
  name: string;
  type: 'fixed' | 'variable' | 'one-time';
  category: 'rent' | 'salaries' | 'utilities' | 'marketing' | 'software' | 'insurance' | 'repairs' | 'other';
  amount: number;
  frequency: 'monthly' | 'bi-weekly' | 'weekly' | 'one-time';
  dueDayOfMonth?: number;
  nextDueDate: string;
  isMandatory: boolean;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  unitCost: number;
  monthlyDemandForecast: number;
  safetyStock: number;
  reorderPoint: number;
  supplierLeadTimeDays: number;
  supplierName: string;
  paymentTermsDays: number;
  plannedPurchaseQuantity: number;
  plannedPurchaseDate: string;
  annualCarryingRatePercent: number; // typically 15-25%
}

export interface LoanObligation {
  id: string;
  lenderName: string;
  loanType: 'term_loan' | 'working_capital' | 'equipment_finance';
  principalRemaining: number;
  annualInterestRate: number; // e.g. 10.5%
  monthlyEmi: number;
  principalPortion: number;
  interestPortion: number;
  dueDayOfMonth: number;
  nextDueDate: string;
  remainingTenureMonths: number;
}

export interface TaxObligation {
  id: string;
  taxType: 'GST_Monthly' | 'Advance_Tax_Q2' | 'TDS_Monthly' | 'Professional_Tax';
  period: string;
  estimatedObligation: number;
  confirmedObligation: number;
  dueDate: string;
  status: 'provisioned' | 'approved' | 'paid';
  mandateLevel: 'statutory_mandatory';
}

export type ScenarioType = 'optimistic' | 'expected' | 'pessimistic';

export interface DailyCashPosition {
  date: string;
  dayIndex: number; // 0 to 29
  dayOfWeek: string;
  beginningCash: number;
  // Inflows
  cashSales: number;
  creditSalesCollected: number;
  otherInflows: number;
  totalInflows: number;
  // Outflows
  supplierPayments: number;
  operatingExpenses: number;
  inventoryPurchases: number;
  loanRepayments: number;
  taxPayments: number;
  otherOutflows: number;
  totalOutflows: number;
  // Net & Ending
  netCashFlow: number;
  endingCash: number;
  // Risk assessment
  isBelowMinimum: boolean;
  isBelowWarning: boolean;
  scenario: ScenarioType;
}

export interface WeeklyCashSummary {
  weekIndex: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  beginningCash: number;
  totalInflows: number;
  totalOutflows: number;
  netCashFlow: number;
  endingCash: number;
  lowestCashPoint: number;
  lowestCashDate: string;
}

export interface ScenarioParameters {
  salesMultiplier: number; // e.g. 1.15 for optimistic, 0.85 for pessimistic
  arCollectionDelayDays: number; // e.g. -3 for optimistic, +7 for pessimistic
  expenseMultiplier: number; // e.g. 0.95 for optimistic, 1.08 for pessimistic
  apPaymentGraceDays: number; // e.g. 0 or +5
}

export interface MonteCarloRunResult {
  iterations: number;
  p10EndingCash: number;
  p50EndingCash: number;
  p90EndingCash: number;
  shortfallProbabilityPercent: number;
  earliestShortfallDate: string | null;
  dailyBands: Array<{
    date: string;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  }>;
}

export interface CashConversionCycleMetrics {
  dio: number; // Days Inventory Outstanding
  dso: number; // Days Sales Outstanding
  dpo: number; // Days Payable Outstanding
  ccc: number; // CCC = DIO + DSO - DPO
  averageInventoryValue: number;
  averageReceivablesValue: number;
  averagePayablesValue: number;
  annualCostOfGoodsSold: number;
  annualCreditSales: number;
}

export interface CashRunwaySummary {
  currentCash: number;
  forecastEndingCash: number;
  averageDailyNetBurn: number;
  runwayDaysEstimated: number | 'Infinite (>365d)';
  minimumProjectedCash: number;
  minimumProjectedDate: string;
  minimumThreshold: number;
  warningThreshold: number;
  isThresholdBreached: boolean;
  riskStatus: 'Safe' | 'Caution' | 'Critical';
}

export interface BottleneckItem {
  id: string;
  riskDate: string;
  category: 'AR_Concentration' | 'Supplier_Clump' | 'Tax_Deadline' | 'Payroll_Peak' | 'Debt_Service';
  title: string;
  description: string;
  cashDeficitImpact: number;
  severity: 'critical' | 'high' | 'medium';
  contributingEntities: string[];
  suggestedAction: string;
}

export interface FinancialAlert {
  id: string;
  date: string;
  type: 'threshold_breach' | 'large_outflow' | 'collection_delay' | 'payment_concentration';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  projectedBalance: number;
  threshold: number;
  recommendationAction: string;
  acknowledged: boolean;
}

export interface ActionableRecommendation {
  id: string;
  category: 'receivables' | 'payables' | 'inventory' | 'financing' | 'discretionary';
  priority: 'urgent' | 'high' | 'medium';
  title: string;
  rationale: string;
  financialImpact: number; // estimated ₹ saved or accelerated
  confidenceLevel: number; // 0 - 1
  isImplemented: boolean;
  actionableSteps: string[];
}

export interface VarianceDayRecord {
  date: string;
  forecastNetCash: number;
  actualNetCash: number;
  cashFlowVariance: number;
  forecastEndingCash: number;
  actualEndingCash: number;
  balanceVariance: number;
  primaryDeviationCategory?: string;
  deviationReason?: string;
}

export interface VarianceMetrics {
  records: VarianceDayRecord[];
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Square Error
  bias: number; // Average (Forecast - Actual)
  materialDeviationsCount: number; // count where |variance| > threshold (e.g. ₹50,000)
}
