import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
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

function apiMiddlewarePlugin(): Plugin {
  return {
    name: 'api-middleware',
    configureServer(server) {
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

      // 1. Financial Deep Advisory
      handleJsonPost('/api/gemini/analyze', handleAiFinancialAnalysis);

      // 2. Multi-turn Chat (gemini-3.5-flash, gemini-3.1-flash-lite, gemini-3.1-pro-preview)
      handleJsonPost('/api/gemini/chat', handleAiChat);

      // 3. Search Grounding (gemini-3.5-flash with googleSearch)
      handleJsonPost('/api/gemini/search', handleSearchGrounding);

      // 4. Maps Grounding (gemini-3.5-flash with googleMaps)
      handleJsonPost('/api/gemini/maps', handleMapsGrounding);

      // 5. Audio Transcription (gemini-3.5-transcribe)
      handleJsonPost('/api/gemini/transcribe', handleAudioTranscription);

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

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiMiddlewarePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
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
