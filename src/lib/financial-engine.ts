/**
 * CashFlow Intelligence - Deterministic & Stochastic Financial Engine
 * Implements authoritative mathematical cash-flow scheduling, AR aging,
 * scenario projections, Monte Carlo simulation, CCC, and bottleneck analysis.
 */

import {
  DailyCashPosition,
  FinancialTransaction,
  SalesInvoiceAR,
  PurchaseInvoiceAP,
  OperatingExpense,
  InventoryItem,
  LoanObligation,
  TaxObligation,
  WeeklyCashSummary,
  ScenarioType,
  ScenarioParameters,
  MonteCarloRunResult,
  CashRunwaySummary,
  CashConversionCycleMetrics,
  BottleneckItem,
  FinancialAlert,
  ActionableRecommendation,
  AgingBucket,
  VarianceMetrics,
  VarianceDayRecord,
} from '../types/financial';

export interface EngineInputState {
  initialCash: number;
  minimumThreshold: number;
  warningThreshold: number;
  startDate: string; // YYYY-MM-DD
  horizonDays: number;
  salesMonthlyTarget: number;
  cashSalesRatio: number;
  creditSalesRatio: number;
  arInvoices: SalesInvoiceAR[];
  apInvoices: PurchaseInvoiceAP[];
  operatingExpenses: OperatingExpense[];
  inventoryItems: InventoryItem[];
  loans: LoanObligation[];
  taxes: TaxObligation[];
  adhocTransactions: FinancialTransaction[];
  scenarioParams?: Partial<Record<ScenarioType, ScenarioParameters>>;
}

const DEFAULT_SCENARIO_PARAMS: Record<ScenarioType, ScenarioParameters> = {
  optimistic: {
    salesMultiplier: 1.15,
    arCollectionDelayDays: -3,
    expenseMultiplier: 0.95,
    apPaymentGraceDays: 0,
  },
  expected: {
    salesMultiplier: 1.0,
    arCollectionDelayDays: 0,
    expenseMultiplier: 1.0,
    apPaymentGraceDays: 0,
  },
  pessimistic: {
    salesMultiplier: 0.85,
    arCollectionDelayDays: 7,
    expenseMultiplier: 1.08,
    apPaymentGraceDays: 0,
  },
};

