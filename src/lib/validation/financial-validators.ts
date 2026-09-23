/**
 * Financial Backend Validation Schemas & Engine
 * CashFlow Intelligence — Phase 2: Database Schema & Financial Foundation
 */

export interface ValidationErrorResponse {
  success: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    fields: Record<string, string>;
  };
}

export interface ValidationSuccessResponse<T> {
  success: true;
  data: T;
}

export type ValidationResult<T> = ValidationSuccessResponse<T> | ValidationErrorResponse;

function isValidDate(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}

function isValidAmount(val: unknown, min = 0.01, max = 999999999999.99): boolean {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return false;
  return val >= min && val <= max;
}

function isValidCurrency(val: unknown): boolean {
  return typeof val === 'string' && /^[A-Z]{3}$/.test(val);
}

function isValidUUID(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

/**
 * 1. Organization Creation Validation
 */
export interface CreateOrganizationInput {
  name: string;
  business_type: string;
  currency?: string;
  timezone?: string;
  minimum_cash_threshold?: number;
}

export function validateCreateOrganization(input: unknown): ValidationResult<CreateOrganizationInput> {
  const fields: Record<string, string> = {};
  if (!input || typeof input !== 'object') {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Input must be a valid JSON object', fields: { input: 'Missing body' } },
    };
  }

  const data = input as Record<string, any>;

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    fields.name = 'Organization name is required and cannot be empty.';
  }

  if (!data.business_type || typeof data.business_type !== 'string' || !data.business_type.trim()) {
    fields.business_type = 'Business type is required (e.g. retail, wholesale, manufacturing, saas).';
  }

  if (data.currency !== undefined && !isValidCurrency(data.currency)) {
    fields.currency = 'Currency must be a 3-letter ISO-4217 uppercase code (e.g. USD, INR, EUR).';
  }

  if (data.minimum_cash_threshold !== undefined && (typeof data.minimum_cash_threshold !== 'number' || data.minimum_cash_threshold < 0)) {
    fields.minimum_cash_threshold = 'Minimum cash threshold must be a non-negative number.';
  }

  if (Object.keys(fields).length > 0) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid organization details provided.',
        fields,
      },
    };
  }

  return {
    success: true,
    data: {
      name: data.name.trim(),
      business_type: data.business_type.trim(),
      currency: data.currency ? data.currency.trim().toUpperCase() : 'INR',
      timezone: data.timezone || 'UTC',
      minimum_cash_threshold: data.minimum_cash_threshold ?? 0,
    },
  };
}

/**
 * 2. Bank Account Creation Validation
 */
export interface CreateBankAccountInput {
  organization_id: string;
  account_name: string;
  account_type: string;
  opening_balance?: number;
  current_balance?: number;
  currency: string;
  is_active?: boolean;
}

export function validateCreateBankAccount(input: unknown): ValidationResult<CreateBankAccountInput> {
  const fields: Record<string, string> = {};
  if (!input || typeof input !== 'object') {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Input must be an object', fields: { input: 'Missing body' } },
    };
  }

  const data = input as Record<string, any>;

  if (!isValidUUID(data.organization_id)) {
    fields.organization_id = 'Valid organization UUID is required.';
  }

  if (!data.account_name || typeof data.account_name !== 'string' || !data.account_name.trim()) {
    fields.account_name = 'Bank account name is required.';
  }

  if (!data.account_type || typeof data.account_type !== 'string' || !data.account_type.trim()) {
    fields.account_type = 'Bank account type is required (e.g. checking, savings, line_of_credit).';
  }

  if (data.opening_balance !== undefined && (typeof data.opening_balance !== 'number' || isNaN(data.opening_balance))) {
    fields.opening_balance = 'Opening balance must be a valid monetary numeric value.';
  }

  if (!isValidCurrency(data.currency)) {
    fields.currency = 'Currency must be a valid 3-letter code (e.g. INR, USD).';
  }

  if (Object.keys(fields).length > 0) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid bank account parameters.',
        fields,
      },
    };
  }

  return {
    success: true,
    data: {
      organization_id: data.organization_id,
      account_name: data.account_name.trim(),
      account_type: data.account_type.trim(),
      opening_balance: data.opening_balance ?? 0,
      current_balance: data.current_balance ?? data.opening_balance ?? 0,
      currency: data.currency.trim().toUpperCase(),
      is_active: data.is_active ?? true,
    },
  };
}

