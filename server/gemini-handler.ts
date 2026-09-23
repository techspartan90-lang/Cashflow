/**
 * Server-side Gemini AI financial advisory & multimodal intelligence service.
 * NEVER exposed to client or browser. Uses server-side GEMINI_API_KEY.
 * Adheres to @google/genai SDK standards.
 */

import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import type { WebSocket, WebSocketServer } from 'ws';

let aiClient: GoogleGenAI | null = null;

export function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * 1. Financial Forecast Deep Analysis
 */
export async function handleAiFinancialAnalysis(data: any): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured on the server.',
      fallback: true,
    };
  }

  try {
    const ai = getAiClient();
    const prompt = `You are CashFlow Intelligence Senior CFO & Small Business Financial Strategist.
Analyze the following 30-day financial forecast and provide an authoritative liquidity risk diagnosis and prioritized recommendations:

Financial Context:
- Business: ${data.businessName || 'Small Business Wholesale & Retail Supplies'}
- Currency: ${data.currency || 'INR (₹)'}
- Initial Cash: ${data.initialCash}
- Minimum Threshold: ${data.minimumThreshold}
- 30-Day Ending Cash (Expected): ${data.expectedEndingCash}
- 30-Day Ending Cash (Optimistic): ${data.optimisticEndingCash}
- 30-Day Ending Cash (Pessimistic): ${data.pessimisticEndingCash}
- Cash Runway: ${data.runwayDays} days
- Shortfall Probability: ${data.shortfallProbability}%
- Cash Conversion Cycle: ${data.ccc} days (DIO: ${data.dio}d, DSO: ${data.dso}d, DPO: ${data.dpo}d)
- Overdue Receivables: ₹${data.overdueArAmount || 0}
- Major Bottlenecks: ${JSON.stringify(data.bottlenecks || [])}

Provide your analysis formatted in strict JSON with these keys:
{
  "executiveSummary": "1-2 concise paragraphs summarizing liquidity trajectory and primary cash pressure points",
  "liquidityHealthGrade": "A" | "B+" | "B" | "C" | "D",
  "criticalObservation": "The single most urgent cash risk over the next 30 days",
  "tacticalPlays": [
    {
      "title": "Action title",
      "targetWindow": "e.g., Next 48 Hours or Oct 1 - Oct 5",
      "expectedImpact": "Estimated ₹ cash impact or relief",
      "rationale": "Clear why and how"
    }
  ],
  "stressScenarioDiagnosis": "What happens if pessimistic scenario unfolds and how to survive it"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);

    return {
      success: true,
      analysis: parsed,
      generatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to generate AI financial analysis',
      fallback: true,
    };
  }
}

/**
 * 2. Multi-Turn Gemini Chatbot with specific role system instructions
 * Models supported:
 * - 'gemini-3.5-flash' (General tasks)
 * - 'gemini-3.1-flash-lite' (Fast tasks)
 * - 'gemini-3.1-pro-preview' (Complex tasks)
 */
export async function handleAiChat(data: {
  model?: string;
  systemInstruction?: string;
  messages: Array<{ role: 'user' | 'model'; content: string }>;
  financialContext?: any;
}): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured on the server.',
      fallback: true,
      text: 'I am your CashFlow AI Advisor. Please configure GEMINI_API_KEY in Settings to enable live neural model reasoning.',
    };
  }

  try {
    const ai = getAiClient();
    // Default to gemini-3.5-flash for general tasks, allow gemini-3.1-flash-lite or gemini-3.1-pro-preview
    const requestedModel = data.model || 'gemini-3.5-flash';
    const allowedModels = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'];
    const model = allowedModels.includes(requestedModel) ? requestedModel : 'gemini-3.5-flash';

    const systemInstruction =
      data.systemInstruction ||
      `You are CashFlow Intelligence Virtual CFO and working capital advisor.
You provide precise, pragmatic liquidity advice for a small business wholesale/retail firm with opening cash of ₹480,000 and minimum reserve threshold of ₹100,000.
Always format calculations clearly with INR (₹). Be direct, actionable, and mathematically accurate.`;

    // Map conversation history
    const contents: any[] = data.messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    return {
      success: true,
      text: response.text || '',
      modelUsed: model,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to complete chat interaction',
      fallback: true,
    };
  }
}

/**
 * 3. Search Grounding using gemini-3.5-flash with googleSearch tool
 * Extracts web grounding chunks and real citations.
 */
export async function handleSearchGrounding(data: {
  prompt: string;
  financialContext?: any;
}): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured on the server.',
      fallback: true,
    };
  }

  try {
    const ai = getAiClient();
    const prompt = `You are a financial market researcher. Use Google Search to retrieve current, authoritative information on the query:
"${data.prompt}"

Provide an executive financial summary, current regulatory/market data points, and implications for small business working capital.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const rawChunks = groundingMetadata?.groundingChunks || [];

    const sources = rawChunks
      .filter((chunk: any) => chunk.web && chunk.web.uri)
      .map((chunk: any) => ({
        title: chunk.web.title || chunk.web.uri,
        uri: chunk.web.uri,
      }));

    const searchQueries = groundingMetadata?.webSearchQueries || [];

    return {
      success: true,
      text,
      sources,
      searchQueries,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to execute Search Grounding',
    };
  }
}

