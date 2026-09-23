/**
 * Supabase Database TypeScript Schema Definitions
 * CashFlow Intelligence — Phase 2: Database Schema & Financial Foundation
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'owner' | 'admin' | 'accountant' | 'viewer';
export type TransactionType = 'inflow' | 'outflow';
export type TransactionStatus = 'pending' | 'completed' | 'cancelled';
export type TransactionSource = 'manual' | 'csv_import' | 'bank_integration' | 'system_generated';
export type InvoiceStatus = 'open' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
export type ForecastRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ScenarioType = 'optimistic' | 'expected' | 'pessimistic';
export type AlertSeverity = 'informational' | 'warning' | 'critical' | 'low' | 'medium' | 'high';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed' | 'expired';

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          business_type: string;
          currency: string;
          timezone: string;
          minimum_cash_threshold: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          business_type: string;
          currency?: string;
          timezone?: string;
          minimum_cash_threshold?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          business_type?: string;
          currency?: string;
          timezone?: string;
          minimum_cash_threshold?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: UserRole;
          created_at?: string;
        };
      };
      bank_accounts: {
        Row: {
          id: string;
          organization_id: string;
          account_name: string;
          account_type: string;
          opening_balance: number;
          current_balance: number;
          currency: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          account_name: string;
          account_type: string;
          opening_balance?: number;
          current_balance?: number;
          currency: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          account_name?: string;
          account_type?: string;
          opening_balance?: number;
          current_balance?: number;
          currency?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      financial_transactions: {
        Row: {
          id: string;
          organization_id: string;
          bank_account_id: string | null;
          transaction_type: TransactionType;
          category: string;
          description: string;
          amount: number;
          transaction_date: string;
          settlement_date: string | null;
          counterparty: string;
          reference_number: string | null;
          status: TransactionStatus;
          source: TransactionSource;
          is_recurring: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          bank_account_id?: string | null;
          transaction_type: TransactionType;
          category: string;
          description?: string;
          amount: number;
          transaction_date: string;
          settlement_date?: string | null;
          counterparty: string;
          reference_number?: string | null;
          status?: TransactionStatus;
          source?: TransactionSource;
          is_recurring?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          bank_account_id?: string | null;
          transaction_type?: TransactionType;
          category?: string;
          description?: string;
          amount?: number;
          transaction_date?: string;
          settlement_date?: string | null;
          counterparty?: string;
          reference_number?: string | null;
          status?: TransactionStatus;
          source?: TransactionSource;
          is_recurring?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          email: string | null;
          payment_terms_days: number;
          average_payment_delay_days: number;
          reliability_score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          email?: string | null;
          payment_terms_days?: number;
          average_payment_delay_days?: number;
          reliability_score?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          email?: string | null;
          payment_terms_days?: number;
          average_payment_delay_days?: number;
          reliability_score?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      accounts_receivable: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string;
          invoice_number: string;
          invoice_date: string;
          due_date: string;
          invoice_amount: number;
          outstanding_amount: number;
          expected_collection_date: string;
          status: InvoiceStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          customer_id: string;
          invoice_number: string;
          invoice_date: string;
          due_date: string;
          invoice_amount: number;
          outstanding_amount: number;
          expected_collection_date: string;
          status?: InvoiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          customer_id?: string;
          invoice_number?: string;
          invoice_date?: string;
          due_date?: string;
          invoice_amount?: number;
          outstanding_amount?: number;
          expected_collection_date?: string;
          status?: InvoiceStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          payment_terms_days: number;
          average_payment_delay_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          payment_terms_days?: number;
          average_payment_delay_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          payment_terms_days?: number;
          average_payment_delay_days?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      accounts_payable: {
        Row: {
          id: string;
          organization_id: string;
          supplier_id: string;
          invoice_number: string;
          invoice_date: string;
          due_date: string;
          invoice_amount: number;
          outstanding_amount: number;
          expected_payment_date: string;
          status: InvoiceStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          supplier_id: string;
          invoice_number: string;
          invoice_date: string;
          due_date: string;
          invoice_amount: number;
          outstanding_amount: number;
          expected_payment_date: string;
          status?: InvoiceStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          supplier_id?: string;
          invoice_number?: string;
          invoice_date?: string;
          due_date?: string;
          invoice_amount?: number;
          outstanding_amount?: number;
          expected_payment_date?: string;
          status?: InvoiceStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      recurring_cash_flows: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          flow_type: TransactionType;
          category: string;
          amount: number;
          frequency: RecurringFrequency;
          next_occurrence_date: string;
          end_date: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          flow_type: TransactionType;
          category: string;
          amount: number;
          frequency: RecurringFrequency;
          next_occurrence_date: string;
          end_date?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          flow_type?: TransactionType;
          category?: string;
          amount?: number;
          frequency?: RecurringFrequency;
          next_occurrence_date?: string;
          end_date?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      cash_flow_forecasts: {
        Row: {
          id: string;
          organization_id: string;
          forecast_date: string;
          forecast_version: string;
          beginning_cash: number;
          predicted_inflows: number;
          predicted_outflows: number;
          predicted_net_cash_flow: number;
          predicted_ending_cash: number;
          minimum_cash_threshold: number;
          risk_level: ForecastRiskLevel;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          forecast_date: string;
          forecast_version: string;
          beginning_cash: number;
          predicted_inflows?: number;
          predicted_outflows?: number;
          predicted_net_cash_flow?: number;
          predicted_ending_cash: number;
          minimum_cash_threshold?: number;
          risk_level?: ForecastRiskLevel;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          forecast_date?: string;
          forecast_version?: string;
          beginning_cash?: number;
          predicted_inflows?: number;
          predicted_outflows?: number;
          predicted_net_cash_flow?: number;
          predicted_ending_cash?: number;
          minimum_cash_threshold?: number;
          risk_level?: ForecastRiskLevel;
          created_at?: string;
        };
      };
      forecast_assumptions: {
        Row: {
          id: string;
          forecast_id: string;
          assumption_type: string;
          description: string;
          value: Json;
          source: string;
          confidence: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          forecast_id: string;
          assumption_type: string;
          description: string;
          value: Json;
          source: string;
          confidence?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          forecast_id?: string;
          assumption_type?: string;
          description?: string;
          value?: Json;
          source?: string;
          confidence?: number;
          created_at?: string;
        };
      };
      forecast_scenarios: {
        Row: {
          id: string;
          organization_id: string;
          forecast_version: string;
          scenario_type: ScenarioType;
          assumptions: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          forecast_version: string;
          scenario_type: ScenarioType;
          assumptions?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          forecast_version?: string;
          scenario_type?: ScenarioType;
          assumptions?: Json;
          created_at?: string;
        };
      };
      financial_alerts: {
        Row: {
          id: string;
          organization_id: string;
          alert_type: string;
          severity: AlertSeverity;
          status: AlertStatus;
          title: string;
          description: string;
          fingerprint: string | null;
          related_entity_type: string | null;
          related_entity_id: string | null;
          related_date: string | null;
          forecast_id: string | null;
          trigger_data: Json;
          recommended_review_action: string | null;
          is_read: boolean;
          acknowledged_at: string | null;
          resolved_at: string | null;
          dismissed_at: string | null;
          reactivated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          alert_type: string;
          severity: AlertSeverity;
          status?: AlertStatus;
          title: string;
          description: string;
          fingerprint?: string | null;
          related_entity_type?: string | null;
          related_entity_id?: string | null;
          related_date?: string | null;
          forecast_id?: string | null;
          trigger_data?: Json;
          recommended_review_action?: string | null;
          is_read?: boolean;
          acknowledged_at?: string | null;
          resolved_at?: string | null;
          dismissed_at?: string | null;
          reactivated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          alert_type?: string;
          severity?: AlertSeverity;
          status?: AlertStatus;
          title?: string;
          description?: string;
          fingerprint?: string | null;
          related_entity_type?: string | null;
          related_entity_id?: string | null;
          related_date?: string | null;
          forecast_id?: string | null;
          trigger_data?: Json;
          recommended_review_action?: string | null;
          is_read?: boolean;
          acknowledged_at?: string | null;
          resolved_at?: string | null;
          dismissed_at?: string | null;
          reactivated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          previous_value: Json | null;
          new_value: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          previous_value?: Json | null;
          new_value?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          previous_value?: Json | null;
          new_value?: Json | null;
          created_at?: string;
        };
      };
      import_history: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          file_name: string;
          file_size: number;
          import_type: 'transactions' | 'accounts_receivable' | 'accounts_payable';
          upload_timestamp: string;
          total_rows: number;
          imported_rows: number;
          rejected_rows: number;
          duplicate_rows: number;
          warning_rows: number;
          total_inflows: number;
          total_outflows: number;
          net_cash_flow: number;
          status:
            | 'uploaded'
            | 'validating'
            | 'awaiting_confirmation'
            | 'processing'
            | 'completed'
            | 'partially_completed'
            | 'failed'
            | 'cancelled';
          error_summary: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          file_name: string;
          file_size: number;
          import_type: 'transactions' | 'accounts_receivable' | 'accounts_payable';
          upload_timestamp?: string;
          total_rows: number;
          imported_rows: number;
          rejected_rows: number;
          duplicate_rows: number;
          warning_rows?: number;
          total_inflows?: number;
          total_outflows?: number;
          net_cash_flow?: number;
          status?:
            | 'uploaded'
            | 'validating'
            | 'awaiting_confirmation'
            | 'processing'
            | 'completed'
            | 'partially_completed'
            | 'failed'
            | 'cancelled';
          error_summary?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          file_name?: string;
          file_size?: number;
          import_type?: 'transactions' | 'accounts_receivable' | 'accounts_payable';
          upload_timestamp?: string;
          total_rows?: number;
          imported_rows?: number;
          rejected_rows?: number;
          duplicate_rows?: number;
          warning_rows?: number;
          total_inflows?: number;
          total_outflows?: number;
          net_cash_flow?: number;
          status?:
            | 'uploaded'
            | 'validating'
            | 'awaiting_confirmation'
            | 'processing'
            | 'completed'
            | 'partially_completed'
            | 'failed'
            | 'cancelled';
          error_summary?: Json | null;
          created_at?: string;
        };
      };
      forecast_runs: {
        Row: {
          id: string;
          organization_id: string;
          forecast_version: number;
          scenario_type: 'expected' | 'optimistic' | 'pessimistic';
          start_date: string;
          end_date: string;
          horizon_days: number;
          timezone: string;
          opening_cash: number;
          minimum_cash_threshold: number;
          total_expected_inflows: number;
          total_expected_outflows: number;
          net_cash_flow: number;
          minimum_projected_cash: number;
          shortfall_days: number;
          risk_level: 'low' | 'medium' | 'high' | 'critical';
          assumptions_snapshot: Json;
          calculation_status: 'pending' | 'completed' | 'failed' | 'stale';
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          forecast_version: number;
          scenario_type?: 'expected' | 'optimistic' | 'pessimistic';
          start_date: string;
          end_date: string;
          horizon_days?: number;
          timezone?: string;
          opening_cash: number;
          minimum_cash_threshold?: number;
          total_expected_inflows?: number;
          total_expected_outflows?: number;
          net_cash_flow?: number;
          minimum_projected_cash?: number;
          shortfall_days?: number;
          risk_level?: 'low' | 'medium' | 'high' | 'critical';
          assumptions_snapshot?: Json;
          calculation_status?: 'pending' | 'completed' | 'failed' | 'stale';
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          forecast_version?: number;
          scenario_type?: 'expected' | 'optimistic' | 'pessimistic';
          start_date?: string;
          end_date?: string;
          horizon_days?: number;
          timezone?: string;
          opening_cash?: number;
          minimum_cash_threshold?: number;
          total_expected_inflows?: number;
          total_expected_outflows?: number;
          net_cash_flow?: number;
          minimum_projected_cash?: number;
          shortfall_days?: number;
          risk_level?: 'low' | 'medium' | 'high' | 'critical';
          assumptions_snapshot?: Json;
          calculation_status?: 'pending' | 'completed' | 'failed' | 'stale';
          created_by?: string | null;
          created_at?: string;
        };
      };
      forecast_daily_projections: {
        Row: {
          id: string;
          forecast_run_id: string;
          organization_id: string;
          day_index: number;
          projection_date: string;
          beginning_cash: number;
          expected_inflows: number;
          expected_outflows: number;
          net_cash_flow: number;
          ending_cash: number;
          minimum_threshold: number;
          threshold_status: 'above_threshold' | 'approaching_threshold' | 'below_threshold';
          shortfall_deficit: number;
          risk_factors: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          forecast_run_id: string;
          organization_id: string;
          day_index: number;
          projection_date: string;
          beginning_cash: number;
          expected_inflows?: number;
          expected_outflows?: number;
          net_cash_flow?: number;
          ending_cash: number;
          minimum_threshold?: number;
          threshold_status?: 'above_threshold' | 'approaching_threshold' | 'below_threshold';
          shortfall_deficit?: number;
          risk_factors?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          forecast_run_id?: string;
          organization_id?: string;
          day_index?: number;
          projection_date?: string;
          beginning_cash?: number;
          expected_inflows?: number;
          expected_outflows?: number;
          net_cash_flow?: number;
          ending_cash?: number;
          minimum_threshold?: number;
          threshold_status?: 'above_threshold' | 'approaching_threshold' | 'below_threshold';
          shortfall_deficit?: number;
          risk_factors?: Json;
          created_at?: string;
        };
      };
      forecast_items: {
        Row: {
          id: string;
          forecast_run_id: string;
          organization_id: string;
          scheduled_date: string;
          flow_type: 'inflow' | 'outflow';
          category: string;
          amount: number;
          source: 'accounts_receivable' | 'accounts_payable' | 'recurring_cash_flow' | 'future_transaction' | 'assumption';
          description: string;
          certainty: 'CONFIRMED' | 'EXPECTED' | 'ASSUMED';
          entity_id: string | null;
          scheduling_method: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          forecast_run_id: string;
          organization_id: string;
          scheduled_date: string;
          flow_type: 'inflow' | 'outflow';
          category: string;
          amount: number;
          source: 'accounts_receivable' | 'accounts_payable' | 'recurring_cash_flow' | 'future_transaction' | 'assumption';
          description: string;
          certainty?: 'CONFIRMED' | 'EXPECTED' | 'ASSUMED';
          entity_id?: string | null;
          scheduling_method: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          forecast_run_id?: string;
          organization_id?: string;
          scheduled_date?: string;
          flow_type?: 'inflow' | 'outflow';
          category?: string;
          amount?: number;
          source?: 'accounts_receivable' | 'accounts_payable' | 'recurring_cash_flow' | 'future_transaction' | 'assumption';
          description?: string;
          certainty?: 'CONFIRMED' | 'EXPECTED' | 'ASSUMED';
          entity_id?: string | null;
          scheduling_method?: string;
          metadata?: Json;
          created_at?: string;
        };
      };
      scenarios: {
        Row: {
          id: string;
          organization_id: string;
          base_forecast_id: string;
          name: string;
          description: string | null;
          scenario_type: 'revenue_change' | 'customer_payment_delay' | 'expense_change' | 'unexpected_expense' | 'new_business_commitment' | 'custom';
          status: 'draft' | 'calculating' | 'completed' | 'failed' | 'archived';
          result_status: 'none' | 'fresh' | 'stale';
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          base_forecast_id: string;
          name: string;
          description?: string | null;
          scenario_type?: 'revenue_change' | 'customer_payment_delay' | 'expense_change' | 'unexpected_expense' | 'new_business_commitment' | 'custom';
          status?: 'draft' | 'calculating' | 'completed' | 'failed' | 'archived';
          result_status?: 'none' | 'fresh' | 'stale';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          base_forecast_id?: string;
          name?: string;
          description?: string | null;
          scenario_type?: 'revenue_change' | 'customer_payment_delay' | 'expense_change' | 'unexpected_expense' | 'new_business_commitment' | 'custom';
          status?: 'draft' | 'calculating' | 'completed' | 'failed' | 'archived';
          result_status?: 'none' | 'fresh' | 'stale';
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      scenario_assumptions: {
        Row: {
          id: string;
          scenario_id: string;
          organization_id: string;
          assumption_type: 'revenue_adjustment' | 'customer_delay' | 'expense_adjustment' | 'one_time_expense' | 'new_commitment' | 'custom';
          target_type: 'all' | 'category' | 'customer' | 'supplier' | 'invoice' | 'recurring_flow';
          target_id: string | null;
          adjustment_method: 'percentage_change' | 'absolute_change' | 'date_shift' | 'collection_rate_change' | 'one_time_event' | 'recurring_event';
          adjustment_value: number;
          start_date: string | null;
          end_date: string | null;
          description: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          scenario_id: string;
          organization_id: string;
          assumption_type: 'revenue_adjustment' | 'customer_delay' | 'expense_adjustment' | 'one_time_expense' | 'new_commitment' | 'custom';
          target_type?: 'all' | 'category' | 'customer' | 'supplier' | 'invoice' | 'recurring_flow';
          target_id?: string | null;
          adjustment_method: 'percentage_change' | 'absolute_change' | 'date_shift' | 'collection_rate_change' | 'one_time_event' | 'recurring_event';
          adjustment_value: number;
          start_date?: string | null;
          end_date?: string | null;
          description: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          scenario_id?: string;
          organization_id?: string;
          assumption_type?: 'revenue_adjustment' | 'customer_delay' | 'expense_adjustment' | 'one_time_expense' | 'new_commitment' | 'custom';
          target_type?: 'all' | 'category' | 'customer' | 'supplier' | 'invoice' | 'recurring_flow';
          target_id?: string | null;
          adjustment_method?: 'percentage_change' | 'absolute_change' | 'date_shift' | 'collection_rate_change' | 'one_time_event' | 'recurring_event';
          adjustment_value?: number;
          start_date?: string | null;
          end_date?: string | null;
          description?: string;
          source?: string;
          created_at?: string;
        };
      };
      scenario_results: {
        Row: {
          id: string;
          scenario_id: string;
          organization_id: string;
          day_index: number;
          forecast_date: string;
          beginning_cash: number;
          scenario_inflows: number;
          scenario_outflows: number;
          net_cash_flow: number;
          ending_cash: number;
          threshold_status: 'above_threshold' | 'approaching_threshold' | 'below_threshold';
          shortfall_amount: number;
          base_ending_cash: number;
          cash_delta: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          scenario_id: string;
          organization_id: string;
          day_index: number;
          forecast_date: string;
          beginning_cash: number;
          scenario_inflows?: number;
          scenario_outflows?: number;
          net_cash_flow: number;
          ending_cash: number;
          threshold_status?: 'above_threshold' | 'approaching_threshold' | 'below_threshold';
          shortfall_amount?: number;
          base_ending_cash: number;
          cash_delta?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          scenario_id?: string;
          organization_id?: string;
          day_index?: number;
          forecast_date?: string;
          beginning_cash?: number;
          scenario_inflows?: number;
          scenario_outflows?: number;
          net_cash_flow?: number;
          ending_cash?: number;
          threshold_status?: 'above_threshold' | 'approaching_threshold' | 'below_threshold';
          shortfall_amount?: number;
          base_ending_cash?: number;
          cash_delta?: number;
          created_at?: string;
        };
      };
      scenario_result_items: {
        Row: {
          id: string;
          scenario_result_id: string;
          scenario_id: string;
          organization_id: string;
          scheduled_date: string;
          flow_type: 'inflow' | 'outflow';
          source_type: 'base_item' | 'adjusted_item' | 'simulated_event' | 'delayed_receivable';
          source_id: string | null;
          category: string;
          description: string;
          base_amount: number;
          amount: number;
          adjustment_amount: number;
          adjustment_reason: string | null;
          certainty: 'CONFIRMED' | 'EXPECTED' | 'ASSUMED' | 'SIMULATED';
          created_at: string;
        };
        Insert: {
          id?: string;
          scenario_result_id: string;
          scenario_id: string;
          organization_id: string;
          scheduled_date: string;
          flow_type: 'inflow' | 'outflow';
          source_type: 'base_item' | 'adjusted_item' | 'simulated_event' | 'delayed_receivable';
          source_id?: string | null;
          category: string;
          description: string;
          base_amount?: number;
          amount: number;
          adjustment_amount?: number;
          adjustment_reason?: string | null;
          certainty?: 'CONFIRMED' | 'EXPECTED' | 'ASSUMED' | 'SIMULATED';
          created_at?: string;
        };
        Update: {
          id?: string;
          scenario_result_id?: string;
          scenario_id?: string;
          organization_id?: string;
          scheduled_date?: string;
          flow_type?: 'inflow' | 'outflow';
          source_type?: 'base_item' | 'adjusted_item' | 'simulated_event' | 'delayed_receivable';
          source_id?: string | null;
          category?: string;
          description?: string;
          base_amount?: number;
          amount?: number;
          adjustment_amount?: number;
          adjustment_reason?: string | null;
          certainty?: 'CONFIRMED' | 'EXPECTED' | 'ASSUMED' | 'SIMULATED';
          created_at?: string;
        };
      };
      alert_rules: {
        Row: {
          id: string;
          organization_id: string;
          alert_type: string;
          threshold_value: number;
          threshold_method: 'absolute_value' | 'percentage_buffer' | 'days_overdue' | 'standard_deviations';
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          alert_type: string;
          threshold_value?: number;
          threshold_method?: 'absolute_value' | 'percentage_buffer' | 'days_overdue' | 'standard_deviations';
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          alert_type?: string;
          threshold_value?: number;
          threshold_method?: 'absolute_value' | 'percentage_buffer' | 'days_overdue' | 'standard_deviations';
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      alert_events: {
        Row: {
          id: string;
          alert_id: string;
          organization_id: string;
          event_type: 'created' | 'acknowledged' | 'resolved' | 'dismissed' | 'reactivated' | 'threshold_updated';
          previous_status: string | null;
          new_status: string;
          user_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          alert_id: string;
          organization_id: string;
          event_type: 'created' | 'acknowledged' | 'resolved' | 'dismissed' | 'reactivated' | 'threshold_updated';
          previous_status?: string | null;
          new_status: string;
          user_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          alert_id?: string;
          organization_id?: string;
          event_type?: 'created' | 'acknowledged' | 'resolved' | 'dismissed' | 'reactivated' | 'threshold_updated';
          previous_status?: string | null;
          new_status?: string;
          user_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      notification_preferences: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          alert_type: string;
          minimum_severity: 'informational' | 'warning' | 'critical';
          in_app_enabled: boolean;
          email_enabled: boolean;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          alert_type: string;
          minimum_severity?: 'informational' | 'warning' | 'critical';
          in_app_enabled?: boolean;
          email_enabled?: boolean;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          alert_type?: string;
          minimum_severity?: 'informational' | 'warning' | 'critical';
          in_app_enabled?: boolean;
          email_enabled?: boolean;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      forecast_variances: {
        Row: {
          id: string;
          organization_id: string;
          forecast_id: string;
          forecast_date: string;
          forecast_inflows: number;
          actual_inflows: number;
          forecast_outflows: number;
          actual_outflows: number;
          forecast_net_cash_flow: number;
          actual_net_cash_flow: number;
          forecast_ending_cash: number;
          actual_ending_cash: number;
          absolute_variance: number;
          signed_variance: number;
          is_material_deviation: boolean;
          category_variances: Json;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          forecast_id: string;
          forecast_date: string;
          forecast_inflows?: number;
          actual_inflows?: number;
          forecast_outflows?: number;
          actual_outflows?: number;
          forecast_net_cash_flow?: number;
          actual_net_cash_flow?: number;
          forecast_ending_cash?: number;
          actual_ending_cash?: number;
          absolute_variance?: number;
          signed_variance?: number;
          is_material_deviation?: boolean;
          category_variances?: Json;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          forecast_id?: string;
          forecast_date?: string;
          forecast_inflows?: number;
          actual_inflows?: number;
          forecast_outflows?: number;
          actual_outflows?: number;
          forecast_net_cash_flow?: number;
          actual_net_cash_flow?: number;
          forecast_ending_cash?: number;
          actual_ending_cash?: number;
          absolute_variance?: number;
          signed_variance?: number;
          is_material_deviation?: boolean;
          category_variances?: Json;
          notes?: string | null;
          created_at?: string;
        };
      };
      actionable_recommendations: {
        Row: {
          id: string;
          organization_id: string;
          recommendation_type: string;
          title: string;
          rationale: string;
          evidence_data: Json;
          related_alert_id: string | null;
          related_entity_type: string | null;
          related_entity_id: string | null;
          projected_impact_amount: number | null;
          urgency: 'low' | 'medium' | 'high' | 'critical';
          status: 'active' | 'applied' | 'dismissed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          recommendation_type: string;
          title: string;
          rationale: string;
          evidence_data?: Json;
          related_alert_id?: string | null;
          related_entity_type?: string | null;
          related_entity_id?: string | null;
          projected_impact_amount?: number | null;
          urgency?: 'low' | 'medium' | 'high' | 'critical';
          status?: 'active' | 'applied' | 'dismissed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          recommendation_type?: string;
          title?: string;
          rationale?: string;
          evidence_data?: Json;
          related_alert_id?: string | null;
          related_entity_type?: string | null;
          related_entity_id?: string | null;
          projected_impact_amount?: number | null;
          urgency?: 'low' | 'medium' | 'high' | 'critical';
          status?: 'active' | 'applied' | 'dismissed';
          created_at?: string;
          updated_at?: string;
        };
      };
      monitoring_job_runs: {
        Row: {
          id: string;
          organization_id: string;
          job_type: 'alert_evaluation' | 'variance_calculation' | 'forecast_refresh' | 'full_monitoring';
          trigger_source: 'manual' | 'scheduled' | 'transaction_imported' | 'material_deviation' | 'overdue_invoice';
          status: 'running' | 'completed' | 'failed';
          alerts_evaluated: number;
          alerts_raised: number;
          variances_recorded: number;
          execution_time_ms: number;
          error_message: string | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          job_type: 'alert_evaluation' | 'variance_calculation' | 'forecast_refresh' | 'full_monitoring';
          trigger_source: 'manual' | 'scheduled' | 'transaction_imported' | 'material_deviation' | 'overdue_invoice';
          status?: 'running' | 'completed' | 'failed';
          alerts_evaluated?: number;
          alerts_raised?: number;
          variances_recorded?: number;
          execution_time_ms?: number;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          job_type?: 'alert_evaluation' | 'variance_calculation' | 'forecast_refresh' | 'full_monitoring';
          trigger_source?: 'manual' | 'scheduled' | 'transaction_imported' | 'material_deviation' | 'overdue_invoice';
          status?: 'running' | 'completed' | 'failed';
          alerts_evaluated?: number;
          alerts_raised?: number;
          variances_recorded?: number;
          execution_time_ms?: number;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
      };
    };
  };
}
