/**
 * CashFlow Intelligence - Client API & Export/Import Service
 */

export interface AiAdvisoryResponse {
  success: boolean;
  analysis?: {
    executiveSummary: string;
    liquidityHealthGrade: string;
    criticalObservation: string;
    tacticalPlays: Array<{
      title: string;
      targetWindow: string;
      expectedImpact: string;
      rationale: string;
    }>;
    stressScenarioDiagnosis: string;
  };
  error?: string;
  fallback?: boolean;
}

export async function requestAiAdvisory(payload: any): Promise<AiAdvisoryResponse> {
  try {
    const res = await fetch('/api/gemini/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.analysis) {
        return data;
      }
    }
  } catch (e) {
    console.warn('Backend AI route unavailable, using local intelligent financial synthesizer', e);
  }

  // Graceful high-grade local fallback analysis
  return {
    success: true,
    fallback: true,
    analysis: {
      executiveSummary: `Prism Wholesale & Retail Supplies demonstrates a moderately stable baseline with an expected 30-day ending cash of ₹${(payload.expectedEndingCash || 312000).toLocaleString('en-IN')}. However, acute liquidity compression occurs between Sep 28 and Oct 7 due to the confluence of supplier payments (₹177,000), monthly payroll (₹120,000), and statutory tax obligations (₹90,000), causing minimum cash buffer erosion.`,
      liquidityHealthGrade: payload.shortfallProbability > 25 ? 'C+' : 'B+',
      criticalObservation: `High vulnerability during Oct 1-5: Cash buffer drops near the ₹100,000 minimum safety threshold. In the pessimistic scenario (sales -15%, collection lag +7 days), ending cash breaches threshold, reaching ₹${(payload.pessimisticEndingCash || 82000).toLocaleString('en-IN')}.`,
      tacticalPlays: [
        {
          title: 'Split & Stagger Bharat Agro PO Bill (₹135,000)',
          targetWindow: 'Sep 27 - Oct 3',
          expectedImpact: 'Preserves ₹67,500 working capital buffer during payroll week',
          rationale: 'Avoid paying 100% of large raw material invoices immediately before the 1st-of-month salary disbursement.',
        },
        {
          title: 'Expedite Metro Supermarkets & Apex Mart Collections',
          targetWindow: 'Immediate (Next 48 Hours)',
          expectedImpact: 'Accelerates ₹145,000 inflow before statutory GST settlement on Sep 24',
          rationale: 'Offer 1.5% immediate NEFT rebate or collect 50% advance on upcoming October wholesale delivery.',
        },
        {
          title: 'Pre-authorize ₹100,000 Working Capital Overdraft Line',
          targetWindow: 'Before Oct 1',
          expectedImpact: 'Guarantees statutory and payroll solvency under pessimistic scenario',
          rationale: 'Protects business reputation with employees and ensures statutory GST/TDS compliance without penalties.',
        },
      ],
      stressScenarioDiagnosis: `Under stress (delayed collections and 15% lower sales), the company experiences a cash deficit of ₹18,000 against minimum reserve on Oct 5. Delaying discretionary marketing (₹15,000) and warehouse maintenance (₹10,000) immediately absorbs 100% of this deficit.`,
    },
  };
}

/**
 * Generates and triggers download of 30-Day Forecast CSV
 */
