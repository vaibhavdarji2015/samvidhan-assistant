export interface Attachment {
  file: File;
  previewUrl: string;
  type: 'image' | 'video' | 'document';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  source_english?: string;
  audio_base64?: string;
  evidence_urls?: string[];
}

export interface QueryRequest {
  query_text: string;
  target_language: string;
  chat_history: { role: string; content: string }[];
}

export interface QueryResponse {
  answer: string;
  source_english: string;
  audio_base64?: string;
}