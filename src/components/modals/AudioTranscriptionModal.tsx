import React, { useState, useRef } from 'react';
import {
  Mic,
  MicOff,
  FileAudio,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
  Volume2,
  Trash2,
} from 'lucide-react';
import { requestAudioTranscription } from '../../services/api-service';

interface AudioTranscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTranscription?: (text: string) => void;
}

export const AudioTranscriptionModal: React.FC<AudioTranscriptionModalProps> = ({
  isOpen,
  onClose,
  onApplyTranscription,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        clearInterval(timerRef.current);
        setRecordingSeconds(0);
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) return;

        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            const result = await requestAudioTranscription(base64Data, 'audio/webm');
            setIsTranscribing(false);

            if (result.success && result.transcription) {
              setTranscriptionText((prev) =>
                prev ? `${prev}\n\n${result.transcription}` : result.transcription || ''
              );
            } else {
              setErrorMessage(
                result.error || 'Failed to transcribe audio. Verify GEMINI_API_KEY.'
              );
            }
          };
        } catch (err: any) {
          setIsTranscribing(false);
          setErrorMessage(err?.message || 'Error processing audio file');
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(
        err?.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access.'
          : err?.message || 'Failed to access microphone'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const copyToClipboard = () => {
    if (!transcriptionText) return;
    navigator.clipboard.writeText(transcriptionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <FileAudio className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base">Gemini Audio Transcription</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  gemini-3.5-transcribe
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Dictate financial logs, vendor commitments, or transaction memos with high accuracy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Recording Action Area */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-950/50 rounded-2xl border border-slate-800/80 space-y-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-rose-600/40 ring-4 ring-rose-500/30'
                  : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30'
              }`}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>

            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                {isRecording
                  ? `Recording in progress... (${recordingSeconds}s)`
                  : isTranscribing
                  ? 'Transcribing audio with gemini-3.5-transcribe...'
                  : 'Click microphone to record voice memo'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Speak payment amounts, vendor names, dates, or invoice commitments
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Transcription Output Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Transcribed Text Output:</span>
              <div className="flex items-center space-x-2">
                {transcriptionText && (
                  <>
                    <button
                      onClick={copyToClipboard}
                      className="hover:text-white flex items-center space-x-1"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={() => setTranscriptionText('')}
                      className="hover:text-rose-400 flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <textarea
              value={transcriptionText}
              onChange={(e) => setTranscriptionText(e.target.value)}
              placeholder="Your transcribed voice text will appear here automatically..."
              rows={6}
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-violet-500 leading-relaxed placeholder-slate-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Model: gemini-3.5-transcribe
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            {onApplyTranscription && transcriptionText && (
              <button
                onClick={() => {
                  onApplyTranscription(transcriptionText);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs shadow-md transition-colors"
              >
                Apply to Notes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
