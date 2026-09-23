/**
 * Forecast API Client Service
 * CashFlow Intelligence — Phase 4: Deterministic 30-Day Cash-Flow Forecasting Engine
 */

import type {
  ForecastEngineOutput,
  ForecastScenario,
} from './forecast-engine';
import type { Database } from '../types/database';

export type ForecastRunRow = Database['public']['Tables']['forecast_runs']['Row'];

export const ForecastApiClient = {
  /**
   * Fetch current forecast details (live calculated or by specific forecast ID)
   */
  async getForecastDetails(params?: {
    organizationId?: string;
    forecastId?: string;
    scenario?: ForecastScenario;
  }): Promise<{ success: boolean; data?: ForecastEngineOutput; error?: string }> {
    try {
      const qs = new URLSearchParams();
      if (params?.organizationId) qs.set('organizationId', params.organizationId);
      if (params?.forecastId) qs.set('forecastId', params.forecastId);
      if (params?.scenario) qs.set('scenario', params.scenario);

      const res = await fetch(`/api/forecasts/details?${qs.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch forecast' };
    }
  },

  /**
   * Generate and persist an authoritative forecast version
   */
  async generateForecast(payload: {
    organizationId?: string;
    startDate?: string;
    horizonDays?: number;
    scenario?: ForecastScenario;
    minimumCashThreshold?: number;
    openingCashOverride?: number;
    assumptions?: Record<string, any>;
    userRole?: string;
  }): Promise<{ success: boolean; data?: ForecastEngineOutput; error?: { code: string; message: string } }> {
    try {
      const res = await fetch('/api/forecasts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: err?.message || 'Failed to generate forecast' },
      };
    }
  },

  /**
   * Preview forecast without incrementing version or storing to history
   */
  async previewForecast(payload: {
    organizationId?: string;
    startDate?: string;
    horizonDays?: number;
    scenario?: ForecastScenario;
    minimumCashThreshold?: number;
    openingCashOverride?: number;
    assumptions?: Record<string, any>;
  }): Promise<{ success: boolean; data?: ForecastEngineOutput; error?: string }> {
    try {
      const res = await fetch('/api/forecasts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to preview forecast' };
    }
  },

  /**
   * Fetch historical forecast runs
   */
  async getForecastHistory(organizationId?: string): Promise<{ success: boolean; data?: ForecastRunRow[]; error?: string }> {
    try {
      const qs = organizationId ? `?organizationId=${organizationId}` : '';
      const res = await fetch(`/api/forecasts${qs}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch forecast runs' };
    }
  },

  /**
   * Fetch shortfalls and deficits
   */
  async getShortfalls(organizationId?: string, scenario?: ForecastScenario) {
    try {
      const qs = new URLSearchParams();
      if (organizationId) qs.set('organizationId', organizationId);
      if (scenario) qs.set('scenario', scenario);
      const res = await fetch(`/api/forecasts/shortfalls?${qs.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch shortfalls' };
    }
  },

  /**
   * Fetch explainable breakdown
   */
  async getExplanation(organizationId?: string, scenario?: ForecastScenario) {
    try {
      const qs = new URLSearchParams();
      if (organizationId) qs.set('organizationId', organizationId);
      if (scenario) qs.set('scenario', scenario);
      const res = await fetch(`/api/forecasts/explanation?${qs.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch explanation' };
    }
  },
};
