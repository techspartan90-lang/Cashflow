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
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

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
          title: string;
          description: string;
          related_date: string | null;
          is_read: boolean;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          alert_type: string;
          severity: AlertSeverity;
          title: string;
          description: string;
          related_date?: string | null;
          is_read?: boolean;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          alert_type?: string;
          severity?: AlertSeverity;
          title?: string;
          description?: string;
          related_date?: string | null;
          is_read?: boolean;
          resolved_at?: string | null;
          created_at?: string;
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
    };
  };
}
