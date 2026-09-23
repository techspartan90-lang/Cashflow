/**
 * Scenario Simulation API Route Handlers
 * CashFlow Intelligence — Phase 6: Scenario Simulation & Decision Support
 */

import { IncomingMessage, ServerResponse } from 'http';
import {
  ScenarioEngine,
  ScenarioRow,
  ScenarioAssumptionRow,
  ScenarioSimulationOutput,
  SensitivityAnalysisResult,
} from '../src/services/scenario-engine';
import { ForecastEngine } from '../src/services/forecast-engine';
import { forecastStore } from './forecast-handler';
import { inMemoryStore } from './import-handler';

const DEFAULT_ORG_ID = '11111111-1111-1111-1111-111111111111';

// In-Memory store for scenarios, assumptions, and calculation outputs
export const scenarioStore = {
  scenarios: new Map<string, ScenarioRow[]>(), // keyed by orgId
  assumptions: new Map<string, ScenarioAssumptionRow[]>(), // keyed by scenarioId
  simulations: new Map<string, ScenarioSimulationOutput>(), // keyed by scenarioId
};

/**
 * Seed initial realistic scenarios for default organization
 */
function initializeScenarioDefaults(orgId: string) {
  if (!scenarioStore.scenarios.has(orgId)) {
    const s1Id = 'scen-delay-14d';
    const s2Id = 'scen-cost-surge';
    const s3Id = 'scen-hire-commitment';

    const defaultScenarios: ScenarioRow[] = [
      {
        id: s1Id,
        organization_id: orgId,
        base_forecast_id: 'fc-v1',
        name: 'Enterprise Client 14-Day AR Delay',
        description: 'Simulates extended payment terms from major accounts receivable collections shifted by 14 days.',
        scenario_type: 'customer_payment_delay',
        status: 'completed',
        result_status: 'fresh',
        created_by: null,
        created_at: '2026-09-23T05:00:00Z',
        updated_at: '2026-09-23T05:00:00Z',
      },
      {
        id: s2Id,
        organization_id: orgId,
        base_forecast_id: 'fc-v1',
        name: 'Operational Expenses +12% Inflation Shock',
        description: 'Simulates a 12% across-the-board cost rise in operating expenses due to raw material and fuel price increases.',
        scenario_type: 'expense_change',
        status: 'completed',
        result_status: 'fresh',
        created_by: null,
        created_at: '2026-09-23T05:10:00Z',
        updated_at: '2026-09-23T05:10:00Z',
      },
      {
        id: s3Id,
        organization_id: orgId,
        base_forecast_id: 'fc-v1',
        name: 'Senior Financial Analyst New Hire',
        description: 'Adds an immediate recurring salary commitment of ₹45,000 to analyze cash flow and manage collections.',
        scenario_type: 'new_business_commitment',
        status: 'completed',
        result_status: 'fresh',
        created_by: null,
        created_at: '2026-09-23T05:15:00Z',
        updated_at: '2026-09-23T05:15:00Z',
      },
    ];

    scenarioStore.scenarios.set(orgId, defaultScenarios);

    // Seed assumptions
    scenarioStore.assumptions.set(s1Id, [
      {
        id: 'asm-delay-1',
        scenario_id: s1Id,
        organization_id: orgId,
        assumption_type: 'customer_delay',
        target_type: 'all',
        target_id: null,
        adjustment_method: 'date_shift',
        adjustment_value: 14,
        start_date: '2026-09-23',
        end_date: '2026-10-22',
        description: 'Postpone all customer receivables by 14 calendar days',
        source: 'user_defined',
        created_at: '2026-09-23T05:00:00Z',
      },
    ]);

    scenarioStore.assumptions.set(s2Id, [
      {
        id: 'asm-cost-1',
        scenario_id: s2Id,
        organization_id: orgId,
        assumption_type: 'expense_adjustment',
        target_type: 'all',
        target_id: null,
        adjustment_method: 'percentage_change',
        adjustment_value: 12,
        start_date: '2026-09-23',
        end_date: '2026-10-22',
        description: '12% inflation surcharge across all operational expenditures',
        source: 'user_defined',
        created_at: '2026-09-23T05:10:00Z',
      },
    ]);

    scenarioStore.assumptions.set(s3Id, [
      {
        id: 'asm-hire-1',
        scenario_id: s3Id,
        organization_id: orgId,
        assumption_type: 'new_commitment',
        target_type: 'category',
        target_id: 'Payroll',
        adjustment_method: 'one_time_event',
        adjustment_value: 45000,
        start_date: '2026-10-01',
        end_date: null,
        description: 'New hire monthly compensation paid on 1st of month',
        source: 'user_defined',
        created_at: '2026-09-23T05:15:00Z',
      },
    ]);
  }
}

