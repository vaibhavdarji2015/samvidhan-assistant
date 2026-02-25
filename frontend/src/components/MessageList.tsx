import { useRef, useEffect } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { useChat } from '../context/ChatContext';

export function MessageList() {
  const { messages, isPending } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  const userMessages = messages.filter((m) => m.role === 'user');

  return (
    <div className="flex-1 relative flex overflow-hidden">
      {/* Scrollable Main Chat Area */}
      <div className={`flex-1 overflow-y-auto p-6 lg:pr-14 space-y-6 bg-slate-50/50 custom-scrollbar flex flex-col`}>
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4 animate-in fade-in">
            <Bot className="w-16 h-16 text-slate-200" />
            <p className="text-center max-w-sm">
              Start a conversation. Upload evidence of civic issues, or ask about your constitutional rights.
            </p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}

        {isPending && (
          <div className="flex gap-3 mr-auto max-w-[85%] animate-in fade-in">
            <div className="shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600"><Bot className="w-5 h-5" /></div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium">Processing...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* DeepSeek Style Prompt Timeline */}
      {userMessages.length > 0 && (
        <div className="hidden lg:flex flex-col justify-center absolute right-2 top-0 bottom-0 pointer-events-none z-10">
          <div className="flex flex-col items-end justify-center max-h-[80vh] pointer-events-auto group rounded-2xl transition-all duration-300 ease-in-out hover:bg-white hover:shadow-lg border border-transparent hover:border-slate-200 hover:pl-4 hover:pr-3 py-3 pr-1">
            <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar-hidden w-full items-end">
              {userMessages.map((msg) => (
                <button
                  key={`nav-${msg.id}`}
                  onClick={() => {
                    const el = document.getElementById(`msg-${msg.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="flex items-center gap-3 justify-end w-full group/btn py-0.5"
                  aria-label="Scroll to prompt"
                >
                  <div className="overflow-hidden w-0 opacity-0 group-hover:w-[220px] group-hover:opacity-100 transition-all duration-300 ease-out text-right">
                    <span className="text-[11px] font-medium text-slate-500 group-hover/btn:text-blue-600 truncate block w-full tracking-wide">
                      {msg.content}
                    </span>
                  </div>
                  <div className="w-2 h-[2px] rounded-full bg-slate-300 group-hover:bg-slate-400 transition-colors shrink-0 group-hover/btn:!bg-blue-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}