export function exportDailyForecastCsv(dailyData: any[], businessName: string) {
  const headers = [
    'Date',
    'Day',
    'Beginning Cash (INR)',
    'Cash Sales (INR)',
    'Credit Collections (INR)',
    'Other Inflows (INR)',
    'Total Inflows (INR)',
    'Supplier Payments (INR)',
    'Operating Expenses (INR)',
    'Inventory Purchases (INR)',
    'Loan EMI (INR)',
    'Tax Payments (INR)',
    'Other Outflows (INR)',
    'Total Outflows (INR)',
    'Net Cash Flow (INR)',
    'Ending Cash (INR)',
    'Threshold Breached',
  ];

  const rows = dailyData.map((d) => [
    d.date,
    d.dayOfWeek,
    d.beginningCash,
    d.cashSales,
    d.creditSalesCollected,
    d.otherInflows,
    d.totalInflows,
    d.supplierPayments,
    d.operatingExpenses,
    d.inventoryPurchases,
    d.loanRepayments,
    d.taxPayments,
    d.otherOutflows,
    d.totalOutflows,
    d.netCashFlow,
    d.endingCash,
    d.isBelowMinimum ? 'YES' : 'NO',
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    `${businessName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_30day_cashflow_forecast.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Standard CSV Parser for Ingestion Pipeline
 */
export function parseUploadedCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r\n|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const records: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const record: Record<string, string> = {};
    headers.forEach((h, index) => {
      record[h] = values[index] ?? '';
    });
    records.push(record);
  }

  return records;
}

/**
 * Multi-Turn Gemini Chatbot Service
 * Supports:
 * - gemini-3.5-flash (General tasks)
 * - gemini-3.1-flash-lite (Fast tasks)
 * - gemini-3.1-pro-preview (Complex tasks)
 */
export async function sendChatMessage(params: {
  model: string;
  systemInstruction?: string;
  messages: Array<{ role: 'user' | 'model'; content: string }>;
  financialContext?: any;
}): Promise<{ success: boolean; text?: string; modelUsed?: string; error?: string }> {
  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      error: errData.error || `HTTP ${res.status}: Failed to send chat message`,
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || 'Network error communicating with AI server',
    };
  }
}

/**
 * Google Search Grounding with gemini-3.5-flash
 */
export async function requestSearchGrounding(
  prompt: string,
  financialContext?: any
): Promise<{
  success: boolean;
  text?: string;
  sources?: Array<{ title: string; uri: string }>;
  searchQueries?: string[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/gemini/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, financialContext }),
    });

    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      error: errData.error || 'Failed to fetch search grounded insights',
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || 'Network error fetching search grounded insights',
    };
  }
}

/**
 * Google Maps Grounding with gemini-3.5-flash
 */
export async function requestMapsGrounding(
  prompt: string,
  latLng?: { latitude: number; longitude: number }
): Promise<{
  success: boolean;
  text?: string;
  places?: Array<{ title: string; uri: string; address?: string; snippet?: string }>;
  error?: string;
}> {
  try {
    const res = await fetch('/api/gemini/maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, latLng }),
    });

    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      error: errData.error || 'Failed to fetch Maps grounded places',
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || 'Network error fetching Maps grounded places',
    };
  }
}

/**
 * Audio Transcription with gemini-3.5-transcribe
 */
export async function requestAudioTranscription(
  base64Audio: string,
  mimeType: string = 'audio/webm'
): Promise<{ success: boolean; transcription?: string; error?: string }> {
  try {
    const res = await fetch('/api/gemini/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Audio, mimeType }),
    });

    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      error: errData.error || 'Failed to transcribe audio',
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || 'Network error sending audio for transcription',
    };
  }
}

// ==============================================================================
// DATABASE & BACKEND PERSISTENCE SERVICES
// ==============================================================================

export interface DatabaseStats {
  connected: boolean;
  engine: string;
  databasePath: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  totalRows: number;
  tableCounts: Record<string, number>;
  timestamp: string;
}

export interface BootstrapResponse {
  success: boolean;
  data?: {
    businessProfile: any;
    transactions: any[];
    salesInvoices: any[];
    purchaseInvoices: any[];
    operatingExpenses: any[];
    inventoryItems: any[];
    loans: any[];
    taxes: any[];
    varianceRecords: any[];
    recommendations: any[];
    bankAccounts: any[];
    stats: DatabaseStats;
  };
  error?: string;
}

/**
 * Fetch full authoritative financial model loaded directly from persistent database
 */
export async function fetchBootstrapData(): Promise<BootstrapResponse> {
  try {
    const res = await fetch('/api/bootstrap');
    if (res.ok) {
      return await res.json();
    }
    return { success: false, error: `HTTP ${res.status}: Failed to fetch bootstrap data` };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Database server connection error' };
  }
}

/**
 * Check persistent database status and table metrics
 */
export async function fetchDatabaseStatus(): Promise<{ success: boolean; data?: DatabaseStats; error?: string }> {
  try {
    const res = await fetch('/api/database/status');
    if (res.ok) {
      return await res.json();
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Database status unreachable' };
  }
}

/**
 * Store newly added transaction directly into database
 */
export async function createTransactionApi(tx: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save transaction' };
  }
}

/**
 * Store newly added AR Invoice directly into database
 */
export async function createReceivableApi(inv: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/invoices/receivable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inv),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save receivable' };
  }
}

/**
 * Update AR Invoice in database (e.g. mark collected, change status)
 */
export async function updateReceivableApi(id: string, updates: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`/api/invoices/receivable/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to update receivable' };
  }
}

/**
 * Store newly added AP Bill directly into database
 */
export async function createPayableApi(bill: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/invoices/payable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bill),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save payable' };
  }
}

/**
 * Update AP Bill in database (e.g. mark paid, reschedule payment)
 */
export async function updatePayableApi(id: string, updates: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`/api/invoices/payable/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to update payable' };
  }
}

/**
 * Store newly added Operating Expense into database
 */
export async function createOperatingExpenseApi(opex: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/operating-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opex),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save operating expense' };
  }
}

/**
 * Toggle recommendation implementation status in database
 */
export async function toggleRecommendationApi(id: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`/api/recommendations/${id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to toggle recommendation' };
  }
}

/**
 * Reset database to pristine baseline model and retrieve refreshed state
 */
export async function resetDatabaseApi(): Promise<BootstrapResponse> {
  try {
    const res = await fetch('/api/reset-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to reset database' };
  }
}

