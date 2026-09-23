import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Trash2,
  Mic,
  MicOff,
  Sparkles,
  Bot,
  User,
  Zap,
  Gauge,
  BrainCircuit,
  Loader2,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { sendChatMessage, requestAudioTranscription } from '../../services/api-service';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

interface GeminiChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
  financialContext: any;
}

type ModelType = 'gemini-3.5-flash' | 'gemini-3.1-flash-lite' | 'gemini-3.1-pro-preview';

interface RolePreset {
  id: string;
  name: string;
  model: ModelType;
  modelLabel: string;
  badgeColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  systemInstruction: string;
  suggestedQuestions: string[];
}

export const GeminiChatbotModal: React.FC<GeminiChatbotModalProps> = ({
  isOpen,
  onClose,
  financialContext,
}) => {
  const ROLES: RolePreset[] = [
    {
      id: 'cfo-general',
      name: 'CFO Liquidity Strategist',
      model: 'gemini-3.5-flash',
      modelLabel: 'gemini-3.5-flash (General Tasks)',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      icon: Sparkles,
      description: 'Balanced financial foresight, 30-day working capital strategies, and liquidity safety buffering.',
      systemInstruction: `You are CashFlow Intelligence Virtual CFO, a seasoned small business financial strategist.
Your client runs a wholesale & retail distribution firm.
Current Metrics:
- Initial Cash: ₹${financialContext?.initialCash?.toLocaleString('en-IN') || '4,80,000'}
- Minimum Safety Buffer: ₹${financialContext?.minimumThreshold?.toLocaleString('en-IN') || '1,00,000'}
- 30-Day Ending Cash (Expected): ₹${financialContext?.expectedEndingCash?.toLocaleString('en-IN') || '3,12,000'}
- 30-Day Ending Cash (Pessimistic): ₹${financialContext?.pessimisticEndingCash?.toLocaleString('en-IN') || '82,000'}
- Shortfall Probability: ${financialContext?.shortfallProbability || 18}%
- Runway: ${financialContext?.runwayDays || 42} days

Provide practical, prioritized cash-flow management guidance. Cite numbers in INR (₹).`,
      suggestedQuestions: [
        'How should I restructure my supplier payments to avoid the Oct 1-5 payroll crunch?',
        'If collections from top 3 wholesale clients lag by 7 days, how low does my cash drop?',
        'What immediate tactical steps can I take in the next 48 hours to preserve ₹1,00,000 cash?',
      ],
    },
    {
      id: 'fast-calculator',
      name: 'Rapid Factoring & Discount Calculator',
      model: 'gemini-3.1-flash-lite',
      modelLabel: 'gemini-3.1-flash-lite (Fast Tasks)',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      icon: Zap,
      description: 'Rapid, lightweight calculation of invoice discount APRs, supplier delay penalties, and cash conversion cycle math.',
      systemInstruction: `You are an ultra-fast commercial financial calculator.
Provide instant, concise mathematical breakdowns for invoice discounting, working capital interest, factoring cost vs return, and immediate cash metrics. Keep explanations brief and calculations exact.`,
      suggestedQuestions: [
        'Calculate the effective annualized APR of offering a 2% discount for 10-day payment vs Net 30.',
        'If I delay a ₹1,35,000 supplier invoice by 14 days with 1.5% monthly late fee, what is my net interest cost?',
        'What daily collection rate do I need to maintain ₹2,50,000 minimum cash balance by day 20?',
      ],
    },
    {
      id: 'deep-restructuring',
      name: 'Forensic Auditor & Debt Restructuring',
      model: 'gemini-3.1-pro-preview',
      modelLabel: 'gemini-3.1-pro-preview (Complex Tasks)',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      icon: BrainCircuit,
      description: 'Deep analytical reasoning for emergency solvency, debt covenants, and complex supplier payment renegotiations.',
      systemInstruction: `You are a Senior Forensic Auditor and Corporate Restructuring Specialist.
Perform rigorous, multi-step scenario stress testing on small business balance sheets.
Analyze cash flow bottlenecks, evaluate working capital loan covenants, and design insolvency-preventing capital allocation cascades.`,
      suggestedQuestions: [
        'Perform a multi-variable stress test assuming -20% sales revenue and simultaneous 12-day collection delay.',
        'Draft a step-by-step negotiation script to convince our primary agro supplier to accept a 50% split invoice.',
        'Evaluate our cash runway under sudden regulatory GST statutory demands during a liquidity crunch.',
      ],
    },
  ];

  const [selectedRole, setSelectedRole] = useState<RolePreset>(ROLES[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: `Hello! I am your **${ROLES[0].name}**, powered by **${ROLES[0].model}**.\n\nI have loaded your live forecast data with an opening balance of **₹${(
        financialContext?.initialCash || 480000
      ).toLocaleString('en-IN')}** and a 30-day expected ending balance of **₹${(
        financialContext?.expectedEndingCash || 312000
      ).toLocaleString(
        'en-IN'
      )}**.\n\nHow can I assist your liquidity decisions or stress tests today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: ROLES[0].model,
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Audio transcription states
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRoleChange = (role: RolePreset) => {
    setSelectedRole(role);
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: 'model',
        content: `*Switched to **${role.name}** using \`${role.model}\`.*\n\n${role.description}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: role.model,
      },
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputPrompt('');
    setIsLoading(true);

    // Format conversation history for API
    const historyPayload = newHistory
      .filter((m) => m.id !== 'welcome' && !m.content.startsWith('*Switched to'))
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const response = await sendChatMessage({
      model: selectedRole.model,
      systemInstruction: selectedRole.systemInstruction,
      messages: historyPayload,
      financialContext,
    });

    if (response.success && response.text) {
      setMessages((prev) => [
        ...prev,
        {
          id: `mod-${Date.now()}`,
          role: 'model',
          content: response.text || '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: response.modelUsed || selectedRole.model,
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          content: `⚠️ ${response.error || 'Failed to generate response. Please verify GEMINI_API_KEY.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: selectedRole.model,
        },
      ]);
    }

    setIsLoading(false);
  };

  // Audio recording & Transcription via gemini-3.5-transcribe
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        clearInterval(recordingTimerRef.current);
        setRecordingSeconds(0);

        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) return;

        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            const result = await requestAudioTranscription(base64Data, 'audio/webm');
            setIsTranscribing(false);

            if (result.success && result.transcription) {
              setInputPrompt((prev) =>
                prev ? `${prev} ${result.transcription}` : result.transcription || ''
              );
            } else {
              alert(result.error || 'Audio transcription failed. Check GEMINI_API_KEY.');
            }
          };
        } catch (e) {
          setIsTranscribing(false);
          console.error('Failed to process recorded audio', e);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (e: any) {
      console.error('Failed to access microphone', e);
      alert('Microphone access denied. Please grant microphone permissions in browser.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const clearChatHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'model',
        content: `Chat history cleared. Ready for your next query with **${selectedRole.name}**.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedRole.model,
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base">Gemini CashFlow Intelligence Chat</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Multi-Turn Thread
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interactive financial advisor with role-tailored system instructions & audio transcription
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={clearChatHistory}
              title="Clear conversation history"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Role & Model Selector Ribbon */}
        <div className="bg-slate-950/60 border-b border-slate-800 p-3 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-400">Select Specialist Role:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole.id === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => handleRoleChange(role)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center space-x-2 transition-all cursor-pointer ${
                    isSelected
                      ? `${role.badgeColor} shadow-md`
                      : 'bg-slate-800/40 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{role.name}</span>
                  <span className="text-[10px] font-mono opacity-80">({role.model})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/40">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isUser
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/40'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                    isUser
                      ? 'bg-emerald-600/20 border border-emerald-500/30 text-slate-100 rounded-tr-none'
                      : 'bg-slate-800/80 border border-slate-700/70 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {/* Model tag header if model */}
                  {!isUser && msg.modelUsed && (
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-700/50 text-[11px] text-indigo-300">
                      <span className="font-mono flex items-center space-x-1">
                        <Sparkles className="w-3 h-3" />
                        <span>{msg.modelUsed}</span>
                      </span>
                      <span className="text-slate-500">{msg.timestamp}</span>
                    </div>
                  )}

                  <div className="text-sm whitespace-pre-wrap leading-relaxed prose prose-invert max-w-none">
                    {msg.content}
                  </div>

                  {isUser && (
                    <div className="text-[10px] text-right mt-1 text-slate-400">
                      {msg.timestamp}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl rounded-tl-none p-4 flex items-center space-x-3 text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span className="text-xs">Reasoning with {selectedRole.model}...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts Pill Tray */}
        <div className="p-2 px-4 bg-slate-950/70 border-t border-slate-800/80 flex items-center space-x-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Suggested:</span>
          {selectedRole.suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q)}
              className="text-xs text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 rounded-lg px-2.5 py-1 whitespace-nowrap transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar with Audio Transcription using gemini-3.5-transcribe */}
        <div className="p-3 bg-slate-900 border-t border-slate-800">
          {/* Recording Banner if active */}
          {isRecording && (
            <div className="mb-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span>Recording audio for <strong>gemini-3.5-transcribe</strong>... ({recordingSeconds}s)</span>
              </div>
              <button
                onClick={stopAudioRecording}
                className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors"
              >
                Done & Transcribe
              </button>
            </div>
          )}

          {isTranscribing && (
            <div className="mb-2 p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center space-x-2 text-xs text-indigo-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Transcribing speech with <strong>gemini-3.5-transcribe</strong>...</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            {/* Mic Transcription Button */}
            <button
              type="button"
              onClick={isRecording ? stopAudioRecording : startAudioRecording}
              disabled={isTranscribing || isLoading}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
              }`}
              title="Record voice input and transcribe with gemini-3.5-transcribe"
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={`Ask ${selectedRole.name} about cash runway, supplier delays, or stress test...`}
              disabled={isLoading || isRecording}
              className="flex-1 bg-slate-800/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