/**
 * 3. Transaction Creation Validation
 */
export interface CreateTransactionInput {
  organization_id: string;
  bank_account_id?: string | null;
  transaction_type: 'inflow' | 'outflow';
  category: string;
  description?: string;
  amount: number;
  transaction_date: string;
  settlement_date?: string | null;
  counterparty: string;
  reference_number?: string | null;
  status?: 'pending' | 'completed' | 'cancelled';
  source?: 'manual' | 'csv_import' | 'bank_integration' | 'system_generated';
  is_recurring?: boolean;
}

export function validateCreateTransaction(input: unknown): ValidationResult<CreateTransactionInput> {
  const fields: Record<string, string> = {};
  if (!input || typeof input !== 'object') {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Input must be an object', fields: { input: 'Missing body' } },
    };
  }

  const data = input as Record<string, any>;

  if (!isValidUUID(data.organization_id)) {
    fields.organization_id = 'Valid organization UUID is required.';
  }

  if (data.bank_account_id && !isValidUUID(data.bank_account_id)) {
    fields.bank_account_id = 'Bank account ID must be a valid UUID.';
  }

  if (!['inflow', 'outflow'].includes(data.transaction_type)) {
    fields.transaction_type = "Transaction type must be strictly 'inflow' or 'outflow'.";
  }

  if (!data.category || typeof data.category !== 'string' || !data.category.trim()) {
    fields.category = 'Transaction category is required.';
  }

  if (!isValidAmount(data.amount)) {
    fields.amount = 'Amount must be a positive number greater than 0.00.';
  }

  if (!isValidDate(data.transaction_date)) {
    fields.transaction_date = 'Transaction date must be a valid date in YYYY-MM-DD format.';
  }

  if (data.settlement_date) {
    if (!isValidDate(data.settlement_date)) {
      fields.settlement_date = 'Settlement date must be a valid date in YYYY-MM-DD format.';
    } else if (data.transaction_date && data.settlement_date < data.transaction_date) {
      fields.settlement_date = 'Settlement date cannot be prior to transaction date.';
    }
  }

  if (!data.counterparty || typeof data.counterparty !== 'string' || !data.counterparty.trim()) {
    fields.counterparty = 'Counterparty name is required.';
  }

  if (data.status && !['pending', 'completed', 'cancelled'].includes(data.status)) {
    fields.status = "Status must be 'pending', 'completed', or 'cancelled'.";
  }

  if (data.source && !['manual', 'csv_import', 'bank_integration', 'system_generated'].includes(data.source)) {
    fields.source = "Source must be 'manual', 'csv_import', 'bank_integration', or 'system_generated'.";
  }

  if (Object.keys(fields).length > 0) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Transaction validation failed.',
        fields,
      },
    };
  }

  return {
    success: true,
    data: {
      organization_id: data.organization_id,
      bank_account_id: data.bank_account_id || null,
      transaction_type: data.transaction_type,
      category: data.category.trim(),
      description: (data.description || '').trim(),
      amount: Math.round(data.amount * 100) / 100,
      transaction_date: data.transaction_date,
      settlement_date: data.settlement_date || null,
      counterparty: data.counterparty.trim(),
      reference_number: data.reference_number?.trim() || null,
      status: data.status || 'completed',
      source: data.source || 'manual',
      is_recurring: Boolean(data.is_recurring),
    },
  };
}

/**
 * 4. Transaction Update Validation
 */
export interface UpdateTransactionInput {
  bank_account_id?: string | null;
  category?: string;
  description?: string;
  amount?: number;
  transaction_date?: string;
  settlement_date?: string | null;
  counterparty?: string;
  reference_number?: string | null;
  status?: 'pending' | 'completed' | 'cancelled';
  is_recurring?: boolean;
}

