import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { WebSocketServer } from 'ws';
import {
  handleAiFinancialAnalysis,
  handleAiChat,
  handleSearchGrounding,
  handleMapsGrounding,
  handleAudioTranscription,
  setupLiveVoiceWebSocket,
} from './server/gemini-handler';
import {
  handleImportPreview,
  handleImportConfirm,
  handleGetImportHistory,
  handleGetTransactions,
  handleCategorizeTransaction,
  handleImportReceivables,
  handleImportPayables,
  handleGetDataQualitySummary,
} from './server/import-handler';
import {
  handleForecastGenerate,
  handleForecastPreview,
  handleGetForecastRuns,
  handleGetForecastDetails,
  handleGetForecastShortfalls,
  handleGetForecastExplanation,
  handleForecastRefresh,
} from './server/forecast-handler';
import { handleScenarioApi } from './server/scenario-handler';
import { handleMonitoringApi } from './server/monitoring-handler';
import {
  applySecurityHeaders,
  checkRateLimit,
  getSystemHealth,
} from './src/server/security-middleware';

function apiMiddlewarePlugin(): Plugin {
  return {
    name: 'api-middleware',
    configureServer(server) {
      // 0. Security Headers, Rate Limiting & Health Observability
      server.middlewares.use((req, res, next) => {
        applySecurityHeaders(res);

        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

        // Health Observability Endpoints
        if (url.pathname === '/health' || url.pathname === '/ready') {
          const health = getSystemHealth();
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(health, null, 2));
          return;
        }

        if (url.pathname === '/version') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              app: 'cashflow-forecasting-system',
              version: '1.0.0',
              environment: process.env.NODE_ENV || 'development',
              sha: 'phase-8-production-ready',
            })
          );
          return;
        }

        // Rate limiting for /api/ routes
        if (url.pathname.startsWith('/api/')) {
          const rateResult = checkRateLimit(req);
          res.setHeader('X-RateLimit-Remaining', rateResult.remaining.toString());
          res.setHeader('X-RateLimit-Reset', Math.ceil(rateResult.resetTime / 1000).toString());

          if (!rateResult.allowed) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 429;
            res.end(
              JSON.stringify({
                success: false,
                error: 'Too Many Requests: Rate limit exceeded. Please retry in 60 seconds.',
              })
            );
            return;
          }
        }

        next();
      });

      // Helper to handle JSON POST requests
      const handleJsonPost = (
        endpoint: string,
        handler: (data: any) => Promise<any>
      ) => {
        server.middlewares.use(endpoint, async (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on('end', async () => {
              try {
                const data = body ? JSON.parse(body) : {};
                const result = await handler(data);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify(result));
              } catch (err: any) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 500;
                res.end(
                  JSON.stringify({
                    success: false,
                    error: err?.message || 'Server error',
                  })
                );
              }
            });
          } else {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          }
        });
      };

      // Helper to handle JSON GET requests
      const handleJsonGet = (
        endpoint: string,
        handler: (query: any) => Promise<any>
      ) => {
        server.middlewares.use(endpoint, async (req, res) => {
          if (req.method === 'GET') {
            try {
              const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
              const query: Record<string, string> = {};
              url.searchParams.forEach((val, key) => {
                query[key] = val;
              });
              const result = await handler(query);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err?.message || 'Server error' }));
            }
          } else {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          }
        });
      };

      // 1. Financial Deep Advisory
      handleJsonPost('/api/gemini/analyze', handleAiFinancialAnalysis);

      // 2. Multi-turn Chat
      handleJsonPost('/api/gemini/chat', handleAiChat);

      // 3. Search Grounding
      handleJsonPost('/api/gemini/search', handleSearchGrounding);

      // 4. Maps Grounding
      handleJsonPost('/api/gemini/maps', handleMapsGrounding);

      // 5. Audio Transcription
      handleJsonPost('/api/gemini/transcribe', handleAudioTranscription);

      // Phase 3 Ingestion & Data Quality APIs
      handleJsonPost('/api/imports/preview', handleImportPreview);
      handleJsonPost('/api/imports/confirm', handleImportConfirm);
      handleJsonGet('/api/imports', handleGetImportHistory);
      handleJsonGet('/api/transactions', handleGetTransactions);
      handleJsonPost('/api/transactions/categorize', handleCategorizeTransaction);
      handleJsonPost('/api/accounts-receivable/import', handleImportReceivables);
      handleJsonPost('/api/accounts-payable/import', handleImportPayables);
      handleJsonGet('/api/data-quality/summary', handleGetDataQualitySummary);

      // Phase 4 Deterministic 30-Day Forecast APIs
      handleJsonPost('/api/forecasts/generate', handleForecastGenerate);
      handleJsonPost('/api/forecasts/preview', handleForecastPreview);
      handleJsonGet('/api/forecasts/details', handleGetForecastDetails);
      handleJsonGet('/api/forecasts/shortfalls', handleGetForecastShortfalls);
      handleJsonGet('/api/forecasts/explanation', handleGetForecastExplanation);
      handleJsonGet('/api/forecasts', handleGetForecastRuns);
      handleJsonPost('/api/forecasts/refresh', handleForecastRefresh);

      // Phase 6 Scenario Simulation, Sensitivity & Decision Support APIs
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/scenarios')) {
          try {
            const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const handled = await handleScenarioApi(req, res, url);
            if (handled) return;
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
        }
        next();
      });

      // Phase 7 Alerts, Recommendations, Variance & Monitoring APIs
      server.middlewares.use(async (req, res, next) => {
        if (
          req.url &&
          (req.url.startsWith('/api/alerts') ||
            req.url.startsWith('/api/alert-rules') ||
            req.url.startsWith('/api/notifications') ||
            req.url.startsWith('/api/notification-preferences') ||
            req.url.startsWith('/api/variance') ||
            req.url.startsWith('/api/monitoring') ||
            req.url.startsWith('/api/recommendations'))
        ) {
          try {
            const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const handled = await handleMonitoringApi(req, res, url);
            if (handled) return;
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }
        }
        next();
      });

      // 6. Live API Voice WebSocket bridge (gemini-3.8-live)
      if (server.httpServer) {
        const wss = new WebSocketServer({ noServer: true });
        setupLiveVoiceWebSocket(wss);

        server.httpServer.on('upgrade', (request, socket, head) => {
          try {
            const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
            if (url.pathname === '/live') {
              wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
              });
            }
          } catch (e) {
            console.error('WebSocket upgrade error', e);
          }
        });
      }
    },
  };
}

function githubPagesPlugin(): Plugin {
  return {
    name: 'github-pages-fallback',
    closeBundle() {
      try {
        const distDir = path.resolve(import.meta.dirname || '.', 'dist');
        const indexPath = path.join(distDir, 'index.html');
        const fallbackPath = path.join(distDir, '404.html');
        if (fs.existsSync(indexPath)) {
          fs.copyFileSync(indexPath, fallbackPath);
        }
      } catch (e) {
        // ignore errors during bundle close
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), apiMiddlewarePlugin(), githubPagesPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 2500,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
