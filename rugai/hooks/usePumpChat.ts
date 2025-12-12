import { useEffect, useRef, useCallback } from "react";
import { MessagePriority } from "./useAiListener";
import { logger } from "@/store/useLoggerStore";

export type PumpMsg = {
  id?: string;
  username?: string;
  text: string;
  time?: number;
  raw?: any;
};

type Opts = {
  roomId: string;
  username?: string;
  processIntervalMs?: number;
  messageHistoryLimit?: number;
  onFlush?: (messages: PumpMsg[]) => void;
  sendMessage?: (prompt: string, user: 'system' | 'ai' | 'arcadius' | 'pumpstream', opts?: { skipFollowUp?: boolean; priority?: MessagePriority }) => Promise<any>; // NEW: Accept sendMessage as prop
};

export function usePumpChat(opts: Opts) {
  const {
    roomId,
    username = "rugai-bot",
    processIntervalMs = 60_000 * 5,
    messageHistoryLimit = 200,
    sendMessage // NEW: Destructure from opts
  } = opts;

  const bufferRef = useRef<PumpMsg[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const connectedRef = useRef(false);
  const onFlushRef = useRef(opts.onFlush);
  const processedIdsRef = useRef<Set<string>>(new Set()); // Track processed message IDs

  useEffect(() => {
    onFlushRef.current = opts.onFlush;
  }, [opts.onFlush]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = `/api/pump-chat?roomId=${encodeURIComponent(roomId)}&username=${encodeURIComponent(username)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      logger.system(`Connected to pump.fun chat: ${roomId.slice(0, 8)}...`, 'usePumpChat');
      connectedRef.current = true;
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);

        switch (parsed.type) {
          case "connected":
            logger.info(`Client connected to room: ${roomId.slice(0, 8)}...`, 'usePumpChat');
            break;

          case "message":
            const msg: PumpMsg = {
              id: parsed.data.id,
              username: parsed.data.username,
              text: parsed.data.message,
              time: parsed.data.timestamp ? Date.parse(parsed.data.timestamp) : Date.now(),
              raw: parsed.data,
            };
            bufferRef.current.push(msg);
            if (bufferRef.current.length > messageHistoryLimit) {
              bufferRef.current.shift();
            }
            break;

          case "history":
            if (Array.isArray(parsed.data)) {
              parsed.data.forEach((m: Record<string, unknown>) => {
                bufferRef.current.push({
                  id: m.id as string | undefined,
                  username: m.username as string | undefined,
                  text: (m.message as string) || '',
                  time: m.timestamp ? Date.parse(m.timestamp as string) : Date.now(),
                  raw: m,
                });
              });
              if (bufferRef.current.length > messageHistoryLimit) {
                bufferRef.current = bufferRef.current.slice(-messageHistoryLimit);
              }
            }
            break;

          case "disconnected":
            logger.warn('Disconnected from pump.fun chat', 'usePumpChat');
            connectedRef.current = false;
            break;

          case "error":
            logger.error(`Chat error: ${parsed.message}`, 'usePumpChat');
            break;
        }
      } catch (e) {
        logger.error(`Parse error: ${e}`, 'usePumpChat');
      }
    };

    es.onerror = () => {
      logger.error('SSE connection error', 'usePumpChat');
      connectedRef.current = false;
    };

    return () => {
      es.close();
      esRef.current = null;
      connectedRef.current = false;
    };
  }, [roomId, username, messageHistoryLimit]);

  useEffect(() => {
    // NEW: Don't run if sendMessage isn't provided
    if (!sendMessage) {
      logger.warn('sendMessage not provided, skipping AI processing', 'usePumpChat');
      return;
    }

    let inFlight = false;

    const processAndSendToAI = async () => {
      if (inFlight || bufferRef.current.length === 0) return;

      inFlight = true;
      const buffered = bufferRef.current.slice();

      try {
        // Filter out already processed messages
        const newMessages = buffered.filter((m) => {
          const msgId = m.id || `${m.username}-${m.time}-${m.text.slice(0, 20)}`;
          if (processedIdsRef.current.has(msgId)) {
            return false;
          }
          processedIdsRef.current.add(msgId);
          return true;
        });

        if (newMessages.length === 0) {
          logger.debug('No new messages to process', 'usePumpChat');
          bufferRef.current = [];
          inFlight = false;
          return;
        }

        const messageSummary = newMessages
          .map((m) => `[${m.username ?? "anon"}]: ${m.text}`)
          .join("\n");

        const prompt = `Recent pump.fun chat messages for token ${roomId.slice(0, 8)}...:\n\n${messageSummary}\n\nAnalyze the sentiment and provide insights about the token discussion.`;

        await sendMessage(prompt, "pumpstream", { 
          priority: MessagePriority.HIGH,
          skipFollowUp: true // Don't start conversation chains from pump chat
        });
        
        logger.info(`Sent ${newMessages.length} new pump chat messages to AI (${buffered.length - newMessages.length} duplicates filtered)`, 'usePumpChat');

        onFlushRef.current?.(newMessages);
        bufferRef.current = [];
      } catch (e) {
        logger.error(`Failed to send to AI: ${e}`, 'usePumpChat');
      } finally {
        inFlight = false;
      }
    };

    processAndSendToAI();
    const id = setInterval(processAndSendToAI, processIntervalMs);

    return () => clearInterval(id);
  }, [roomId, processIntervalMs, sendMessage]);

  return {
    isConnected: () => connectedRef.current,
    getBuffered: () => bufferRef.current.slice(),
    clearBuffer: () => { bufferRef.current = []; },
    getMessageCount: () => bufferRef.current.length,
  };
}