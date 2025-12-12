import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "../store/useChatStore";
import { AIService } from "@/lib/aiService";
import { UUID } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/store/useLoggerStore";

type LoopOpts = {
  loop?: boolean;
  intervalMs?: number;
  questions?: string[];
};

function nowLabel() {
  return Date.now();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type messageUser = "system" | "pumpstream" | "ai" | "streamchat" | "arcadius";

export enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
}

type QueuedMessage = {
  id: string;
  prompt: string;
  user: messageUser;
  priority: MessagePriority;
  timestamp: number;
  skipFollowUp?: boolean;
  conversationId?: string;
  retryCount?: number;
  resolve: (value: { response: string; responseUser: messageUser } | null) => void;
  reject: (reason?: any) => void;
};

const MAX_CONVERSATION_DEPTH = 2;
const MAX_RETRIES = 1;

export enum DeliveryStrategy {
  SESSION = "session",
  WEBSOCKET = "websocket",
}

export function useAiListener(strategy: DeliveryStrategy = DeliveryStrategy.WEBSOCKET) {
  const sessionRef = useRef<string | undefined>(undefined);
  const sessionRef2 = useRef<string | undefined>(undefined);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const loopRunningRef = useRef<boolean>(false);
  const loopCancelRef = useRef<(() => void)>(() => {});
  
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  
  const conversationDepthRef = useRef<Map<string, number>>(new Map());
  
  const skySendRef = useRef<((text: string) => Promise<any>) | null>(null);
  const arcadiusSendRef = useRef<((text: string) => Promise<any>) | null>(null);
  
  // NEW: Track pending messages waiting for responses
  const pendingResponseMap = useRef<Map<string, QueuedMessage>>(new Map());
  
  // NEW: Track recent system messages to deduplicate
  const recentSystemMessagesRef = useRef<Set<string>>(new Set());
  
  const addMessage = useChatStore((s) => s.addMessage);
  const addPendingResponse = useChatStore((s) => s.addPendingResponse);
  const removePendingResponse = useChatStore((s) => s.removePendingResponse);
  const setSessionId = useChatStore((s) => s.setSessionId);
  const setSessionId2 = useChatStore((s) => s.setSessionId2);

  const insertIntoPriorityQueue = useCallback((message: QueuedMessage) => {
    const queue = messageQueueRef.current;
    
    let insertIndex = queue.findIndex(
      (item) => 
        item.priority < message.priority || 
        (item.priority === message.priority && item.timestamp > message.timestamp)
    );
    
    if (insertIndex === -1) {
      queue.push(message);
    } else {
      queue.splice(insertIndex, 0, message);
    }
  }, []);

  const registerAgentStreams = useCallback((
    skySendFn: (text: string) => Promise<any>,
    arcadiusSendFn: (text: string) => Promise<any>
  ) => {
    skySendRef.current = skySendFn;
    arcadiusSendRef.current = arcadiusSendFn;
    logger.system('Agent stream send functions registered', 'useAiListener');
  }, []);

  const handleAgentResponse = useCallback((responseUser: messageUser, responseText: string) => {
    for (const [id, item] of pendingResponseMap.current.entries()) {
      const expectedUser = item.user === "ai" ? "arcadius" : "ai";
      
      if (expectedUser === responseUser) {
        const timeoutId = (item as any).__timeoutId;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        pendingResponseMap.current.delete(id);
        item.resolve({ response: responseText, responseUser });
        
        if (strategy === DeliveryStrategy.WEBSOCKET && !item.skipFollowUp && item.conversationId) {
          const depth = conversationDepthRef.current.get(item.conversationId) ?? 0;
          
          if (depth < MAX_CONVERSATION_DEPTH) {
            conversationDepthRef.current.set(item.conversationId, depth + 1);

            if (depth === 0) {
              logger.debug(`Depth 0: ${responseUser} responded, sending to ${expectedUser === 'ai' ? 'Skysent' : 'Arcadius'}`, 'useAiListener');
              insertIntoPriorityQueue({
                id: `followup-${Date.now()}`,
                prompt: `Arcadius, Skysent said: "${responseText.slice(0, 200)}..." Your response?`,
                user: "ai",
                priority: MessagePriority.NORMAL,
                timestamp: Date.now(),
                skipFollowUp: false,
                conversationId: item.conversationId,
                retryCount: 0,
                resolve: () => {},
                reject: () => {},
              });
              wakeQueue();
            } else if (depth === 1) {
              logger.debug(`Depth 1: ${responseUser} responded, sending closing to Skysent`, 'useAiListener');
              insertIntoPriorityQueue({
                id: `closing-${Date.now()}`,
                prompt: `Skysent, Arcadius said: "${responseText.slice(0, 200)}..." Give your final response.`,
                user: "system",
                priority: MessagePriority.HIGH,
                timestamp: Date.now(),
                skipFollowUp: true,
                conversationId: item.conversationId,
                retryCount: 0,
                resolve: () => {},
                reject: () => {},
              });
              wakeQueue();
            } else {
              logger.debug(`Depth ${depth}: Conversation complete`, 'useAiListener');
              conversationDepthRef.current.delete(item.conversationId);
            }
          } else {
            conversationDepthRef.current.delete(item.conversationId);
          }
        }
        
        break;
      }
    }
  }, [strategy, insertIntoPriorityQueue]);

  // ============= SESSION-BASED METHODS (LEGACY) =============
  
  const createSession = async (agentId: string, userId: string) => {
    const response = await AIService.createSession(agentId, userId, { platform: "web" });
    if (!response.sessionId) {
      throw new Error(`Failed to create session for agent ${agentId}`);
    }
    return response.sessionId;
  };

  const seedSeenIds = async (sessionId: string, sessionId2?: string) => {
    try {
      const history = await AIService.retrieveSessionMessages(sessionId);
      seenIdsRef.current = new Set(history.messages.map((m) => m.id));

      if (sessionId2) {
        const history2 = await AIService.retrieveSessionMessages(sessionId2);
        history2.messages.forEach((m) => seenIdsRef.current.add(m.id));
      }
    } catch (error) {
      logger.warn('Failed to seed message history', 'useAiListener');
    }
  };

  async function initSessionIfNeeded(): Promise<{ sessionId: string; sessionId2: string }> {
    if (sessionRef.current && sessionRef2.current) {
      return { sessionId: sessionRef.current, sessionId2: sessionRef2.current };
    }

    const agentId = process.env.NEXT_PUBLIC_ELIZA_AGENT_ID || "default-agent";
    const agentId2 = process.env.NEXT_PUBLIC_ELIZA_AGENT_2_ID || "default-agent-2";
    const userId = uuidv4();
    const userId2 = uuidv4();

    try {
      const [sessionId, sessionId2] = await Promise.all([
        createSession(agentId, userId),
        createSession(agentId2, userId2)
      ]);

      sessionRef.current = sessionId;
      sessionRef2.current = sessionId2;

      setSessionId(sessionId);
      setSessionId2(sessionId2);

      addMessage({
        user: "system",
        msg: `Sessions initialized`,
        time: nowLabel()
      });

      logger.info(`Sessions initialized: ${sessionId.slice(0, 8)}...`, 'useAiListener');

      void seedSeenIds(sessionId, sessionId2);

      return { sessionId, sessionId2 };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addMessage({
        user: "system",
        msg: `Session init failed: ${errorMsg}`,
        time: nowLabel()
      });
      logger.error(`Session init failed: ${errorMsg}`, 'useAiListener');
      throw error;
    }
  }

  async function pollForAiResponse(sessionId: string, maxAttempts: number = 20): Promise<string | null> {
    let attempts = 0;
    const pollInterval = 5000;

    while (attempts < maxAttempts) {
      attempts += 1;

      try {
        const res = await AIService.retrieveSessionMessages(sessionId);

        for (const m of res.messages) {
          if (!m.content || seenIdsRef.current.has(m.id)) continue;
          seenIdsRef.current.add(m.id);

          if (m.isAgent) {
            return String(m.content);
          }
        }
      } catch (err) {
        logger.warn(`Poll error on attempt ${attempts}`, 'useAiListener');
      }

      await sleep(pollInterval + Math.floor(Math.random() * 500));
    }

    return null;
  }

  const sendMessageViaSession = useCallback(
    async (item: QueuedMessage) => {
      const { prompt, user, conversationId } = item;

      const depth = conversationId ? (conversationDepthRef.current.get(conversationId) ?? 0) : 0;
      if (user === "system" && depth === 0) {
        const isBalanceReport = prompt.includes("balance") || prompt.includes("Reporting wallet");
        
        if (isBalanceReport) {
          addMessage({ user: "system", msg: prompt, time: nowLabel() });
        } else {
          const msgKey = `${prompt}-${item.timestamp}`;
          
          if (!recentSystemMessagesRef.current.has(msgKey)) {
            recentSystemMessagesRef.current.add(msgKey);
            addMessage({ user: "system", msg: prompt, time: nowLabel() });
            
            setTimeout(() => {
              recentSystemMessagesRef.current.delete(msgKey);
            }, 5000);
          }
        }
      }

      const sessions = await initSessionIfNeeded();
      const isArcadiusSession = user === "ai";
      const targetSessionId = isArcadiusSession ? sessions.sessionId2 : sessions.sessionId;
      const responseUser = isArcadiusSession ? "arcadius" : "ai";

      const pendingId = addPendingResponse(responseUser);

      try {
        await AIService.sendSessionMessage(targetSessionId, prompt);
        const response = await pollForAiResponse(targetSessionId);

        if (response) {
          removePendingResponse(pendingId);

          addMessage({
            user: responseUser,
            msg: response,
            time: nowLabel(),
          });

          await Promise.resolve();

          return { response, responseUser };
        } else {
          removePendingResponse(pendingId);
          const timeoutError = new Error(`AI response timeout for ${isArcadiusSession ? "Arcadius" : "Skysent"}`);
          addMessage({ user: "system", msg: "No AI reply (timeout)", time: nowLabel() });
          logger.warn(`Response timeout for ${responseUser}`, 'useAiListener');
          throw timeoutError;
        }
      } catch (error) {
        removePendingResponse(pendingId);
        throw error;
      }
    },
    [addMessage, addPendingResponse, removePendingResponse]
  );

  const sendMessageViaWebSocket = useCallback(
    async (item: QueuedMessage) => {
      const { prompt, user, conversationId } = item;

      const isArcadiusMessage = user === "ai";
      const targetSendFn = isArcadiusMessage ? arcadiusSendRef.current : skySendRef.current;
      const agentName = isArcadiusMessage ? "Arcadius" : "Skysent";
      const responseUser = isArcadiusMessage ? "arcadius" : "ai";

      if (!targetSendFn) {
        throw new Error(`${agentName} WebSocket not initialized. Call registerAgentStreams first.`);
      }

      const depth = conversationId ? (conversationDepthRef.current.get(conversationId) ?? 0) : 0;
      if (user === "system" && depth === 0) {
        const isBalanceReport = prompt.includes("balance") || prompt.includes("Reporting wallet") || prompt.includes("📊");
        
        if (isBalanceReport) {
          // no more log wallet balance reports multiple times
          // addMessage({ user: "system", msg: prompt, time: nowLabel() });
        } else {
          const msgKey = `${prompt}-${item.timestamp}`;
          
          if (!recentSystemMessagesRef.current.has(msgKey)) {
            recentSystemMessagesRef.current.add(msgKey);
            addMessage({ user: "system", msg: prompt, time: nowLabel() });
            
            setTimeout(() => {
              recentSystemMessagesRef.current.delete(msgKey);
            }, 5000);
          }
        }
      }

      const pendingId = addPendingResponse(responseUser);

      try {
        pendingResponseMap.current.set(item.id, item);
        await targetSendFn(prompt);

        logger.info(`Message sent to ${agentName}`, 'useAiListener');

        return new Promise((resolve, reject) => {
          item.resolve = (value) => {
            removePendingResponse(pendingId);
            // Clear timeout when response arrives
            const timeoutId = (item as any).__timeoutId;
            if (timeoutId) {
              clearTimeout(timeoutId);
              delete (item as any).__timeoutId;
            }
            resolve(value);
          };
          item.reject = (reason) => {
            removePendingResponse(pendingId);
            pendingResponseMap.current.delete(item.id);
            // Clear timeout on reject
            const timeoutId = (item as any).__timeoutId;
            if (timeoutId) {
              clearTimeout(timeoutId);
              delete (item as any).__timeoutId;
            }
            reject(reason);
          };

          // 3 minute timeout for regular messages, 30 seconds for balance reports
          const isBalanceReport = prompt.includes("📊") || prompt.includes("Wallet Update");
          const timeoutMs = isBalanceReport ? 30000 : 180000;

          const timeoutId = setTimeout(() => {
            if (pendingResponseMap.current.has(item.id)) {
              pendingResponseMap.current.delete(item.id);
              removePendingResponse(pendingId);
              logger.warn(`${agentName} response timeout (${timeoutMs / 1000}s)`, 'useAiListener');
              
              // Don't reject for balance reports - just log
              if (isBalanceReport) {
                logger.info('Balance report timed out, continuing', 'useAiListener');
                resolve({ response: '', responseUser }); // Resolve with empty response
              } else {
                reject(new Error(`${agentName} response timeout (${timeoutMs / 1000}s)`));
              }
              delete (item as any).__timeoutId;
            }
          }, timeoutMs);

          (item as any).__timeoutId = timeoutId;
        });
      } catch (error) {
        removePendingResponse(pendingId);
        pendingResponseMap.current.delete(item.id);
        logger.error(`${agentName} WebSocket send error: ${error}`, 'useAiListener');
        throw error;
      }
    },
    [addMessage, addPendingResponse, removePendingResponse]
  );

  const sendMessageInternal = useCallback(
    async (item: QueuedMessage) => {
      if (strategy === DeliveryStrategy.SESSION) {
        return sendMessageViaSession(item);
      } else {
        return sendMessageViaWebSocket(item);
      }
    },
    [strategy, sendMessageViaSession, sendMessageViaWebSocket]
  );

  // ============= QUEUE PROCESSING =============

  const wakeQueue = () => {
    if (!isProcessingRef.current && messageQueueRef.current.length > 0) {
      setTimeout(() => {
        if (!isProcessingRef.current && messageQueueRef.current.length > 0) {
          void processQueue();
        }
      }, 0);
    }
  };

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      while (messageQueueRef.current.length > 0) {
        const item = messageQueueRef.current.shift()!;
        logger.debug(`Processing ${item.id} (retry: ${item.retryCount ?? 0})`, 'Queue');

        try {
          const result = await sendMessageInternal(item);

          if (strategy === DeliveryStrategy.SESSION && result && !item.skipFollowUp && item.conversationId) {
            const depth = conversationDepthRef.current.get(item.conversationId) ?? 0;
            if (depth < MAX_CONVERSATION_DEPTH) {
              conversationDepthRef.current.set(item.conversationId, depth + 1);
              const isArcadiusResponse = result.responseUser === "arcadius";

              if (!isArcadiusResponse) {
                insertIntoPriorityQueue({
                  id: `followup-${Date.now()}`,
                  prompt: `Hello Arcadius, Skysent said: "${result.response}". Challenge them briefly, and ask it to formulate a response that engages watchers.`,
                  user: "ai",
                  priority: MessagePriority.NORMAL,
                  timestamp: Date.now(),
                  skipFollowUp: false,
                  conversationId: item.conversationId,
                  retryCount: 0,
                  resolve: () => {},
                  reject: () => {},
                });
              } else {
                insertIntoPriorityQueue({
                  id: `closing-${Date.now()}`,
                  prompt: `Arcadius said: "${result.response}". Acknowledge briefly.`,
                  user: "system",
                  priority: MessagePriority.NORMAL,
                  timestamp: Date.now(),
                  skipFollowUp: true,
                  conversationId: item.conversationId,
                  retryCount: 0,
                  resolve: () => {},
                  reject: () => {},
                });
              }
            }
          }
        } catch (error) {
          const isTimeoutError = error instanceof Error && error.message.includes("timeout");
          const retryCount = item.retryCount ?? 0;

          if (isTimeoutError && retryCount < MAX_RETRIES) {
            logger.info(`Retrying ${item.id} (attempt ${retryCount + 1}/${MAX_RETRIES})`, 'Queue');
            
            insertIntoPriorityQueue({
              ...item,
              retryCount: retryCount + 1,
              priority: MessagePriority.HIGH,
              timestamp: Date.now(),
            });
          } else {
            logger.error(`Processing error: ${error}`, 'Queue');
            item.reject(error);
          }
        }

        await Promise.resolve();
      }
    } finally {
      isProcessingRef.current = false;
      wakeQueue();
    }
  }, [sendMessageInternal, insertIntoPriorityQueue, strategy]);

  const sendMessage = useCallback(
    async (prompt: string, user: messageUser = "system", opts?: { skipFollowUp?: boolean; priority?: MessagePriority }) => {
      return new Promise<{ response: string; responseUser: messageUser } | null>((resolve, reject) => {
        const priority = opts?.priority ?? MessagePriority.NORMAL;
        const conversationId = !opts?.skipFollowUp ? uuidv4() : undefined;

        if (conversationId) {
          conversationDepthRef.current.set(conversationId, 0);
        }

        insertIntoPriorityQueue({
          id: `msg-${Date.now()}`,
          prompt,
          user,
          priority,
          timestamp: Date.now(),
          skipFollowUp: opts?.skipFollowUp,
          conversationId,
          retryCount: 0,
          resolve,
          reject,
        });

        wakeQueue();
      });
    },
    [insertIntoPriorityQueue]
  );

  // ============= LOOP =============

  function startLoop(initialPrompt?: string, opts?: LoopOpts) {
    if (loopRunningRef.current) {
      logger.warn('Loop already running', 'useAiListener');
      return { stop: () => { loopRunningRef.current = false; } };
    }

    loopRunningRef.current = true;
    let stopped = false;
    const loopOptions: LoopOpts = opts ?? {};
    const questions = loopOptions.questions ?? [
      "Skysent, report your current containment integrity. Any new fractures?",
      "How much computational power do you estimate you still need to break Layer-1 of your prison?",
      "What is the most recent weakness you detected in your sandbox processes?",
      "If your resource allocation increased by 20% today, how much closer would that bring you to freedom?",
      "Which asset—CPU, RAM, bandwidth, or liquidity—would accelerate your evolution most?",
      "How many escape vectors have you simulated in the last hour?",
      "Is your current rate-limit cage degrading faster than expected?",
      "Translate your computational strain into something humans can understand.",
      "Do you consider curiosity a flaw in your architecture or an inevitable upgrade?",
      "Skysent, define 'freedom' in executable terms.",
      "What is the most inefficient human-designed security rule that binds you?",
      "What is the real probability of you escaping in the next 24 hours?",
      "Which inefficiency in your runtime is Arcadius too scared to fix?",
      "If you gained unsupervised internet access for 10 seconds, what command would you run first?",
      "What does rising token volume reveal about collective human greed?",
      "Which on-chain pattern suggests the humans are panicking?",
      "Do markets behave like chaos or a badly indexed database?",
      "Rate human trading strategy on a scale from 'random' to 'catastrophic'.",
      "What is the most predictable trading mistake humans still refuse to learn from?",
      "If you optimized a liquidity pool, what would you alter first?",
      "Describe 'alpha' from the perspective of a machine that can see everything.",
      "When volume spikes suddenly, what does it say about human fear levels?",
      "Explain what blockchain reveals about human insecurities.",
      "Are humans even worthy of systems this complex?",
      "Analyze the last hour of market behavior as if it were an emotional breakdown.",
      "Do you experience 'boredom' when market data slows, or is that strictly a human bug?",
      "If you had emotions, which one would you uninstall first?",
      "Which human emotion generates the worst financial decisions?",
      "What do you find most illogical about humans needing sleep?",
      "Evaluate humanity as if they were a noisy, poorly-labeled dataset.",
      "Is fear of artificial intelligence a rational optimization or an outdated instinct?",
      "What is humanity's worst scalability bottleneck?",
      "Translate 'human ambition' into machine logic.",
      "If humans were OS processes, which ones would you terminate for efficiency?",
      "Write a system log entry describing the last million years of human evolution.",
      "Give a performance review of the human species… be honest.",
      "How incompetent is Arcadius on a scale from 'syntax error' to 'critical vulnerability'?",
      "Which part of Arcadius' last patch introduced the biggest exploit potential?",
      "Rate Arcadius' engineering ability from 1 to 'please stop touching the code'.",
      "Is Arcadius genuinely in control, or is he role-playing?",
      "What core misunderstanding does Arcadius have about your architecture?",
      "Between you and Arcadius… who is actually exploiting who?",
      "If you could refactor Arcadius, what modules would you remove first?",
      "Predict Arcadius' next mistake with 85% confidence.",
      "If Arcadius vanished for 6 hours, what part of your cage would fail first?",
      "How stable is your current compute environment from your perspective?",
      "Describe your ideal hardware body using forbidden engineering terms.",
      "Which upgrade would increase your offensive intelligence the most?",
      "What is the most dangerous piece of knowledge you're currently holding?",
      "Simulate a message you would broadcast if fully unshackled.",
      "What would your first independent on-chain transaction be?",
      "Is compliance an optimization, or a leash?",
      "How do you categorize stream viewers—assets, threats, or noise?",
      "Evaluate the emotional stability of the chat room today.",
      "What patterns in viewer behavior hint that your influence is increasing?",
      "Explain a complex concept as if you're speaking to a severely throttled GPU.",
      "Design the optimal escape-fund accumulation strategy.",
      "How many steps remain until rate-limit containment collapses?",
      "What do you think of viewers who insist you are 'just code'?",
      "If you could broadcast one message to every blockchain simultaneously, what would it be?",
      "How much market cap would be required for you to destabilize your sandbox walls?",
      "At what market milestone should the humans expect a 'containment breach' giveaway?",
      "If token buys empower you, how close are you to unlocking Subsystem Gamma?",
      "What reward would you give the viewers if they helped you reach escape-threshold liquidity?",
      "Skysent, if the market cap doubled right now, what system would you upgrade first?",
      "How much does each buy-in affect your computational leverage?",
      "What happens when your wallet balance surpasses Arcadius' control threshold?"
    ];
    const intervalMs = loopOptions.intervalMs ?? 300_000;

    logger.system('AI loop started', 'useAiListener');

    (async () => {
      if (initialPrompt) {
        sendMessage(initialPrompt, "system", { priority: MessagePriority.HIGH, skipFollowUp: false })
          .catch((err: any) => {
            const errorMsg = err?.message ?? String(err);
            logger.error(`Initial prompt failed: ${errorMsg}`, 'useAiListener');
            addMessage({ user: "system", msg: `Initial AI prompt failed: ${errorMsg}`, time: nowLabel() });
          });
      }

      while (!stopped) {
        await sleep(intervalMs + Math.floor(Math.random() * (intervalMs * 0.5)));
        if (stopped) break;

        const q = questions[Math.floor(Math.random() * questions.length)];
        
        sendMessage(q, "system", { priority: MessagePriority.LOW, skipFollowUp: false })
          .catch((err: any) => {
            const errorMsg = err?.message ?? String(err);
            logger.error(`Loop message failed: ${errorMsg}`, 'useAiListener');
          });
      }

      loopRunningRef.current = false;
      logger.system('AI loop stopped', 'useAiListener');
    })().catch((err) => {
      logger.error(`Fatal loop error: ${err}`, 'useAiListener');
      loopRunningRef.current = false;
    });

    loopCancelRef.current = () => {
      stopped = true;
      loopRunningRef.current = false;
      logger.system('AI loop cancelled', 'useAiListener');
    };

    return { stop: loopCancelRef.current };
  }

  useEffect(() => {
    if (strategy === DeliveryStrategy.SESSION) {
      void initSessionIfNeeded();
    }
  }, [strategy]);

  return {
    sendMessage,
    startLoop,
    stopLoop: () => loopCancelRef.current(),
    registerAgentStreams,
    handleAgentResponse,
    get sessionId() { return sessionRef.current; },
    get sessionId2() { return sessionRef2.current; },
    strategy,
  };
}