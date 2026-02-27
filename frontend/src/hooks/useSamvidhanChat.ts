import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import type { ChatMessage, QueryRequest, QueryResponse, Attachment } from '../types/chat';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function useSamvidhanChat(language: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    return localStorage.getItem('samvidhan_active_chat') || crypto.randomUUID();
  });

  const loadChat = async (chatId: string) => {
    if (!auth.currentUser) return;

    // CRUCIAL: Clear messages before switching activeChatId! 
    // This stops saveToCloud from saving the old chat's messages into the new chat's Firestore document.
    setMessages([]);
    setActiveChatId(chatId);
    localStorage.setItem('samvidhan_active_chat', chatId);

    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'chats', chatId);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().messages) {
        setMessages(snap.data().messages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to load chat:", error);
    }
  };

  const createNewChat = () => {
    const newId = crypto.randomUUID();
    setActiveChatId(newId);
    localStorage.setItem('samvidhan_active_chat', newId);
    setMessages([]);
  };

  // 1. Download past conversation when citizen logs in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Resolve latest chat intentionally bypassing closure staleness
        const initialChat = localStorage.getItem('samvidhan_active_chat') || activeChatId;
        loadChat(initialChat);
      } else {
        setMessages([]); // Clear on logout
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Instantly save updates to the cloud when messages change
  useEffect(() => {
    if (!auth.currentUser || messages.length === 0) return;

    // Prevent syncing temporary Blob URLs to the cloud
    const hasBlobs = messages.some(m =>
      m.evidence_urls?.some(url => url.startsWith('blob:'))
    );
    if (hasBlobs) return;

    const saveToCloud = async () => {
      try {
        const docRef = doc(db, 'users', auth.currentUser!.uid, 'chats', activeChatId);

        // Strip bulky audio_base64 before sending to Firestore to prevent exceeding size limits
        const firestoreSafeMessages = JSON.parse(JSON.stringify(messages)).map((m: any) => {
          const { audio_base64, ...rest } = m;
          return rest;
        });

        // Generate a preview title from the first user message
        const firstUserMsg = messages.find(m => m.role === 'user');
        const title = firstUserMsg ? firstUserMsg.content.substring(0, 50) + '...' : 'New Complaint';

        await setDoc(docRef, {
          chatId: activeChatId,
          title: title,
          updatedAt: serverTimestamp(),
          messages: firestoreSafeMessages
        }, { merge: true });

      } catch (error) {
        console.error("Failed to sync chat history to cloud:", error);
      }
    };

    saveToCloud();
  }, [messages, activeChatId]);

  // Helper to extract clean history for the backend
  const getCleanHistory = useCallback(() => {
    return messages
      .filter((m) => m.role !== 'system')
      .map(({ role, content, evidence_urls }) => ({ role, content, evidence_urls }));
  }, [messages]);

  // Handle errors uniformly
  const handleError = (error: unknown, fallbackMsg: string) => {
    let errorMsg = fallbackMsg;
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      errorMsg = error.response.data.detail;
    } else if (error instanceof Error) {
      errorMsg = error.message;
    }
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'system', content: `Error: ${errorMsg}` }]);
  };

  // Text & Evidence Mutation
  const askMutation = useMutation<QueryResponse, Error, QueryRequest>({
    mutationFn: async (payload) => {
      // 1. Get the secure Firebase token
      const token = await auth.currentUser?.getIdToken();
      const { data } = await axios.post<QueryResponse>(
        `${API_BASE}/api/ask`,
        payload,
        // 2. Attach it to the Authorization header
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        source_english: data.source_english,
      }]);
    },
    onError: (error) => handleError(error, 'Failed to connect to Samvidhan Agent.')
  });

  // Voice Mutation
  const askAudioMutation = useMutation<QueryResponse, Error, { formData: FormData, tempId: string }>({
    mutationFn: async ({ formData }) => {
      // 1. Get the secure Firebase token
      const token = await auth.currentUser?.getIdToken();
      const { data } = await axios.post<QueryResponse>(
        `${API_BASE}/api/ask-audio`,
        formData,
        // 2. Attach it to the Authorization header
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
    onSuccess: (data, variables) => {
      setMessages((prev) => {
        const updatedUserMessages = prev.map(m => {
          if (m.id === variables.tempId && data.transcribed_text) {
            return { ...m, content: `${data.transcribed_text}` };
          }
          return m;
        });

        return [...updatedUserMessages, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.answer,
          source_english: data.source_english,
          audio_base64: data.audio_base64
        }];
      });
    },
    onError: (error) => handleError(error, 'Failed to process voice query.')
  });

  // Handle Text + GCS Upload
  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim() && pendingAttachments.length === 0) return;

    const attachmentsToUpload = [...pendingAttachments];
    setPendingAttachments([]); // Instantly clear UI input

    const userMessageId = crypto.randomUUID();
    const optimisticMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: text || '📎 [Evidence Attached]',
      evidence_urls: attachmentsToUpload.length > 0 ? attachmentsToUpload.map(a => `${a.previewUrl}#${a.type}`) : undefined
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    let evidenceUrls: string[] = [];

    if (attachmentsToUpload.length > 0) {
      setIsUploading(true);
      try {
        const token = await auth.currentUser?.getIdToken();

        const uploadPromises = attachmentsToUpload.map(async (attachment) => {
          const uniqueFileName = `${crypto.randomUUID()}-${attachment.file.name.replace(/\s+/g, '_')}`;

          const urlResponse = await axios.post(
            `${API_BASE}/api/generate-upload-url`,
            {
              filename: uniqueFileName,
              content_type: attachment.file.type
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const { signed_url, public_url } = urlResponse.data;

          await axios.put(signed_url, attachment.file, {
            headers: { 'Content-Type': attachment.file.type }
          });

          return public_url;
        });

        evidenceUrls = await Promise.all(uploadPromises);
      } catch (error) {
        console.error("GCS upload failed:", error);
        handleError(error, 'Failed to securely upload evidence to Google Cloud Storage.');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    // Update UI state with real URLs so that future History generation gets public URLs instead of local blobs
    if (evidenceUrls.length > 0) {
      setMessages(prev => prev.map(m => m.id === userMessageId ? { ...m, evidence_urls: evidenceUrls } : m));
    }

    const historyToSend = [
      ...getCleanHistory(),
      {
        role: optimisticMessage.role,
        content: optimisticMessage.content,
        evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : undefined
      }
    ];

    askMutation.mutate({
      query_text: text || 'Please review the attached evidence.',
      target_language: language,
      chat_history: historyToSend
    });
  }, [language, pendingAttachments, askMutation, getCleanHistory]);

  // Handle Voice Recording Submission
  const sendVoiceMessage = useCallback(async (audioBlob: Blob) => {
    const tempId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: '🎤 [Processing voice message...]' }]);

    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'recording.webm');
    formData.append('target_language', language);
    formData.append('chat_history_str', JSON.stringify(getCleanHistory()));

    askAudioMutation.mutate({ formData, tempId });
  }, [language, askAudioMutation, getCleanHistory]);

  const isPending = isUploading || askMutation.isPending || askAudioMutation.isPending;

  return {
    messages,
    isPending,
    sendTextMessage,
    sendVoiceMessage,
    pendingAttachments,
    setPendingAttachments,
    language,
    activeChatId,
    loadChat,
    createNewChat
  };
}