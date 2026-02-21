import { useState, useRef } from 'react'
import axios, { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query'
import {
  Send,
  Loader2,
  BookOpen,
  AlertCircle,
  Mic,
  Square,
  CircleArrowRight
} from 'lucide-react';

// Type Safety: Define strict interfaces matching our Python backend
interface QueryRequest {
  query_text: string;
  target_language: string;
}

interface QueryResponse {
  answer: string;
  source_english: string;
  audio_base64?: string;
}

interface ApiError {
  detail?: string;
}

// Reusable language configurations
const LANGUAGES = [
  { code: 'hi-IN', name: 'Hindi (हिंदी)' },
  { code: 'gu-IN', name: 'Gujarati (ગુજરાતી)' },
  { code: 'bn-IN', name: 'Bengali (বাংলা)' },
  { code: 'ta-IN', name: 'Tamil (தமிழ்)' }
] as const;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<string>(LANGUAGES[0].code);
  const [isRecording, setIsRecording] = useState(false);

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Mutation for Text
  const askMutation = useMutation<QueryResponse, AxiosError, QueryRequest>({
    mutationFn: async (payload) => {
      // Connects to the local FastAPI backend
      const response = await axios.post<QueryResponse>(`${API_BASE}/api/ask`, payload);
      return response.data;
    }
  });

  // Mutation for Audio (Uses FormData)
  const askAudioMutation = useMutation<QueryResponse, AxiosError, FormData>({
    mutationFn: async (formData) => {
      // Connects to the local FastAPI backend
      const response = await axios.post<QueryResponse>(`${API_BASE}/api/ask-audio`, formData);
      return response.data;
    }
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    askMutation.mutate({
      query_text: query.trim(),
      target_language: language
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'recording.webm');
        formData.append('target_language', language);
        askAudioMutation.mutate(formData);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert("Microphone access is required to use the voice feature.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Release the microphone track securely
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // Shared state for UI loading and errors
  const isPending = askMutation.isPending || askAudioMutation.isPending;
  const isError = askMutation.isError || askAudioMutation.isError;
  const errorObj = askMutation.error || askAudioMutation.error;
  const successData = askMutation.data || askAudioMutation.data;
  const isSuccess = askMutation.isSuccess || askAudioMutation.isSuccess;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 font-sans">
      <div className="w-full max-w-3xl bg-white shadow-lg rounded-2xl p-6 md:p-8 border border-slate-100">
        
        <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6">
          <div className="bg-blue-50 p-3 rounded-lg">
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Samvidhan Assistant</h1>
            <p className="text-slate-500 text-sm mt-1">Ask questions about your constitutional rights.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mb-8">
          <div className="flex flex-col gap-2">
            <label htmlFor="language-select" className="text-sm font-medium text-slate-700">
              Select Language
            </label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all cursor-pointer"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label htmlFor="query-input" className="text-sm font-medium text-slate-700">
              Your Question
            </label>
            <div className="flex gap-3 relative">
              <input
                id="query-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type or click the mic to speak..."
                disabled={isRecording || isPending}
                className="flex-1 p-4 pr-16 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-60"
              />
              
              {/* Audio Recording Button positioned inside the input */}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isPending}
                className={`absolute right-36 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                  isRecording 
                    ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse' 
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
                title={isRecording ? "Stop Recording" : "Start Recording"}
              >
                {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
              </button>

              <button 
                type="submit" 
                disabled={isPending || (!query.trim() && !isRecording)}
                className="bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px] font-medium shadow-sm"
              >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </form>

        {isError && (
          <div className="p-4 mb-6 bg-red-50 text-red-700 border border-red-100 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold">Failed to fetch answer</h4>
              <p className="text-sm mt-1 opacity-90">
                {(errorObj?.response?.data as ApiError)?.detail || errorObj?.message || 'An unexpected server error occurred.'}
              </p>
            </div>
          </div>
        )}

        {isSuccess && successData && (
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Answer
            </h3>
            <p className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap">
              {successData.answer}
            </p>

            {/* NEW: Audio Player - only renders if the backend successfully sends audio */}
            {
              successData.audio_base64 && (
                <div className="mt-5 mb-2">
                  <audio
                    controls
                    autoPlay
                    className="w-full h-12 rounded-lg outline-none"
                    src={`data:audio/wav;base64,${successData.audio_base64}`}
                  />
                </div>
              )
            }
            
            <div className="mt-6 pt-5 border-t border-slate-200/60">
              <details className="group">
                <summary className="text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 transition-colors list-none flex items-center gap-2">
                  <span className="transition-transform group-open:rotate-90">
                    <CircleArrowRight />
                  </span>
                  English Reference & Context
                </summary>
                <p className="text-sm text-slate-600 mt-3 pl-4 border-l-2 border-slate-200">
                  {successData.source_english}
                </p>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
