import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Volume2,
  AlertCircle,
  Sparkles,
  Zap,
} from 'lucide-react';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  initialCash: number;
}

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  businessName,
  initialCash,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('Ready to connect');
  const [modelSpeaking, setModelSpeaking] = useState<boolean>(false);
  const [userSpeaking, setUserSpeaking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Web Audio & WebSocket references
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef<boolean>(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Convert Float32Array PCM to 16-bit PCM little endian
  const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  const base64Encode = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Convert incoming 24kHz raw PCM base64 to AudioBuffer
  const base64ToAudioBuffer = (base64: string, ctx: AudioContext): AudioBuffer => {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    return buffer;
  };

  const stopActiveAudioSources = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    setModelSpeaking(false);
  };

  const startSession = async () => {
    setErrorMessage(null);
    setIsConnecting(true);
    setStatusText('Connecting to gemini-3.8-live...');

    try {
      // 1. Setup AudioContexts
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });

      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // 2. Request mic stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // 3. Setup WebSocket connection to server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setIsConnected(true);
        setStatusText('Live: Listening & Speaking with Gemini 3.8 Live');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.error) {
            setErrorMessage(msg.error);
            setStatusText('Error in Live Session');
            return;
          }

          if (msg.interrupted) {
            stopActiveAudioSources();
            return;
          }

          if (msg.audio && outputAudioCtxRef.current) {
            const ctx = outputAudioCtxRef.current;
            const audioBuffer = base64ToAudioBuffer(msg.audio, ctx);

            const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);

            source.start(startTime);
            nextStartTimeRef.current = startTime + audioBuffer.duration;
            activeSourcesRef.current.push(source);
            setModelSpeaking(true);

            source.onended = () => {
              activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
              if (activeSourcesRef.current.length === 0) {
                setModelSpeaking(false);
              }
            };
          }
        } catch (e) {
          console.error('Error handling WebSocket audio', e);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket Live Error', e);
        setErrorMessage('WebSocket connection failed. Verify server is online.');
        setIsConnecting(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setStatusText('Call ended');
        stopActiveAudioSources();
      };

      // 4. Hook microphone stream to audio processor
      const sourceNode = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) {
          setUserSpeaking(false);
          return;
        }

        const inputChannel = e.inputBuffer.getChannelData(0);

        // Simple RMS volume detection for visualizer
        let sum = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          sum += inputChannel[i] * inputChannel[i];
        }
        const rms = Math.sqrt(sum / inputChannel.length);
        setUserSpeaking(rms > 0.02);

        const pcm16 = floatTo16BitPCM(inputChannel);
        const base64 = base64Encode(pcm16);

        ws.send(JSON.stringify({ audio: base64 }));
      };

      sourceNode.connect(processor);
      processor.connect(inputCtx.destination);
    } catch (err: any) {
      console.error('Failed to initiate live voice session', err);
      setErrorMessage(
        err?.name === 'NotAllowedError'
          ? 'Microphone access was denied. Please allow microphone permission in your browser.'
          : err?.message || 'Failed to start Live Voice session'
      );
      setIsConnecting(false);
      setStatusText('Connection error');
    }
  };

  const endSession = () => {
    stopActiveAudioSources();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (_) {}
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setUserSpeaking(false);
    setModelSpeaking(false);
    setStatusText('Session disconnected');
  };

  useEffect(() => {
    if (!isOpen) {
      endSession();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Radio className={`w-5 h-5 ${isConnected ? 'animate-pulse text-emerald-400' : ''}`} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base">Gemini Live Voice CFO</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  gemini-3.8-live
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ultra-low latency real-time voice conversations with bidirectional audio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Visualizer & Call State */}
        <div className="p-8 flex flex-col items-center justify-center space-y-6">
          {/* Animated Central Orb */}
          <div className="relative flex items-center justify-center">
            {/* Outer Ripple */}
            <div
              className={`absolute w-36 h-36 rounded-full transition-all duration-300 ${
                modelSpeaking
                  ? 'bg-indigo-500/20 animate-ping'
                  : userSpeaking
                  ? 'bg-emerald-500/20 animate-ping'
                  : 'bg-transparent'
              }`}
            />
            {/* Middle Glow */}
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${
                modelSpeaking
                  ? 'bg-gradient-to-tr from-indigo-600 to-cyan-500 border-cyan-300 shadow-lg shadow-cyan-500/30'
                  : userSpeaking
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 border-emerald-300 shadow-lg shadow-emerald-500/30'
                  : isConnected
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-slate-800/60 border-slate-700'
              }`}
            >
              {modelSpeaking ? (
                <Volume2 className="w-10 h-10 text-white animate-bounce" />
              ) : (
                <Mic className={`w-10 h-10 ${userSpeaking ? 'text-white' : 'text-slate-400'}`} />
              )}
            </div>
          </div>

          {/* Status Indicators */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center space-x-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected
                    ? 'bg-emerald-400 animate-pulse'
                    : isConnecting
                    ? 'bg-amber-400 animate-spin'
                    : 'bg-slate-500'
                }`}
              />
              <span className="text-sm font-semibold text-slate-200">{statusText}</span>
            </div>
            <p className="text-xs text-slate-400">
              {modelSpeaking
                ? 'Gemini Live is speaking (interrupt anytime by speaking)...'
                : userSpeaking
                ? 'Streaming your voice to Gemini...'
                : isConnected
                ? 'Speak naturally: ask about cash gaps, runway, or payroll survival'
                : 'Click Start Voice Session below to begin speaking'}
            </p>
          </div>

          {/* Context Snippet */}
          <div className="w-full bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                Entity: <strong className="text-white">{businessName}</strong> (Opening Cash: ₹
                {initialCash.toLocaleString('en-IN')})
              </span>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono">16kHz in / 24kHz out</span>
          </div>

          {/* Error notice if any */}
          {errorMessage && (
            <div className="w-full bg-rose-950/60 border border-rose-800 text-rose-300 p-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-center space-x-4">
          {!isConnected ? (
            <button
              onClick={startSession}
              disabled={isConnecting}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 flex items-center space-x-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>{isConnecting ? 'Connecting Live API...' : 'Start Voice Session'}</span>
            </button>
          ) : (
            <>
              {/* Mute Button */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3 rounded-xl border font-medium text-xs flex items-center space-x-2 transition-colors cursor-pointer ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? 'Muted' : 'Mute'}</span>
              </button>

              {/* End Call Button */}
              <button
                onClick={endSession}
                className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/30 flex items-center space-x-2 cursor-pointer transition-all"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Disconnect Call</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
