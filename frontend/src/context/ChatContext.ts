import { createContext, useContext } from 'react';
import { useSamvidhanChat } from '../hooks/useSamvidhanChat';

type ChatContextType = ReturnType<typeof useSamvidhanChat>;

export const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatContext.Provider');
    }
    return context;
}
