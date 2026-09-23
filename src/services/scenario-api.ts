/**
 * Scenario Simulation API Client
 * CashFlow Intelligence — Phase 6: Scenario Simulation & Decision Support
 */

import {
  ScenarioRow,
  ScenarioAssumptionRow,
  ScenarioSimulationOutput,
  ScenarioComparisonSummary,
  DecisionSupportInsight,
  SensitivityAnalysisResult,
  ScenarioEngine,
} from './scenario-engine';
import { ForecastApiClient } from './forecast-api';
import { ForecastEngine } from './forecast-engine';

export interface CreateScenarioPayload {
  name: string;
  description?: string;
  scenario_type?: ScenarioRow['scenario_type'];
  baseForecastId?: string;
  assumptions?: Array<{
    assumption_type: ScenarioAssumptionRow['assumption_type'];
    target_type?: ScenarioAssumptionRow['target_type'];
    target_id?: string | null;
    adjustment_method: ScenarioAssumptionRow['adjustment_method'];
    adjustment_value: number;
    start_date?: string | null;
    end_date?: string | null;
    description: string;
  }>;
}

export interface ScenarioDetailsResponse extends ScenarioRow {
  assumptions: ScenarioAssumptionRow[];
}

export interface MultiScenarioCompareResponse {
  baseForecast: {
    openingCash: number;
    totalInflows: number;
    totalOutflows: number;
    netCashFlow: number;
    endingCash: number;
    minimumProjectedCash: number;
    shortfallDays: number;
  };
  scenarios: ScenarioComparisonSummary[];
}

export class ScenarioApiClient {
  /**
   * Helper: Request JSON wrapper with offline fallback
   */
  private static async request<T>(path: string, options?: RequestInit): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const res = await fetch(path, {
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
        ...options,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errJson.error || `HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const json = await res.json();
      return json;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network request failed',
      };
    }
  }

  static async listScenarios(): Promise<{ success: boolean; data?: ScenarioRow[]; error?: string }> {
    return this.request<ScenarioRow[]>('/api/scenarios');
  }

  static async createScenario(payload: CreateScenarioPayload): Promise<{ success: boolean; data?: ScenarioRow; error?: string }> {
    return this.request<ScenarioRow>('/api/scenarios', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async getScenario(id: string): Promise<{ success: boolean; data?: ScenarioDetailsResponse; error?: string }> {
    return this.request<ScenarioDetailsResponse>(`/api/scenarios/${id}`);
  }

  static async updateScenario(
    id: string,
    updates: Partial<Pick<ScenarioRow, 'name' | 'description' | 'scenario_type'>>
  ): Promise<{ success: boolean; data?: ScenarioRow; error?: string }> {
    return this.request<ScenarioRow>(`/api/scenarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  static async deleteScenario(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.request<{ message: string }>(`/api/scenarios/${id}`, {
      method: 'DELETE',
    });
  }

  static async addAssumption(
    scenarioId: string,
    assumption: Omit<ScenarioAssumptionRow, 'id' | 'scenario_id' | 'organization_id' | 'created_at'>
  ): Promise<{ success: boolean; data?: ScenarioAssumptionRow; error?: string; errors?: string[] }> {
    return this.request<ScenarioAssumptionRow>(`/api/scenarios/${scenarioId}/assumptions`, {
      method: 'POST',
      body: JSON.stringify(assumption),
    });
  }

  static async deleteAssumption(scenarioId: string, assumptionId: string): Promise<{ success: boolean; error?: string }> {
    return this.request<{ message: string }>(`/api/scenarios/${scenarioId}/assumptions/${assumptionId}`, {
      method: 'DELETE',
    });
  }

  static async calculateScenario(scenarioId: string): Promise<{ success: boolean; data?: ScenarioSimulationOutput; error?: string }> {
    return this.request<ScenarioSimulationOutput>(`/api/scenarios/${scenarioId}/calculate`, {
      method: 'POST',
    });
  }

  static async getScenarioResults(scenarioId: string): Promise<{ success: boolean; data?: ScenarioSimulationOutput; error?: string }> {
    return this.request<ScenarioSimulationOutput>(`/api/scenarios/${scenarioId}/results`);
  }

  static async getScenarioSummary(scenarioId: string): Promise<{ success: boolean; data?: ScenarioComparisonSummary; error?: string }> {
    return this.request<ScenarioComparisonSummary>(`/api/scenarios/${scenarioId}/summary`);
  }

  static async getScenarioExplanation(
    scenarioId: string
  ): Promise<{ success: boolean; data?: { insights: DecisionSupportInsight[]; outOfWindowDelayedItems: any[] }; error?: string }> {
    return this.request<{ insights: DecisionSupportInsight[]; outOfWindowDelayedItems: any[] }>(`/api/scenarios/${scenarioId}/explanation`);
  }

  static async compareScenarios(scenarioIds: string[]): Promise<{ success: boolean; data?: MultiScenarioCompareResponse; error?: string }> {
    return this.request<MultiScenarioCompareResponse>('/api/scenarios/compare', {
      method: 'POST',
      body: JSON.stringify({ scenarioIds }),
    });
  }

  static async getSensitivityAnalysis(
    variable: 'revenue_multiplier' | 'ar_delay_days' | 'expense_multiplier' | 'one_time_shock',
    targetCategory?: string
  ): Promise<{ success: boolean; data?: SensitivityAnalysisResult; error?: string }> {
    const query = new URLSearchParams({ variable });
    if (targetCategory) query.set('targetCategory', targetCategory);
    return this.request<SensitivityAnalysisResult>(`/api/scenarios/sensitivity?${query.toString()}`);
  }
}