/**
 * Helper to compute the base forecast for simulation
 */
function getBaseForecast(orgId: string) {
  return ForecastEngine.runForecast({
    organizationId: orgId,
    startDate: '2026-09-23',
    horizonDays: 30,
    scenario: 'expected',
    minimumCashThreshold: 100000,
  });
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

export async function handleScenarioApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const pathname = url.pathname;
  const orgId = DEFAULT_ORG_ID;
  initializeScenarioDefaults(orgId);

  // 1. GET /api/scenarios - List all scenarios
  if (req.method === 'GET' && pathname === '/api/scenarios') {
    const list = scenarioStore.scenarios.get(orgId) || [];
    sendJson(res, 200, {
      success: true,
      data: list,
    });
    return true;
  }

  // 2. POST /api/scenarios - Create new scenario
  if (req.method === 'POST' && pathname === '/api/scenarios') {
    try {
      const body = await parseJsonBody(req);
      if (!body.name || !body.name.trim()) {
        sendJson(res, 400, { success: false, error: 'Scenario name is required.' });
        return true;
      }

      const id = `scen-${Date.now()}`;
      const newScenario: ScenarioRow = {
        id,
        organization_id: orgId,
        base_forecast_id: body.baseForecastId || 'fc-v1',
        name: body.name.trim(),
        description: body.description || null,
        scenario_type: body.scenario_type || 'custom',
        status: 'draft',
        result_status: 'none',
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existing = scenarioStore.scenarios.get(orgId) || [];
      scenarioStore.scenarios.set(orgId, [newScenario, ...existing]);
      scenarioStore.assumptions.set(id, []);

      // If initial assumptions provided, attach them
      if (Array.isArray(body.assumptions)) {
        const asms: ScenarioAssumptionRow[] = body.assumptions.map((a: any, idx: number) => ({
          id: `asm-${Date.now()}-${idx}`,
          scenario_id: id,
          organization_id: orgId,
          assumption_type: a.assumption_type || 'custom',
          target_type: a.target_type || 'all',
          target_id: a.target_id || null,
          adjustment_method: a.adjustment_method || 'percentage_change',
          adjustment_value: Number(a.adjustment_value) || 0,
          start_date: a.start_date || null,
          end_date: a.end_date || null,
          description: a.description || 'Custom assumption',
          source: 'user_defined',
          created_at: new Date().toISOString(),
        }));
        scenarioStore.assumptions.set(id, asms);
      }

      sendJson(res, 201, {
        success: true,
        data: newScenario,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message });
      return true;
    }
  }

  // 3. POST /api/scenarios/compare - Multi-scenario side-by-side comparison
  if (req.method === 'POST' && pathname === '/api/scenarios/compare') {
    try {
      const body = await parseJsonBody(req);
      const scenarioIds: string[] = body.scenarioIds || [];
      const baseForecast = getBaseForecast(orgId);

      const scenariosList = scenarioStore.scenarios.get(orgId) || [];
      const comparisons = [];

      for (const sId of scenarioIds) {
        const scen = scenariosList.find((s) => s.id === sId);
        if (!scen) continue;

        const asms = scenarioStore.assumptions.get(sId) || [];
        const sim = ScenarioEngine.simulate(baseForecast, scen, asms);
        comparisons.push(sim.summary);
      }

      sendJson(res, 200, {
        success: true,
        data: {
          baseForecast: {
            openingCash: baseForecast.openingCash,
            totalInflows: baseForecast.summary.totalExpectedInflows,
            totalOutflows: baseForecast.summary.totalExpectedOutflows,
            netCashFlow: baseForecast.summary.netCashFlow,
            endingCash: baseForecast.dailyForecast[baseForecast.dailyForecast.length - 1]?.endingCash || 0,
            minimumProjectedCash: baseForecast.summary.minimumProjectedCash,
            shortfallDays: baseForecast.summary.shortfallDays,
          },
          scenarios: comparisons,
        },
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message });
      return true;
    }
  }

  // 4. GET /api/scenarios/sensitivity - Sensitivity Analysis Parameter Sweep
  if (req.method === 'GET' && pathname === '/api/scenarios/sensitivity') {
    try {
      const variable = (url.searchParams.get('variable') || 'revenue_multiplier') as any;
      const targetCategory = url.searchParams.get('targetCategory') || undefined;

      const baseForecast = getBaseForecast(orgId);
      const sweep = ScenarioEngine.runSensitivitySweep(baseForecast, variable, { targetCategory });

      sendJson(res, 200, {
        success: true,
        data: sweep,
      });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message });
      return true;
    }
  }

  // Parameterized routes: /api/scenarios/:id...
  const match = pathname.match(/^\/api\/scenarios\/([^\/]+)(\/.*)?$/);
  if (match) {
    const scenarioId = match[1];
    const subRoute = match[2] || '';

    const scenariosList = scenarioStore.scenarios.get(orgId) || [];
    const scenario = scenariosList.find((s) => s.id === scenarioId);

    if (!scenario) {
      sendJson(res, 404, { success: false, error: 'Scenario not found' });
      return true;
    }

    // A. GET /api/scenarios/:id - Details & assumptions
    if (req.method === 'GET' && subRoute === '') {
      const assumptions = scenarioStore.assumptions.get(scenarioId) || [];
      sendJson(res, 200, {
        success: true,
        data: {
          ...scenario,
          assumptions,
        },
      });
      return true;
    }

    // B. PATCH /api/scenarios/:id - Update name or description
    if (req.method === 'PATCH' && subRoute === '') {
      try {
        const body = await parseJsonBody(req);
        if (body.name) scenario.name = body.name.trim();
        if (body.description !== undefined) scenario.description = body.description;
        if (body.scenario_type) scenario.scenario_type = body.scenario_type;
        scenario.updated_at = new Date().toISOString();
        scenario.result_status = 'stale';

        sendJson(res, 200, { success: true, data: scenario });
        return true;
      } catch (err: any) {
        sendJson(res, 500, { success: false, error: err.message });
        return true;
      }
    }

    // C. DELETE /api/scenarios/:id - Delete scenario
    if (req.method === 'DELETE' && subRoute === '') {
      const filtered = scenariosList.filter((s) => s.id !== scenarioId);
      scenarioStore.scenarios.set(orgId, filtered);
      scenarioStore.assumptions.delete(scenarioId);
      scenarioStore.simulations.delete(scenarioId);
      sendJson(res, 200, { success: true, message: 'Scenario deleted successfully' });
      return true;
    }

    // D. POST /api/scenarios/:id/assumptions - Add assumption
    if (req.method === 'POST' && subRoute === '/assumptions') {
      try {
        const body = await parseJsonBody(req);
        const baseForecast = getBaseForecast(orgId);

        const val = ScenarioEngine.validateAssumption(body, baseForecast.startDate, baseForecast.endDate);
        if (!val.valid) {
          sendJson(res, 400, { success: false, errors: val.errors });
          return true;
        }

        const newAsm: ScenarioAssumptionRow = {
          id: `asm-${Date.now()}`,
          scenario_id: scenarioId,
          organization_id: orgId,
          assumption_type: body.assumption_type,
          target_type: body.target_type || 'all',
          target_id: body.target_id || null,
          adjustment_method: body.adjustment_method,
          adjustment_value: Number(body.adjustment_value),
          start_date: body.start_date || null,
          end_date: body.end_date || null,
          description: body.description || 'Scenario assumption',
          source: 'user_defined',
          created_at: new Date().toISOString(),
        };

        const existingAsms = scenarioStore.assumptions.get(scenarioId) || [];
        existingAsms.push(newAsm);
        scenarioStore.assumptions.set(scenarioId, existingAsms);
        scenario.result_status = 'stale';

        sendJson(res, 201, { success: true, data: newAsm });
        return true;
      } catch (err: any) {
        sendJson(res, 500, { success: false, error: err.message });
        return true;
      }
    }

    // E. DELETE /api/scenarios/:id/assumptions/:asmId - Remove assumption
    const asmMatch = subRoute.match(/^\/assumptions\/([^\/]+)$/);
    if (req.method === 'DELETE' && asmMatch) {
      const asmId = asmMatch[1];
      const existingAsms = scenarioStore.assumptions.get(scenarioId) || [];
      const updated = existingAsms.filter((a) => a.id !== asmId);
      scenarioStore.assumptions.set(scenarioId, updated);
      scenario.result_status = 'stale';
      sendJson(res, 200, { success: true, message: 'Assumption deleted' });
      return true;
    }

    // F. POST /api/scenarios/:id/calculate - Run simulation
    if (req.method === 'POST' && subRoute === '/calculate') {
      try {
        scenario.status = 'calculating';
        const baseForecast = getBaseForecast(orgId);
        const assumptions = scenarioStore.assumptions.get(scenarioId) || [];

        const simResult = ScenarioEngine.simulate(baseForecast, scenario, assumptions);

        scenarioStore.simulations.set(scenarioId, simResult);
        scenario.status = 'completed';
        scenario.result_status = 'fresh';
        scenario.updated_at = new Date().toISOString();

        sendJson(res, 200, {
          success: true,
          data: simResult,
        });
        return true;
      } catch (err: any) {
        scenario.status = 'failed';
        sendJson(res, 500, { success: false, error: err.message });
        return true;
      }
    }

    // G. GET /api/scenarios/:id/results - Retrieve full simulation output
    if (req.method === 'GET' && subRoute === '/results') {
      let simResult = scenarioStore.simulations.get(scenarioId);
      if (!simResult || scenario.result_status === 'stale') {
        const baseForecast = getBaseForecast(orgId);
        const assumptions = scenarioStore.assumptions.get(scenarioId) || [];
        simResult = ScenarioEngine.simulate(baseForecast, scenario, assumptions);
        scenarioStore.simulations.set(scenarioId, simResult);
        scenario.status = 'completed';
        scenario.result_status = 'fresh';
      }

      sendJson(res, 200, {
        success: true,
        data: simResult,
      });
      return true;
    }

    // H. GET /api/scenarios/:id/summary - Comparison summary metrics
    if (req.method === 'GET' && subRoute === '/summary') {
      let simResult = scenarioStore.simulations.get(scenarioId);
      if (!simResult || scenario.result_status === 'stale') {
        const baseForecast = getBaseForecast(orgId);
        const assumptions = scenarioStore.assumptions.get(scenarioId) || [];
        simResult = ScenarioEngine.simulate(baseForecast, scenario, assumptions);
        scenarioStore.simulations.set(scenarioId, simResult);
      }

      sendJson(res, 200, {
        success: true,
        data: simResult.summary,
      });
      return true;
    }

    // I. GET /api/scenarios/:id/explanation - Decision-Support Insights
    if (req.method === 'GET' && subRoute === '/explanation') {
      let simResult = scenarioStore.simulations.get(scenarioId);
      if (!simResult) {
        const baseForecast = getBaseForecast(orgId);
        const assumptions = scenarioStore.assumptions.get(scenarioId) || [];
        simResult = ScenarioEngine.simulate(baseForecast, scenario, assumptions);
        scenarioStore.simulations.set(scenarioId, simResult);
      }

      sendJson(res, 200, {
        success: true,
        data: {
          insights: simResult.insights,
          outOfWindowDelayedItems: simResult.outOfWindowDelayedItems,
        },
      });
      return true;
    }
  }

  return false;
}
