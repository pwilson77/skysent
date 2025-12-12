import { create } from "zustand";
import { persist } from "zustand/middleware";
import { messageUser } from "@/hooks/useAiListener";

export type ChatMessage = {
  user: messageUser;
  msg: string;
  time: number;
};

export type PendingResponse = {
  id: string;
  user: messageUser;
  addedAt: number;
};

type ChatState = {
  messages: ChatMessage[];
  pendingResponses: PendingResponse[];
  sessionId: string | null;
  sessionId2: string | null;
  channelId: string | null;
  
  addMessage: (message: ChatMessage) => void;
  addPendingResponse: (user: messageUser) => string;
  removePendingResponse: (id: string) => void;
  setSessionId: (id: string) => void;
  setSessionId2: (id: string) => void;
  setChannelId: (id: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      pendingResponses: [],
      sessionId: null,
      sessionId2: null,
      channelId: null,
      
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
        
      addPendingResponse: (user) => {
        const id = `pending-${Date.now()}-${Math.random()}`;
        set((state) => ({
          pendingResponses: [...state.pendingResponses, { id, user, addedAt: Date.now() }],
        }));
        return id;
      },
      
      removePendingResponse: (id) =>
        set((state) => ({
          pendingResponses: state.pendingResponses.filter((p) => p.id !== id),
        })),
        
      setSessionId: (id) => set({ sessionId: id }),
      setSessionId2: (id) => set({ sessionId2: id }),
      setChannelId: (id) => set({ channelId: id }),
    }),
    {
      name: "chat-storage",
    }
  )
);