/**
 * 4. Maps Grounding using gemini-3.5-flash with googleMaps tool
 * Extracts local places, branches, maps links, and reviews.
 */
export async function handleMapsGrounding(data: {
  prompt: string;
  latLng?: { latitude: number; longitude: number };
}): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured on the server.',
      fallback: true,
    };
  }

  try {
    const ai = getAiClient();
    const prompt = `Use Google Maps to find and evaluate financial, banking, or business facilities for this query:
"${data.prompt}"

List verified places with address, proximity, and practical guidance for small business owners.`;

    const config: any = {
      tools: [{ googleMaps: {} }],
    };

    if (data.latLng && typeof data.latLng.latitude === 'number') {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: data.latLng.latitude,
            longitude: data.latLng.longitude,
          },
        },
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config,
    });

    const text = response.text || '';
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const rawChunks = groundingMetadata?.groundingChunks || [];

    const places: Array<{ title: string; uri: string; address?: string; snippet?: string }> = [];

    rawChunks.forEach((chunk: any) => {
      if (chunk.maps) {
        places.push({
          title: chunk.maps.title || 'Maps Location',
          uri: chunk.maps.uri || '',
          snippet: chunk.maps.placeAnswerSources?.reviewSnippets?.[0] || '',
        });
      }
    });

    return {
      success: true,
      text,
      places,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to execute Maps Grounding',
    };
  }
}

/**
 * 5. Audio Transcription using gemini-3.5-transcribe
 * Accepts base64 encoded audio from client mic.
 */
export async function handleAudioTranscription(data: {
  base64Audio: string;
  mimeType?: string;
}): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured on the server.',
      fallback: true,
    };
  }

  try {
    const ai = getAiClient();
    const mimeType = data.mimeType || 'audio/webm';

    const audioPart = {
      inlineData: {
        mimeType,
        data: data.base64Audio,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          audioPart,
          {
            text: 'Transcribe this voice recording into clear, punctuated text. Capture financial amounts, vendor names, dates, and cash transactions accurately.',
          },
        ],
      },
    });

    return {
      success: true,
      transcription: response.text || '',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to transcribe audio with gemini-3.5-transcribe',
    };
  }
}

/**
 * 6. Live API WebSocket Session bridge for gemini-3.8-live
 */
export function setupLiveVoiceWebSocket(wss: WebSocketServer) {
  wss.on('connection', async (clientWs: WebSocket) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      clientWs.send(
        JSON.stringify({
          error: 'GEMINI_API_KEY is not configured on the server for Live API.',
        })
      );
      clientWs.close();
      return;
    }

    let session: any = null;

    try {
      const ai = getAiClient();

      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          systemInstruction:
            'You are CashFlow Live CFO, an expert conversational financial advisor. You speak succinctly and directly with business owners regarding their 30-day cash trajectory, liquidity crunches, and working capital optimization.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audio =
              message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ closed: true }));
            }
          },
          onerror: (err: any) => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ error: err?.message || 'Live API error' }));
            }
          },
        },
      });

      clientWs.on('message', (raw: any) => {
        try {
          const parsed = JSON.parse(raw.toString());
          if (parsed.audio && session) {
            session.sendRealtimeInput({
              audio: {
                data: parsed.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          }
        } catch (e) {
          console.error('Failed to parse client WS message', e);
        }
      });

      clientWs.on('close', () => {
        if (session && typeof session.close === 'function') {
          try {
            session.close();
          } catch (_) {}
        }
      });
    } catch (err: any) {
      console.error('Failed to initialize Live API session', err);
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: err?.message || 'Failed to connect to Live API session',
          })
        );
        clientWs.close();
      }
    }
  });
}
