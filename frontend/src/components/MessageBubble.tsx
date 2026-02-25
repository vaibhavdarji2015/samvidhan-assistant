import { Bot, User, AlertCircle, CircleArrowRight, File } from 'lucide-react';
import { type ChatMessage } from '../types/chat';
import { useChat } from '../context/ChatContext';

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  const { language } = useChat();
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  return (
    <div id={`msg-${msg.id}`} className={`flex gap-3 max-w-[85%] animate-in slide-in-from-bottom-2 ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-100 text-blue-600' :
        isSystem ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-600'
        }`}>
        {isUser ? <User className="w-5 h-5" /> : isSystem ? <AlertCircle className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Bubble Content */}
      <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`p-4 rounded-2xl shadow-sm ${isUser ? 'bg-blue-600 text-white rounded-tr-none' :
          isSystem ? 'bg-red-50 border border-red-100 text-red-700 rounded-tl-none text-sm font-medium' :
            'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
          }`}>
          <p className="whitespace-pre-wrap leading-relaxed">
            {
              msg.content.split(/(\[.*?\]\(.*?\))/g).map((part, i) => {
                const match = part.match(/\[(.*?)\]\((.*?)\)/);
                if (match) {
                  const label = match[1];
                  const url = match[2];
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 px-3 py-2 bg-white text-blue-700 rounded-lg shadow-sm border border-blue-100 font-semibold hover:bg-blue-50 transition-all"
                    >
                      <File className="w-5 h-5" /> {label}
                    </a>
                  );
                }
                return <span key={i}>{part}</span>;
              })
            }
          </p>

          {/* Attached Evidence Preview */}
          {msg.evidence_urls && msg.evidence_urls.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {msg.evidence_urls.map((url, i) => (
                <div key={i} className="flex-shrink-0">
                  {url.toLowerCase().includes('.pdf') || url.endsWith('#document') ? (
                    <a
                      href={url.split('#')[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex flex-col items-center justify-center w-32 h-40 rounded-lg border shadow-sm transition-all hover:scale-[1.02] ${isUser
                        ? 'bg-blue-700/50 border-blue-400/30 text-white'
                        : 'bg-white border-slate-200 text-blue-600'
                        }`}
                    >
                      <File className="w-10 h-10 mb-3 opacity-90" />
                      <span className="text-xs font-semibold text-center px-2">
                        PDF Document
                      </span>
                    </a>
                  ) : url.match(/\.(mp4|webm|mov|mkv|avi)(\?|$)/i) || url.endsWith('#video') ? (
                    <video
                      src={url}
                      controls
                      className="max-w-full h-auto max-h-48 rounded-lg border border-white/20 shadow-sm bg-black/5"
                    />
                  ) : (
                    <img
                      src={url}
                      alt={`Evidence ${i + 1}`}
                      className="max-w-full h-auto max-h-48 rounded-lg border border-white/20 shadow-sm object-contain bg-black/5"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* AI Audio Response Playback */}
          {msg.audio_base64 && (
            <audio controls autoPlay className="w-full mt-3 h-10 outline-none" src={`data:audio/wav;base64,${msg.audio_base64}`} />
          )}
        </div>

        {/* English Reference Accordion */}
        {msg.source_english && language !== 'en-IN' && (
          <details className="group ml-1">
            <summary className="text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-600 list-none flex items-center gap-1 transition-colors">
              <span className="transition-transform group-open:rotate-90"><CircleArrowRight className="w-3 h-3" /></span>
              English Reference
            </summary>
            <div className="mt-2 text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-200 max-w-md shadow-sm">
              {msg.source_english}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}