export function validateUpdateTransaction(input: unknown): ValidationResult<UpdateTransactionInput> {
  const fields: Record<string, string> = {};
  if (!input || typeof input !== 'object') {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Input must be an object', fields: { input: 'Missing body' } },
    };
  }

  const data = input as Record<string, any>;
  const cleanData: UpdateTransactionInput = {};

  if (data.bank_account_id !== undefined) {
    if (data.bank_account_id !== null && !isValidUUID(data.bank_account_id)) {
      fields.bank_account_id = 'Bank account ID must be a valid UUID or null.';
    } else {
      cleanData.bank_account_id = data.bank_account_id;
    }
  }

  if (data.amount !== undefined) {
    if (!isValidAmount(data.amount)) {
      fields.amount = 'Amount must be greater than 0.00.';
    } else {
      cleanData.amount = Math.round(data.amount * 100) / 100;
    }
  }

  if (data.category !== undefined) {
    if (typeof data.category !== 'string' || !data.category.trim()) {
      fields.category = 'Category cannot be empty.';
    } else {
      cleanData.category = data.category.trim();
    }
  }

  if (data.transaction_date !== undefined) {
    if (!isValidDate(data.transaction_date)) {
      fields.transaction_date = 'Transaction date must be YYYY-MM-DD.';
    } else {
      cleanData.transaction_date = data.transaction_date;
    }
  }

  if (data.settlement_date !== undefined && data.settlement_date !== null) {
    if (!isValidDate(data.settlement_date)) {
      fields.settlement_date = 'Settlement date must be YYYY-MM-DD.';
    } else {
      cleanData.settlement_date = data.settlement_date;
    }
  }

  if (data.status !== undefined) {
    if (!['pending', 'completed', 'cancelled'].includes(data.status)) {
      fields.status = "Status must be 'pending', 'completed', or 'cancelled'.";
    } else {
      cleanData.status = data.status;
    }
  }

  if (data.counterparty !== undefined) {
    if (typeof data.counterparty !== 'string' || !data.counterparty.trim()) {
      fields.counterparty = 'Counterparty cannot be empty.';
    } else {
      cleanData.counterparty = data.counterparty.trim();
    }
  }

  if (data.description !== undefined) {
    cleanData.description = typeof data.description === 'string' ? data.description.trim() : '';
  }

  if (data.reference_number !== undefined) {
    cleanData.reference_number = data.reference_number ? String(data.reference_number).trim() : null;
  }

  if (data.is_recurring !== undefined) {
    cleanData.is_recurring = Boolean(data.is_recurring);
  }

  if (Object.keys(fields).length > 0) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid update fields provided.', fields },
    };
  }

  return { success: true, data: cleanData };
}

/**
 * 5. Accounts Receivable Validation
 */
export interface CreateAccountsReceivableInput {
  organization_id: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: number;
  outstanding_amount: number;
  expected_collection_date: string;
  status?: 'open' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
}

