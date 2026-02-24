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

  return (
    <div className={`flex-1 p-6 space-y-6 bg-slate-50/50 custom-scrollbar`}>
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 animate-in fade-in">
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
  );
}