// Day of week seasonality indices (Mon=0 to Sun=6)
const DAY_OF_WEEK_FACTORS = [0.9, 0.85, 0.95, 1.05, 1.25, 1.35, 0.65];

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function getDayDifference(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00').getTime();
  const b = new Date(dateB + 'T00:00:00').getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

/**
 * Generates the deterministic 30-day daily cash position trajectory
 * EndingCash(t) = BeginningCash(t) + TotalCashInflows(t) - TotalCashOutflows(t)
 */
export function generateDailyForecast(
  input: EngineInputState,
  scenario: ScenarioType = 'expected'
): DailyCashPosition[] {
  const params = {
    ...DEFAULT_SCENARIO_PARAMS[scenario],
    ...(input.scenarioParams ? input.scenarioParams[scenario] : {}),
  };

  const dailyPositions: DailyCashPosition[] = [];
  let rollingBeginningCash = input.initialCash;

  const baselineDailySales = (input.salesMonthlyTarget / 30) * params.salesMultiplier;

  for (let i = 0; i < input.horizonDays; i++) {
    const currentDate = addDays(input.startDate, i);
    const dateObj = new Date(currentDate + 'T00:00:00');
    const dayOfWeekIdx = (dateObj.getDay() + 6) % 7; // Monday = 0
    const dayName = getDayName(currentDate);

    // 1. Cash Sales (immediate daily cash inflow)
    const dowFactor = DAY_OF_WEEK_FACTORS[dayOfWeekIdx] ?? 1.0;
    const estimatedDailyTotalSales = baselineDailySales * dowFactor;
    const dailyCashSales = Math.round(estimatedDailyTotalSales * input.cashSalesRatio);

    // 2. AR Credit Collections scheduled for this date
    let arCollections = 0;
    for (const inv of input.arInvoices) {
      if (inv.status === 'collected') continue;

      // Adjust collection date by scenario lag
      const adjustedCollectionDate = addDays(
        inv.expectedCollectionDate,
        params.arCollectionDelayDays
      );

      if (adjustedCollectionDate === currentDate) {
        // Amount weighted by collection probability
        const collectableAmount = (inv.amount - (inv.paidAmount || 0)) * inv.collectionProbability;
        arCollections += Math.round(collectableAmount);
      }
    }

    // 3. Ad-hoc Inflow Transactions
    let otherInflows = 0;
    for (const tx of input.adhocTransactions) {
      if (tx.type === 'inflow' && tx.expectedDate === currentDate) {
        otherInflows += tx.amount;
      }
    }

    const totalInflows = dailyCashSales + arCollections + otherInflows;

    // 4. Accounts Payable Supplier Payments
    let supplierPayments = 0;
    for (const ap of input.apInvoices) {
      if (ap.status === 'paid') continue;
      if (ap.scheduledPaymentDate === currentDate) {
        supplierPayments += ap.amount;
      }
    }

    // 5. Operating Expenses
    let operatingExpenses = 0;
    for (const opex of input.operatingExpenses) {
      if (opex.nextDueDate === currentDate) {
        const expAmount = opex.amount * params.expenseMultiplier;
        operatingExpenses += Math.round(expAmount);
      }
    }

    // 6. Inventory Procurement Cash Outflows
    let inventoryPurchases = 0;
    for (const item of input.inventoryItems) {
      // Payment happens at planned purchase date plus terms
      if (item.plannedPurchaseDate === currentDate) {
        const poCost = item.plannedPurchaseQuantity * item.unitCost;
        inventoryPurchases += poCost;
      }
    }

    // 7. Loan Repayments (EMI)
    let loanRepayments = 0;
    for (const loan of input.loans) {
      if (loan.nextDueDate === currentDate) {
        loanRepayments += loan.monthlyEmi;
      }
    }

    // 8. Tax Obligations
    let taxPayments = 0;
    for (const tax of input.taxes) {
      if (tax.dueDate === currentDate && tax.status !== 'paid') {
        taxPayments += tax.confirmedObligation || tax.estimatedObligation;
      }
    }

    // 9. Ad-hoc Outflow Transactions
    let otherOutflows = 0;
    for (const tx of input.adhocTransactions) {
      if (tx.type === 'outflow' && tx.expectedDate === currentDate) {
        otherOutflows += tx.amount;
      }
    }

    const totalOutflows =
      supplierPayments +
      operatingExpenses +
      inventoryPurchases +
      loanRepayments +
      taxPayments +
      otherOutflows;

    const netCashFlow = totalInflows - totalOutflows;
    const endingCash = rollingBeginningCash + netCashFlow;

    dailyPositions.push({
      date: currentDate,
      dayIndex: i,
      dayOfWeek: dayName,
      beginningCash: rollingBeginningCash,
      cashSales: dailyCashSales,
      creditSalesCollected: arCollections,
      otherInflows,
      totalInflows,
      supplierPayments,
      operatingExpenses,
      inventoryPurchases,
      loanRepayments,
      taxPayments,
      otherOutflows,
      totalOutflows,
      netCashFlow,
      endingCash,
      isBelowMinimum: endingCash < input.minimumThreshold,
      isBelowWarning: endingCash < input.warningThreshold,
      scenario,
    });

    // Advance to next day
    rollingBeginningCash = endingCash;
  }

  return dailyPositions;
}

/**
 * Aggregates daily forecast into weekly cash-flow intervals
 */
export function aggregateWeeklyForecast(dailyPositions: DailyCashPosition[]): WeeklyCashSummary[] {
  const weeks: WeeklyCashSummary[] = [];
  const daysPerWeek = 7;
  const numWeeks = Math.ceil(dailyPositions.length / daysPerWeek);

  for (let w = 0; w < numWeeks; w++) {
    const chunk = dailyPositions.slice(w * daysPerWeek, (w + 1) * daysPerWeek);
    if (chunk.length === 0) continue;

    const firstDay = chunk[0];
    const lastDay = chunk[chunk.length - 1];

    const totalInflows = chunk.reduce((sum, d) => sum + d.totalInflows, 0);
    const totalOutflows = chunk.reduce((sum, d) => sum + d.totalOutflows, 0);
    const netCashFlow = totalInflows - totalOutflows;

    let lowestPoint = firstDay.endingCash;
    let lowestDate = firstDay.date;

    for (const d of chunk) {
      if (d.endingCash < lowestPoint) {
        lowestPoint = d.endingCash;
        lowestDate = d.date;
      }
    }

    weeks.push({
      weekIndex: w + 1,
      weekLabel: `Week ${w + 1} (${formatDateLabel(firstDay.date)} - ${formatDateLabel(lastDay.date)})`,
      startDate: firstDay.date,
      endDate: lastDay.date,
      beginningCash: firstDay.beginningCash,
      totalInflows,
      totalOutflows,
      netCashFlow,
      endingCash: lastDay.endingCash,
      lowestCashPoint: lowestPoint,
      lowestCashDate: lowestDate,
    });
  }

  return weeks;
}

/**
 * Calculates Cash Runway Metrics
 */
export function calculateCashRunway(
  initialCash: number,
  dailyPositions: DailyCashPosition[],
  minimumThreshold: number,
  warningThreshold: number
): CashRunwaySummary {
  const endingCash = dailyPositions[dailyPositions.length - 1]?.endingCash ?? initialCash;

  // Calculate average daily burn rate: sum of net negative days / count
  let totalNetBurn = 0;
  let burnDays = 0;
  let minCash = initialCash;
  let minDate = dailyPositions[0]?.date ?? '';
  let earliestBreachDate: string | null = null;

  for (const day of dailyPositions) {
    if (day.netCashFlow < 0) {
      totalNetBurn += Math.abs(day.netCashFlow);
      burnDays++;
    }
    if (day.endingCash < minCash) {
      minCash = day.endingCash;
      minDate = day.date;
    }
    if (day.endingCash < minimumThreshold && !earliestBreachDate) {
      earliestBreachDate = day.date;
    }
  }

  const avgDailyNetBurn = burnDays > 0 ? Math.round(totalNetBurn / burnDays) : 0;

  let runwayDays: number | 'Infinite (>365d)' = 'Infinite (>365d)';
  if (avgDailyNetBurn > 0) {
    const calcRunway = Math.round(initialCash / avgDailyNetBurn);
    runwayDays = calcRunway > 365 ? 'Infinite (>365d)' : calcRunway;
  }

  let riskStatus: 'Safe' | 'Caution' | 'Critical' = 'Safe';
  if (minCash < minimumThreshold) {
    riskStatus = 'Critical';
  } else if (minCash < warningThreshold) {
    riskStatus = 'Caution';
  }

  return {
    currentCash: initialCash,
    forecastEndingCash: endingCash,
    averageDailyNetBurn: avgDailyNetBurn,
    runwayDaysEstimated: runwayDays,
    minimumProjectedCash: minCash,
    minimumProjectedDate: minDate,
    minimumThreshold,
    warningThreshold,
    isThresholdBreached: minCash < minimumThreshold,
    riskStatus,
  };
}

/**
 * Calculates Accounts Receivable Aging and Weighted Average Delay
 */
export function calculateArAging(invoices: SalesInvoiceAR[], referenceDate: string) {
  const buckets: Record<AgingBucket, { count: number; totalAmount: number; invoices: SalesInvoiceAR[] }> = {
    current: { count: 0, totalAmount: 0, invoices: [] },
    '1-30': { count: 0, totalAmount: 0, invoices: [] },
    '31-60': { count: 0, totalAmount: 0, invoices: [] },
    '61-90': { count: 0, totalAmount: 0, invoices: [] },
    '90+': { count: 0, totalAmount: 0, invoices: [] },
  };

  let totalOutstanding = 0;
  let weightedDelaySum = 0;

  for (const inv of invoices) {
    if (inv.status === 'collected') continue;
    const outstanding = inv.amount - (inv.paidAmount || 0);
    totalOutstanding += outstanding;

    const delayDays = getDayDifference(referenceDate, inv.dueDate);
    let bucketKey: AgingBucket = 'current';

    if (delayDays <= 0) {
      bucketKey = 'current';
    } else if (delayDays <= 30) {
      bucketKey = '1-30';
    } else if (delayDays <= 60) {
      bucketKey = '31-60';
    } else if (delayDays <= 90) {
      bucketKey = '61-90';
    } else {
      bucketKey = '90+';
    }

    buckets[bucketKey].count++;
    buckets[bucketKey].totalAmount += outstanding;
    buckets[bucketKey].invoices.push(inv);

    const actualOrHistoricalDelay = Math.max(0, delayDays, inv.historicalAvgDelayDays);
    weightedDelaySum += outstanding * actualOrHistoricalDelay;
  }

  const weightedAvgDelayDays =
    totalOutstanding > 0 ? Math.round((weightedDelaySum / totalOutstanding) * 10) / 10 : 0;

  return {
    totalOutstanding,
    weightedAvgDelayDays,
    buckets,
  };
}

/**
 * Calculates Cash Conversion Cycle (DIO + DSO - DPO)
 */
export function calculateCashConversionCycle(
  inventory: InventoryItem[],
  arInvoices: SalesInvoiceAR[],
  apInvoices: PurchaseInvoiceAP[],
  annualSales: number = 14400000 // ₹1.2M * 12
): CashConversionCycleMetrics {
  const annualCogs = annualSales * 0.65; // 65% COGS assumption for wholesale supplies
  const annualCreditSales = annualSales * 0.45;

  const totalInventoryValue = inventory.reduce(
    (sum, item) => sum + item.currentStock * item.unitCost,
    0
  );
  const totalReceivablesValue = arInvoices.reduce(
    (sum, inv) => (inv.status !== 'collected' ? sum + (inv.amount - inv.paidAmount) : sum),
    0
  );
  const totalPayablesValue = apInvoices.reduce(
    (sum, ap) => (ap.status !== 'paid' ? sum + ap.amount : sum),
    0
  );

  const dio = Math.round((totalInventoryValue / annualCogs) * 365);
  const dso = Math.round((totalReceivablesValue / annualCreditSales) * 365);
  const dpo = Math.round((totalPayablesValue / annualCogs) * 365);
  const ccc = dio + dso - dpo;

  return {
    dio,
    dso,
    dpo,
    ccc,
    averageInventoryValue: totalInventoryValue,
    averageReceivablesValue: totalReceivablesValue,
    averagePayablesValue: totalPayablesValue,
    annualCostOfGoodsSold: annualCogs,
    annualCreditSales,
  };
}

/**
 * Detects Cash-Flow Bottlenecks
 */
export function detectBottlenecks(
  dailyExpected: DailyCashPosition[],
  minimumThreshold: number,
  warningThreshold: number
): BottleneckItem[] {
  const bottlenecks: BottleneckItem[] = [];

  for (const day of dailyExpected) {
    // 1. Payment concentration check
    if (day.totalOutflows > 100000) {
      const entities: string[] = [];
      if (day.supplierPayments > 50000) entities.push(`Supplier Bills (₹${day.supplierPayments.toLocaleString('en-IN')})`);
      if (day.operatingExpenses > 50000) entities.push(`Payroll/Rent (₹${day.operatingExpenses.toLocaleString('en-IN')})`);
      if (day.taxPayments > 30000) entities.push(`Statutory Tax (₹${day.taxPayments.toLocaleString('en-IN')})`);
      if (day.loanRepayments > 30000) entities.push(`Bank EMI (₹${day.loanRepayments.toLocaleString('en-IN')})`);

      bottlenecks.push({
        id: `btnk_${day.date}_concentration`,
        riskDate: day.date,
        category: day.taxPayments > 50000 ? 'Tax_Deadline' : day.operatingExpenses > 80000 ? 'Payroll_Peak' : 'Supplier_Clump',
        title: `Heavy Outflow Concentration (${formatDateLabel(day.date)})`,
        description: `Scheduled outflows of ₹${day.totalOutflows.toLocaleString('en-IN')} with net daily change of -₹${Math.abs(day.netCashFlow).toLocaleString('en-IN')}. Ending cash reaches ₹${day.endingCash.toLocaleString('en-IN')}.`,
        cashDeficitImpact: day.totalOutflows,
        severity: day.endingCash < minimumThreshold ? 'critical' : day.endingCash < warningThreshold ? 'high' : 'medium',
        contributingEntities: entities,
        suggestedAction: 'Negotiate 5-day supplier credit grace or align collections to precede this date.',
      });
    }

    // 2. Minimum threshold breach check
    if (day.endingCash < minimumThreshold) {
      bottlenecks.push({
        id: `btnk_${day.date}_threshold`,
        riskDate: day.date,
        category: 'Debt_Service',
        title: `Projected Minimum Cash Breach (${formatDateLabel(day.date)})`,
        description: `Cash balance drops to ₹${day.endingCash.toLocaleString('en-IN')}, falling ₹${(minimumThreshold - day.endingCash).toLocaleString('en-IN')} below the ₹${minimumThreshold.toLocaleString('en-IN')} safety threshold.`,
        cashDeficitImpact: minimumThreshold - day.endingCash,
        severity: 'critical',
        contributingEntities: ['Operating Account Buffer Erosion'],
        suggestedAction: 'Activate working capital overdraft or expedite pending high-value receivables.',
      });
    }
  }

  // Deduplicate and return top severe items
  const uniqueMap = new Map<string, BottleneckItem>();
  for (const b of bottlenecks) {
    if (!uniqueMap.has(b.riskDate)) {
      uniqueMap.set(b.riskDate, b);
    }
  }

  return Array.from(uniqueMap.values()).slice(0, 6);
}

/**
 * Monte Carlo Probabilistic Simulation Engine (1,000 iterations)
 * Uses Box-Muller normal stochastic sampling to compute P10, P50, P90 corridors
 */
export function runMonteCarloSimulation(
  input: EngineInputState,
  iterations: number = 1000
): MonteCarloRunResult {
  const horizon = input.horizonDays;
  const dailyEndingCashes: number[][] = Array.from({ length: horizon }, () => []);

  // Standard Box-Muller transform for normal distribution
  function sampleNormal(mean: number, stdDev: number): number {
    const u1 = Math.max(1e-9, Math.random());
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  let shortfallCount = 0;
  let earliestShortfallDate: string | null = null;

  for (let run = 0; run < iterations; run++) {
    let currentCash = input.initialCash;
    let runShortfall = false;

    for (let day = 0; day < horizon; day++) {
      const dateStr = addDays(input.startDate, day);
      const dayOfWeekIdx = (new Date(dateStr + 'T00:00:00').getDay() + 6) % 7;
      const dowFactor = DAY_OF_WEEK_FACTORS[dayOfWeekIdx] ?? 1.0;

      // Stochastic daily sales: +/- 18% standard deviation
      const baselineSales = (input.salesMonthlyTarget / 30) * dowFactor;
      const simSales = Math.max(0, sampleNormal(baselineSales, baselineSales * 0.18));
      const simCashSales = simSales * input.cashSalesRatio;

      // Stochastic AR collections with random delay probability
      let simAr = 0;
      for (const inv of input.arInvoices) {
        if (inv.status === 'collected') continue;
        // 85% probability of on-schedule, 15% random delay of 1-10 days
        const delay = Math.random() < 0.85 ? 0 : Math.floor(Math.random() * 8) + 1;
        const colDate = addDays(inv.expectedCollectionDate, delay);
        if (colDate === dateStr) {
          simAr += inv.amount * (inv.collectionProbability || 0.9);
        }
      }

      // Scheduled Outflows with slight noise (+/- 4%) on variable expenses
      let simOutflows = 0;
      for (const ap of input.apInvoices) {
        if (ap.scheduledPaymentDate === dateStr && ap.status !== 'paid') simOutflows += ap.amount;
      }
      for (const opex of input.operatingExpenses) {
        if (opex.nextDueDate === dateStr) {
          const noise = opex.type === 'variable' ? sampleNormal(1.0, 0.08) : 1.0;
          simOutflows += opex.amount * Math.max(0.8, noise);
        }
      }
      for (const item of input.inventoryItems) {
        if (item.plannedPurchaseDate === dateStr) simOutflows += item.plannedPurchaseQuantity * item.unitCost;
      }
      for (const loan of input.loans) {
        if (loan.nextDueDate === dateStr) simOutflows += loan.monthlyEmi;
      }
      for (const tax of input.taxes) {
        if (tax.dueDate === dateStr && tax.status !== 'paid') simOutflows += tax.confirmedObligation;
      }

      const net = simCashSales + simAr - simOutflows;
      currentCash += net;
      dailyEndingCashes[day].push(currentCash);

      if (currentCash < input.minimumThreshold) {
        runShortfall = true;
        if (!earliestShortfallDate) earliestShortfallDate = dateStr;
      }
    }

    if (runShortfall) shortfallCount++;
  }

  // Calculate percentiles for each day
  const dailyBands = dailyEndingCashes.map((dayValues, index) => {
    dayValues.sort((a, b) => a - b);
    const p10 = dayValues[Math.floor(iterations * 0.1)];
    const p25 = dayValues[Math.floor(iterations * 0.25)];
    const p50 = dayValues[Math.floor(iterations * 0.5)];
    const p75 = dayValues[Math.floor(iterations * 0.75)];
    const p90 = dayValues[Math.floor(iterations * 0.9)];

    return {
      date: addDays(input.startDate, index),
      p10: Math.round(p10),
      p25: Math.round(p25),
      p50: Math.round(p50),
      p75: Math.round(p75),
      p90: Math.round(p90),
    };
  });

  const finalDayBands = dailyBands[dailyBands.length - 1];

  return {
    iterations,
    p10EndingCash: finalDayBands.p10,
    p50EndingCash: finalDayBands.p50,
    p90EndingCash: finalDayBands.p90,
    shortfallProbabilityPercent: Math.round((shortfallCount / iterations) * 100),
    earliestShortfallDate,
    dailyBands,
  };
}

/**
 * Rule-based Actionable Recommendation Engine
 */
export function generateRecommendations(
  dailyExpected: DailyCashPosition[],
  runway: CashRunwaySummary,
  arAging: ReturnType<typeof calculateArAging>,
  apInvoices: PurchaseInvoiceAP[],
  taxes: TaxObligation[],
  inventory: InventoryItem[]
): ActionableRecommendation[] {
  const recommendations: ActionableRecommendation[] = [];

  // 1. Receivables overdue action
  const overdueAmount = arAging.buckets['1-30'].totalAmount + arAging.buckets['31-60'].totalAmount + arAging.buckets['61-90'].totalAmount;
  if (overdueAmount > 50000) {
    recommendations.push({
      id: 'rec_ar_overdue',
      category: 'receivables',
      priority: 'urgent',
      title: 'Accelerate Overdue AR Collections with 2% Early-Settle Rebate',
      rationale: `₹${overdueAmount.toLocaleString('en-IN')} in customer receivables are past due (average delay: ${arAging.weightedAvgDelayDays} days). Apex Marts and Sunrise Dist. account for majority.`,
      financialImpact: Math.round(overdueAmount * 0.75),
      confidenceLevel: 0.92,
      isImplemented: false,
      actionableSteps: [
        'Offer 2% immediate cash settlement rebate for payments within 48 hours.',
        'Assign automated SMS & WhatsApp payment links to accounts teams.',
        'Pause additional credit shipments until invoices older than 30 days are cleared.',
      ],
    });
  }

  // 2. Minimum threshold breach remediation
  if (runway.isThresholdBreached) {
    recommendations.push({
      id: 'rec_liquidity_bridge',
      category: 'financing',
      priority: 'urgent',
      title: 'Activate Working Capital Overdraft Buffer for Sep 28 - Oct 5',
      rationale: `Projected minimum cash touches ₹${runway.minimumProjectedCash.toLocaleString('en-IN')} on ${formatDateLabel(runway.minimumProjectedDate)}, breaching safety threshold by ₹${(runway.minimumThreshold - runway.minimumProjectedCash).toLocaleString('en-IN')}.`,
      financialImpact: runway.minimumThreshold - runway.minimumProjectedCash + 50000,
      confidenceLevel: 0.95,
      isImplemented: false,
      actionableSteps: [
        'Draw down ₹75,000 from pre-approved SBI MSME Overdraft credit line.',
        'Schedule replenishment once Metro Supermarkets NEFT clears on Oct 6.',
        'Avoid incurring high penalty overdraft fees by pre-notifying relationship manager.',
      ],
    });
  }

  // 3. AP Supplier Terms Alignment
  const totalApDueFirstWeek = apInvoices
    .filter((ap) => ap.scheduledPaymentDate <= '2026-10-02')
    .reduce((sum, ap) => sum + ap.amount, 0);

  if (totalApDueFirstWeek > 100000) {
    recommendations.push({
      id: 'rec_ap_stagger',
      category: 'payables',
      priority: 'high',
      title: 'Stagger Supplier Payouts: Negotiate 7-Day Extension on Raw Materials',
      rationale: `Heavy supplier concentration of ₹${totalApDueFirstWeek.toLocaleString('en-IN')} due between Sep 28 and Oct 2 coincides directly with monthly staff payroll of ₹120,000.`,
      financialImpact: 135000,
      confidenceLevel: 0.88,
      isImplemented: false,
      actionableSteps: [
        'Request 7-day payment window extension with Bharat Agro Mills for bill SUP-BILL-7014.',
        'Split payment into two tranches: 50% on Sep 28, 50% on Oct 5.',
        'Preserve critical vendor goodwill while smoothing working capital trough.',
      ],
    });
  }

  // 4. Inventory replenishment batching
  const highStockValue = inventory.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0);
  if (highStockValue > 500000) {
    recommendations.push({
      id: 'rec_inventory_opt',
      category: 'inventory',
      priority: 'medium',
      title: 'Defer Basmati Rice Procurement Batch by 6 Days',
      rationale: `Current inventory carries 180 bags with safety stock of 80 bags. Current demand allows delaying ₹192,000 PO from Oct 4 to Oct 10 without stockout risk.`,
      financialImpact: 192000,
      confidenceLevel: 0.85,
      isImplemented: false,
      actionableSteps: [
        'Shift planned PO delivery from Oct 4 to Oct 10.',
        'Saves immediate cash drain during payroll week.',
        'Reduces annual inventory carrying costs by approx ₹2,800.',
      ],
    });
  }

  // 5. Statutory Tax provision readiness
  const upcomingGst = taxes.find((t) => t.taxType === 'GST_Monthly');
  if (upcomingGst && upcomingGst.dueDate <= '2026-09-25') {
    recommendations.push({
      id: 'rec_tax_compliance',
      category: 'discretionary',
      priority: 'high',
      title: 'Prioritize Statutory GST Settlement (₹68,000 Due Sep 24)',
      rationale: 'Mandatory statutory obligation. Late filing triggers 18% p.a. interest plus ₹50/day late penalty fees and damages GST compliance score.',
      financialImpact: 68000,
      confidenceLevel: 0.99,
      isImplemented: false,
      actionableSteps: [
        'Earmark ₹68,000 in dedicated tax escrow account immediately.',
        'File GSTR-3B return 24 hours prior to deadline to prevent GST portal congestion.',
      ],
    });
  }

  return recommendations;
}

/**
 * Automated Variance Analysis Metrics
 * Compares actual historical performance against forecasted baselines
 */
export function calculateVarianceMetrics(
  records: VarianceDayRecord[],
  materialThreshold: number = 50000
): VarianceMetrics {
  if (records.length === 0) {
    return { records: [], mae: 0, rmse: 0, bias: 0, materialDeviationsCount: 0 };
  }

  let totalAbsoluteError = 0;
  let totalSquaredError = 0;
  let totalSignedBias = 0;
  let materialDeviations = 0;

  for (const r of records) {
    const error = r.actualNetCash - r.forecastNetCash;
    totalAbsoluteError += Math.abs(error);
    totalSquaredError += error * error;
    totalSignedBias += r.forecastNetCash - r.actualNetCash;

    if (Math.abs(r.balanceVariance) >= materialThreshold || Math.abs(error) >= materialThreshold) {
      materialDeviations++;
    }
  }

  const n = records.length;
  const mae = Math.round(totalAbsoluteError / n);
  const rmse = Math.round(Math.sqrt(totalSquaredError / n));
  const bias = Math.round(totalSignedBias / n);

  return {
    records,
    mae,
    rmse,
    bias,
    materialDeviationsCount: materialDeviations,
  };
}

export const aggregateWeeklyCashPositions = aggregateWeeklyForecast;
export const identifyLiquidityBottlenecks = detectBottlenecks;