export function validateAccountsReceivable(input: unknown): ValidationResult<CreateAccountsReceivableInput> {
  const fields: Record<string, string> = {};
  if (!input || typeof input !== 'object') {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Input must be an object', fields: { input: 'Missing body' } },
    };
  }

  const data = input as Record<string, any>;

  if (!isValidUUID(data.organization_id)) fields.organization_id = 'Valid organization UUID is required.';
  if (!isValidUUID(data.customer_id)) fields.customer_id = 'Valid customer UUID is required.';
  if (!data.invoice_number || typeof data.invoice_number !== 'string' || !data.invoice_number.trim()) {
    fields.invoice_number = 'Invoice number is required.';
  }

  if (!isValidDate(data.invoice_date)) fields.invoice_date = 'Invoice date must be YYYY-MM-DD.';
  if (!isValidDate(data.due_date)) fields.due_date = 'Due date must be YYYY-MM-DD.';
  if (!isValidDate(data.expected_collection_date)) fields.expected_collection_date = 'Expected collection date must be YYYY-MM-DD.';

  if (data.invoice_date && data.due_date && data.due_date < data.invoice_date) {
    fields.due_date = 'Due date cannot be before invoice date.';
  }

  if (!isValidAmount(data.invoice_amount)) {
    fields.invoice_amount = 'Invoice amount must be a positive number.';
  }

  if (typeof data.outstanding_amount !== 'number' || data.outstanding_amount < 0) {
    fields.outstanding_amount = 'Outstanding amount must be non-negative.';
  } else if (data.invoice_amount && data.outstanding_amount > data.invoice_amount) {
    fields.outstanding_amount = 'Outstanding amount cannot exceed invoice amount.';
  }

  if (data.status && !['open', 'partially_paid', 'paid', 'overdue', 'cancelled'].includes(data.status)) {
    fields.status = 'Invalid invoice status.';
  }

  if (Object.keys(fields).length > 0) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Accounts receivable validation failed.', fields },
    };
  }

  return {
    success: true,
    data: {
      organization_id: data.organization_id,
      customer_id: data.customer_id,
      invoice_number: data.invoice_number.trim(),
      invoice_date: data.invoice_date,
      due_date: data.due_date,
      invoice_amount: Math.round(data.invoice_amount * 100) / 100,
      outstanding_amount: Math.round(data.outstanding_amount * 100) / 100,
      expected_collection_date: data.expected_collection_date,
      status: data.status || (data.outstanding_amount === 0 ? 'paid' : 'open'),
    },
  };
}

/**
 * 6. Accounts Payable Validation
 */
export interface CreateAccountsPayableInput {
  organization_id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: number;
  outstanding_amount: number;
  expected_payment_date: string;
  status?: 'open' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
}

export function validateAccountsPayable(input: unknown): ValidationResult<CreateAccountsPayableInput> {
  const fields: Record<string, string> = {};
  if (!input || typeof input !== 'object') {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Input must be an object', fields: { input: 'Missing body' } },
    };
  }

  const data = input as Record<string, any>;

  if (!isValidUUID(data.organization_id)) fields.organization_id = 'Valid organization UUID is required.';
  if (!isValidUUID(data.supplier_id)) fields.supplier_id = 'Valid supplier UUID is required.';
  if (!data.invoice_number || typeof data.invoice_number !== 'string' || !data.invoice_number.trim()) {
    fields.invoice_number = 'Invoice number is required.';
  }

  if (!isValidDate(data.invoice_date)) fields.invoice_date = 'Invoice date must be YYYY-MM-DD.';
  if (!isValidDate(data.due_date)) fields.due_date = 'Due date must be YYYY-MM-DD.';
  if (!isValidDate(data.expected_payment_date)) fields.expected_payment_date = 'Expected payment date must be YYYY-MM-DD.';

  if (data.invoice_date && data.due_date && data.due_date < data.invoice_date) {
    fields.due_date = 'Due date cannot be before invoice date.';
  }

  if (!isValidAmount(data.invoice_amount)) {
    fields.invoice_amount = 'Invoice amount must be a positive number.';
  }

  if (typeof data.outstanding_amount !== 'number' || data.outstanding_amount < 0) {
    fields.outstanding_amount = 'Outstanding amount must be non-negative.';
  } else if (data.invoice_amount && data.outstanding_amount > data.invoice_amount) {
    fields.outstanding_amount = 'Outstanding amount cannot exceed invoice amount.';
  }

  if (data.status && !['open', 'partially_paid', 'paid', 'overdue', 'cancelled'].includes(data.status)) {
    fields.status = 'Invalid invoice status.';
  }

  if (Object.keys(fields).length > 0) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Accounts payable validation failed.', fields },
    };
  }

  return {
    success: true,
    data: {
      organization_id: data.organization_id,
      supplier_id: data.supplier_id,
      invoice_number: data.invoice_number.trim(),
      invoice_date: data.invoice_date,
      due_date: data.due_date,
      invoice_amount: Math.round(data.invoice_amount * 100) / 100,
      outstanding_amount: Math.round(data.outstanding_amount * 100) / 100,
      expected_payment_date: data.expected_payment_date,
      status: data.status || (data.outstanding_amount === 0 ? 'paid' : 'open'),
    },
  };
}

