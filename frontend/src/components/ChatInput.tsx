import { useState, useRef } from 'react';
import { Send, Mic, Paperclip, X, Square, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChat } from '../context/ChatContext';

export function ChatInput() {
  const { sendTextMessage, sendVoiceMessage, isPending, pendingAttachments, setPendingAttachments } = useChat();

  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && pendingAttachments.length === 0) return;
    sendTextMessage(text);
    setText('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments = Array.from(files).map(file => {
      let fileType: 'video' | 'image' | 'document' = 'image';
      if (file.type.startsWith('video/')) fileType = 'video';
      else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) fileType = 'document';

      return { file, previewUrl: URL.createObjectURL(file), type: fileType };
    });

    setPendingAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        sendVoiceMessage(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert("Microphone access is required.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="p-4 bg-white border-t border-slate-100 rounded-b-2xl shrink-0">
      {pendingAttachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {pendingAttachments.map((attachment, idx) => (
            <div key={idx} className="p-2 pr-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3 w-fit animate-in fade-in shadow-sm">
              {attachment.type === 'image' && (
                <img src={attachment.previewUrl} alt="preview" className="w-12 h-12 object-cover rounded-md border border-slate-200 shadow-sm" />
              )}
              {attachment.type === 'video' && (
                <video src={attachment.previewUrl} className="w-12 h-12 object-cover rounded-md border border-slate-200 shadow-sm" />
              )}
              {attachment.type === 'document' && (
                <div className="w-12 h-12 bg-white flex flex-col items-center justify-center rounded-md border border-slate-200 shadow-sm text-blue-600"><FileText className="w-6 h-6" /></div>
              )}

              <div className="flex flex-col mr-2">
                <span className="text-sm text-slate-700 font-semibold truncate max-w-[120px]">{attachment.file.name}</span>
                <span className="text-xs text-slate-500 capitalize">{attachment.type}</span>
              </div>

              <Button variant="ghost" size="icon" type="button" onClick={() => removeAttachment(idx)} className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 ml-auto transition-colors"><X className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-3 items-end w-full">
        {/* Hidden File Input */}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,.pdf" multiple />

        {/* Attachment Button */}
        <Button variant="ghost" size="icon" type="button" onClick={() => fileInputRef.current?.click()} disabled={isPending || isRecording} className="h-[48px] w-[48px] text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all mb-1 shrink-0">
          <Paperclip className="w-5 h-5" />
        </Button>

        {/* Text Area & Mic Button Container */}
        <div className="relative flex-1">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); } }}
            placeholder="Describe your issue or upload evidence..."
            disabled={isPending || isRecording}
            // Note: Added pr-12 here so typed text doesn't hide behind the mic button!
            className="w-full max-h-32 min-h-[56px] p-4 pr-12 resize-none border-slate-200 rounded-xl bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 transition-all disabled:opacity-60 text-base"
            rows={1}
          />

          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isPending}
            // Changed from right-[88px] to right-2 so it anchors to the Textarea instead
            className={`absolute right-2 bottom-2 w-10 h-10 rounded-lg transition-all ${isRecording ? 'bg-red-100 text-red-600 hover:bg-red-100 hover:text-red-700 animate-pulse' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
          >
            {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
          </Button>
        </div>

        {/* Send Button */}
        <Button type="submit" disabled={isPending || (!text.trim() && pendingAttachments.length === 0) || isRecording} className="bg-blue-600 text-white h-[56px] w-[64px] rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center shrink-0">
          <Send className="w-5 h-5" />
        </Button>
      </form>
    </div>
  );
}