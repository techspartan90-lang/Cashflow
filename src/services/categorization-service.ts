/**
 * Rule-Based Transaction Categorization Engine
 * CashFlow Intelligence — Phase 3: Transaction Import & Financial Data Quality
 *
 * Implements deterministic pattern matching for MSME cash flow categorization.
 * Designed with a pluggable interface for future AI model integration.
 */

export type InflowCategory =
  | 'Cash Sales'
  | 'Accounts Receivable Collection'
  | 'Loan Proceeds'
  | 'Owner Contribution'
  | 'Refund Received'
  | 'Other Income';

export type OutflowCategory =
  | 'Supplier Payment'
  | 'Inventory Purchase'
  | 'Rent'
  | 'Salaries'
  | 'Utilities'
  | 'Taxes'
  | 'Loan Repayment'
  | 'Marketing'
  | 'Insurance'
  | 'Transportation'
  | 'Software Subscription'
  | 'Other Expense';

export type TransactionCategoryName = InflowCategory | OutflowCategory;

export interface CategoryMatchResult {
  category: TransactionCategoryName;
  confidence: number; // 0.0 to 1.0
  matchedRule: string;
  source: 'rule_engine' | 'manual_override' | 'ai_extension_point';
}

interface PatternRule {
  category: TransactionCategoryName;
  type: 'inflow' | 'outflow';
  patterns: RegExp[];
  confidence: number;
}

const CATEGORIZATION_RULES: PatternRule[] = [
  // --- INFLOWS ---
  {
    category: 'Accounts Receivable Collection',
    type: 'inflow',
    patterns: [
      /\b(invoice|inv[-_#\s]?\d+|collection|receivable|client payment|customer remittance)\b/i,
      /\b(neft|rtgs|imps|upi)\b.*\b(received|from|cr)\b/i,
    ],
    confidence: 0.9,
  },
  {
    category: 'Cash Sales',
    type: 'inflow',
    patterns: [
      /\b(cash sale|pos sale|counter sale|retail sale|daily collection|store sales|walk-in)\b/i,
    ],
    confidence: 0.95,
  },
  {
    category: 'Loan Proceeds',
    type: 'inflow',
    patterns: [
      /\b(loan disburs|credit line draw|overdraft credit|working capital loan|term loan credit)\b/i,
    ],
    confidence: 0.95,
  },
  {
    category: 'Owner Contribution',
    type: 'inflow',
    patterns: [
      /\b(capital infusion|partner capital|director loan|owner fund|equity infusion)\b/i,
    ],
    confidence: 0.95,
  },
  {
    category: 'Refund Received',
    type: 'inflow',
    patterns: [
      /\b(refund|reversal|chargeback credit|rebate|vendor refund|tax refund)\b/i,
    ],
    confidence: 0.9,
  },

  // --- OUTFLOWS ---
  {
    category: 'Salaries',
    type: 'outflow',
    patterns: [
      /\b(salary|payroll|wages|staff advance|stipend|employee|bonus|pf contribution|esi)\b/i,
    ],
    confidence: 0.95,
  },
  {
    category: 'Rent',
    type: 'outflow',
    patterns: [
      /\b(rent|lease|premises rental|office lease|godown rent|warehouse rent)\b/i,
    ],
    confidence: 0.95,
  },
  {
    category: 'Taxes',
    type: 'outflow',
    patterns: [
      /\b(gst|tds|advance tax|income tax|vat|professional tax|statutory duty|challan)\b/i,
    ],
    confidence: 0.95,
  },
  {
    category: 'Loan Repayment',
    type: 'outflow',
    patterns: [
      /\b(emi|loan repay|interest payment|bank charge|loan debit|principal payment)\b/i,
    ],
    confidence: 0.9,
  },
  {
    category: 'Utilities',
    type: 'outflow',
    patterns: [
      /\b(electricity|water bill|power bill|broadband|internet|telephone|mobile bill|gas)\b/i,
    ],
    confidence: 0.9,
  },
  {
    category: 'Software Subscription',
    type: 'outflow',
    patterns: [
      /\b(aws|google workspace|zoho|tally|microsoft|adobe|slack|github|saas|subscription|domain|hosting)\b/i,
    ],
    confidence: 0.95,
  },
  {
    category: 'Marketing',
    type: 'outflow',
    patterns: [
      /\b(marketing|advertising|facebook ads|meta ads|google ads|pr agency|branding|promotions)\b/i,
    ],
    confidence: 0.9,
  },
  {
    category: 'Insurance',
    type: 'outflow',
    patterns: [
      /\b(insurance|premium|policy|mediclaim|fire insurance|transit insurance)\b/i,
    ],
    confidence: 0.95,
  },
  {
    category: 'Transportation',
    type: 'outflow',
    patterns: [
      /\b(freight|courier|transport|logistics|shipping|cargo|fuel|diesel|petrol|toll)\b/i,
    ],
    confidence: 0.9,
  },
  {
    category: 'Inventory Purchase',
    type: 'outflow',
    patterns: [
      /\b(raw material|inventory purchase|stock purchase|goods receipt|packaging material|packing box)\b/i,
    ],
    confidence: 0.85,
  },
  {
    category: 'Supplier Payment',
    type: 'outflow',
    patterns: [
      /\b(vendor|supplier|po[-_#\s]?\d+|bill payment|traders|wholesale|distributor)\b/i,
    ],
    confidence: 0.85,
  },
];

export class CategorizationService {
  /**
   * Evaluates text fields using deterministic pattern heuristics
   */
  static categorizeTransaction(
    type: 'inflow' | 'outflow',
    description: string = '',
    counterparty: string = ''
  ): CategoryMatchResult {
    const combinedText = `${description} ${counterparty}`.trim();

    if (!combinedText) {
      return {
        category: type === 'inflow' ? 'Other Income' : 'Other Expense',
        confidence: 0.3,
        matchedRule: 'empty_text_default',
        source: 'rule_engine',
      };
    }

    // Check rules for the specified transaction type
    const candidateRules = CATEGORIZATION_RULES.filter((r) => r.type === type);

    for (const rule of candidateRules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(combinedText)) {
          return {
            category: rule.category,
            confidence: rule.confidence,
            matchedRule: pattern.toString(),
            source: 'rule_engine',
          };
        }
      }
    }

    // Default fallback
    return {
      category: type === 'inflow' ? 'Other Income' : 'Other Expense',
      confidence: 0.4,
      matchedRule: 'unmatched_default_fallback',
      source: 'rule_engine',
    };
  }

  /**
   * Returns all supported inflow categories
   */
  static getInflowCategories(): InflowCategory[] {
    return [
      'Cash Sales',
      'Accounts Receivable Collection',
      'Loan Proceeds',
      'Owner Contribution',
      'Refund Received',
      'Other Income',
    ];
  }

  /**
   * Returns all supported outflow categories
   */
  static getOutflowCategories(): OutflowCategory[] {
    return [
      'Supplier Payment',
      'Inventory Purchase',
      'Rent',
      'Salaries',
      'Utilities',
      'Taxes',
      'Loan Repayment',
      'Marketing',
      'Insurance',
      'Transportation',
      'Software Subscription',
      'Other Expense',
    ];
  }
}