/**
 * 7. Recurring Cash Flow Validation
 */
export interface CreateRecurringCashFlowInput {
  organization_id: string;
  name: string;
  flow_type: 'inflow' | 'outflow';
  category: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
  next_occurrence_date: string;
  end_date?: string | null;
  is_active?: boolean;
}

export function validateRecurringCashFlow(input: unknown): ValidationResult<CreateRecurringCashFlowInput> {
  const fields: Record<string, string> = {};
  if (!input || typeof input !== 'object') {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Input must be an object', fields: { input: 'Missing body' } },
    };
  }

  const data = input as Record<string, any>;

  if (!isValidUUID(data.organization_id)) fields.organization_id = 'Valid organization UUID is required.';
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) fields.name = 'Name is required.';
  if (!['inflow', 'outflow'].includes(data.flow_type)) fields.flow_type = "Flow type must be 'inflow' or 'outflow'.";
  if (!data.category || typeof data.category !== 'string' || !data.category.trim()) fields.category = 'Category is required.';
  if (!isValidAmount(data.amount)) fields.amount = 'Amount must be greater than 0.00.';

  const validFreqs = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'];
  if (!validFreqs.includes(data.frequency)) {
    fields.frequency = `Frequency must be one of: ${validFreqs.join(', ')}.`;
  }

  if (!isValidDate(data.next_occurrence_date)) {
    fields.next_occurrence_date = 'Next occurrence date must be YYYY-MM-DD.';
  }

  if (data.end_date) {
    if (!isValidDate(data.end_date)) {
      fields.end_date = 'End date must be YYYY-MM-DD.';
    } else if (data.next_occurrence_date && data.end_date < data.next_occurrence_date) {
      fields.end_date = 'End date cannot be prior to next occurrence date.';
    }
  }

  if (Object.keys(fields).length > 0) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Recurring cash flow validation failed.', fields },
    };
  }

  return {
    success: true,
    data: {
      organization_id: data.organization_id,
      name: data.name.trim(),
      flow_type: data.flow_type,
      category: data.category.trim(),
      amount: Math.round(data.amount * 100) / 100,
      frequency: data.frequency,
      next_occurrence_date: data.next_occurrence_date,
      end_date: data.end_date || null,
      is_active: data.is_active ?? true,
    },
  };
}

/**
 * 8. Forecast Assumptions Validation
 */
export interface CreateForecastAssumptionInput {
  forecast_id: string;
  assumption_type: string;
  description: string;
  value: Record<string, any>;
  source: string;
  confidence?: number;
}

export function validateForecastAssumption(input: unknown): ValidationResult<CreateForecastAssumptionInput> {
  const fields: Record<string, string> = {};
  if (!input || typeof input !== 'object') {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Input must be an object', fields: { input: 'Missing body' } },
    };
  }

  const data = input as Record<string, any>;

  if (!isValidUUID(data.forecast_id)) fields.forecast_id = 'Valid forecast UUID is required.';
  if (!data.assumption_type || typeof data.assumption_type !== 'string' || !data.assumption_type.trim()) {
    fields.assumption_type = 'Assumption type is required (e.g. sales_growth, payment_lag).';
  }
  if (!data.description || typeof data.description !== 'string' || !data.description.trim()) {
    fields.description = 'Assumption description is required.';
  }
  if (!data.value || typeof data.value !== 'object') {
    fields.value = 'Value must be a valid JSON object.';
  }
  if (!data.source || typeof data.source !== 'string' || !data.source.trim()) {
    fields.source = 'Source is required (e.g. historical_trend, user_override, market_benchmark).';
  }
  if (data.confidence !== undefined && (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1)) {
    fields.confidence = 'Confidence score must be between 0.00 and 1.00.';
  }

  if (Object.keys(fields).length > 0) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Forecast assumption validation failed.', fields },
    };
  }

  return {
    success: true,
    data: {
      forecast_id: data.forecast_id,
      assumption_type: data.assumption_type.trim(),
      description: data.description.trim(),
      value: data.value,
      source: data.source.trim(),
      confidence: data.confidence ?? 1.0,
    },
  };
}
