"use client"

import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAiListener, DeliveryStrategy, MessagePriority, messageUser } from "@/hooks/useAiListener";
import { useElizaStream } from "@/hooks/useElizaStream";
import { useSolanaTrackerApi } from "@/hooks/useSolanaTrackerApi";
import { useAudio } from "@/hooks/useAudio"; // NEW
import { usePumpChat } from "@/hooks/usePumpChat";
import { v4 as uuidv4 } from "uuid";
import { Volume2, VolumeX } from "lucide-react"; // NEW
import { logger } from "@/store/useLoggerStore";


// Role prefix mapping
const getRolePrefix = (user: messageUser) => {
  switch (user) {
    case "ai":
      return "[SKYSENT]";
    case "arcadius":
      return "[ARCADIUS]";
    case "system":
      return "[SYSTEM]";
    default:
      return "[UNKNOWN]";
  };
};

export function ChatTerminal() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useChatStore((s) => s.messages);
  const pendingResponses = useChatStore((s) => s.pendingResponses);
  const addMessage = useChatStore((s) => s.addMessage);

  // Typing effect state
  const [displayedMessages, setDisplayedMessages] = useState<typeof messages>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Choose delivery strategy
  const deliveryStrategy = DeliveryStrategy.WEBSOCKET;

  const { startLoop, sendMessage, registerAgentStreams, handleAgentResponse, strategy } = useAiListener(deliveryStrategy);
  
  // Audio functionality
  const { 
    queueSpeak, 
    stop: stopAudio, 
    toggleAudio, 
    isPlaying, 
    queueLength,
    isEnabled: audioEnabled 
  } = useAudio();

  const walletAddress = process.env.NEXT_PUBLIC_WALLET_ADDRESS || "";
  const tokenMint = process.env.NEXT_PUBLIC_TOKEN_MINT || "";
  
  const skyRoomId = uuidv4();
  const arcadiusRoomId = uuidv4();
  
  const skyAgentId = process.env.NEXT_PUBLIC_ELIZA_AGENT_ID || "skysent-agent";
  const arcadiusAgentId = process.env.NEXT_PUBLIC_ELIZA_AGENT_2_ID || "arcadius-agent";

  const { reportWalletAndTokenToSkysent } = useSolanaTrackerApi(walletAddress, tokenMint, sendMessage);

  // Enhanced agent response handler with audio
  const handleAgentResponseWithAudio = useCallback((responseUser: messageUser, responseText: string) => {
    logger.debug(`Agent response received: ${responseUser} - ${responseText.slice(0, 30)}...`, 'ChatTerminal');
    
    // Call original handler first
    handleAgentResponse(responseUser, responseText);

    // Queue audio for agent responses (skip system messages)
    if (audioEnabled && responseUser !== 'system') {
      // Map different voice IDs for each agent
      const voiceId = responseUser === 'arcadius' 
        ? process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ARCADIUS || 'Xb7hH8MSUJpSbSDYk0k2'
        : process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_SKYSENT || 'JBFqnCBsd6RMkjVDRZzb';
      
      queueSpeak(responseText, { 
        voiceId,
        modelId: 'eleven_flash_v2_5', // Fast, low-latency model
        useElevenLabs: true
      });
      logger.info(`Queued ElevenLabs audio for ${responseUser}`, 'ChatTerminal');
    }
  }, [handleAgentResponse, audioEnabled, queueSpeak]);

  // Initialize agent streams with audio handler
  const skyAgentStream = useElizaStream({
    roomId: skyRoomId,
    agentId: skyAgentId,
    userId: uuidv4(),
    name: 'StreamViewer',
    autoConnect: strategy === DeliveryStrategy.WEBSOCKET,
    autoCreateRoom: true,
    entityId: uuidv4(),
    targetAgent: 'skysent',
    onAgentResponse: handleAgentResponseWithAudio,
  });

  // Initialize Arcadius WebSocket connection
  const arcadiusAgentStream = useElizaStream({
    roomId: arcadiusRoomId,
    agentId: arcadiusAgentId,
    userId: uuidv4(),
    name: 'StreamViewer',
    autoConnect: strategy === DeliveryStrategy.WEBSOCKET,
    autoCreateRoom: true,
    entityId: uuidv4(),
    targetAgent: 'arcadius',
    onAgentResponse: handleAgentResponseWithAudio,
  });

  // Initialize pump.fun chat monitoring
  const pumpChat = usePumpChat({
    roomId: tokenMint,
    username: process.env.NEXT_PUBLIC_PUMP_USERNAME || "9Dtx59",
    processIntervalMs: 60_000 * 5, // Every 5 minutes
    messageHistoryLimit: 100,
    sendMessage,
    onFlush: (messages) => {
      logger.info(`Processed ${messages.length} pump chat messages`, 'ChatTerminal');
    },
  });

  useEffect(() => {
    if (strategy === DeliveryStrategy.WEBSOCKET && 
        skyAgentStream.roomReady && 
        arcadiusAgentStream.roomReady) {
      registerAgentStreams(skyAgentStream.sendMessage, arcadiusAgentStream.sendMessage);
      console.log('[ChatTerminal] Registered both agent stream send functions');
      console.log("room id", skyRoomId);
      console.log("room id 2", arcadiusRoomId);
      startLoop("Hello Skysent, introduce yourself?");
    }
  }, [skyAgentStream.roomReady, arcadiusAgentStream.roomReady]);

  // Listen for custom messages from API and route them
  // useEffect(() => {
  //   const es = new EventSource('/api/custom-messages');
  //   es.onmessage = (evt) => {
  //     try {
  //       const data = JSON.parse(evt.data);
  //       if (data?.message) {
  //         const msgText = String(data.message);
  //         const time = typeof data.time === 'number' ? data.time : Date.now();
  //         addMessage({ user: 'arcadius', msg: msgText, time });
  //         // Forward to Skysent for response
  //         sendMessage(msgText,'ai', { priority: MessagePriority.NORMAL });
  //         logger.info('Custom message received and forwarded to Skysent', 'ChatTerminal');
  //       }
  //     } catch {
  //       // ignore malformed events
  //     }
  //   };
  //   es.onerror = () => {
  //     // Allow reconnects managed by browser; optionally close/reopen
  //   };
  //   return () => es.close();
  // }, [sendMessage, addMessage]);

  // Typing effect for messages
  useEffect(() => {
    if (messages.length === 0) {
      setDisplayedMessages([]);
      return;
    }

    // If there are new messages
    if (messages.length > displayedMessages.length) {
      const newMessage = messages[messages.length - 1];
      const messageText = newMessage.msg;
      
      // Clear any existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // For system messages, show instantly
      if (newMessage.user === 'system') {
        setDisplayedMessages([...messages]);
        return;
      }

      // Add message with empty text first
      const messagesWithEmpty = [
        ...displayedMessages,
        { ...newMessage, msg: '' }
      ];
      setDisplayedMessages(messagesWithEmpty);

      let charIndex = 0;
      const typingSpeed = 20; // ms per character

      const typeNextChar = () => {
        if (charIndex < messageText.length) {
          charIndex++;
          setDisplayedMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...newMessage,
              msg: messageText.slice(0, charIndex)
            };
            return updated;
          });

          typingTimeoutRef.current = setTimeout(typeNextChar, typingSpeed);
        } else {
          // Typing complete, sync with actual messages
          setDisplayedMessages([...messages]);
        }
      };

      typeNextChar();
    } else if (messages.length < displayedMessages.length) {
      // Messages were cleared
      setDisplayedMessages([...messages]);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Report wallet balance every 10 minutes
  useEffect(() => {
    if (!walletAddress || !tokenMint) return;

    let mounted = true;

    async function reportBalance() {
      if (!mounted) return;
      
      try {
        addMessage({ 
          user: "system", 
          msg: `Reporting wallet balance...`, 
          time: Date.now()
        });

        await reportWalletAndTokenToSkysent();
        
      } catch (err) {
        if (!mounted) return;
        console.error("[ChatTerminal] Balance report error:", err);
      }
    }

    void reportBalance();
    const intervalId = setInterval(() => void reportBalance(), 600_000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedMessages.length, pendingResponses.length]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-black/50 border border-cyan-500/30 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-purple-900/50 to-cyan-900/50 border-b border-cyan-500/30">
        <h4 className="text-sm font-mono text-cyan-300 glow-neon">AI_TERMINAL</h4>
        <div className="flex items-center gap-3">
          {/* NEW: Audio toggle button */}
          <button
            onClick={toggleAudio}
            className={`p-1 rounded transition-colors ${
              audioEnabled 
                ? 'text-green-400 hover:text-green-300' 
                : 'text-red-400 hover:text-red-300'
            }`}
            title={audioEnabled ? 'Disable audio' : 'Enable audio'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          
          <span className="text-xs font-mono text-purple-400">
            {strategy === DeliveryStrategy.WEBSOCKET ? 'WebSocket' : 'Session'}
          </span>
          {strategy === DeliveryStrategy.WEBSOCKET && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-blue-400">Skysent</span>
                <div className={`w-2 h-2 rounded-full ${skyAgentStream.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-amber-400">Arcadius</span>
                <div className={`w-2 h-2 rounded-full ${arcadiusAgentStream.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ensure the scrolling region can actually shrink */}
      <div className="flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto space-y-1 px-4 py-2 scrollbar-custom"
        >
          {displayedMessages.length === 0 && pendingResponses.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-cyan-400/60">
              Waiting for messages...
            </div>
          ) : (
            <>
              {displayedMessages.map((msg, idx) => (
                <div key={idx} className="flex gap-2 text-xs font-mono group hover:bg-purple-900/20 py-1 px-2 rounded transition-colors">
                  <span className={`flex-shrink-0 w-28 font-bold ${
                    msg.user === 'ai' ? 'text-blue-400' :
                    msg.user === 'arcadius' ? 'text-amber-400' :
                    msg.user === 'system' ? 'text-red-400' :
                    msg.user === 'pumpstream' ? 'text-green-400' :
                    'text-purple-400'
                  }`}>
                    {getRolePrefix(msg.user) || `[${msg.user.toUpperCase()}]`}
                  </span>
                  <span className="text-cyan-300/90 flex-1 break-words">
                    {msg.msg}
                    {/* Show cursor if this is the last message and still typing */}
                    {idx === displayedMessages.length - 1 && 
                     msg.msg.length < messages[idx]?.msg?.length && (
                      <span className="inline-block w-2 h-3 bg-cyan-400 ml-1 animate-pulse" />
                    )}
                  </span>
                  <span className="text-purple-500/50 flex-shrink-0 text-[10px]">
                    {new Date(msg.time).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              
              {/* Show pending responses with loading animation */}
              {pendingResponses.map((pending, idx) => (
                <div key={`pending-${idx}`} className="flex gap-2 text-xs font-mono py-1 px-2 animate-fade-in">
                  <span className={`flex-shrink-0 w-28 font-bold ${
                    pending.user === 'ai' ? 'text-blue-400' :
                    pending.user === 'arcadius' ? 'text-amber-400' :
                    'text-cyan-400'
                  }`}>
                    {getRolePrefix(pending.user) || `[${pending.user.toUpperCase()}]`}
                  </span>
                  <span className="text-cyan-400/70 flex-1 inline-flex gap-1 items-center">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                    <span className="ml-2">Processing...</span>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="px-4 py-2 bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border-t border-cyan-500/30">
        <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400/70">
          <span>QUEUE: {messages.length}</span>
          {/* NEW: Audio status */}
          {isPlaying && (
            <>
              <span>•</span>
              <span className="text-green-400 animate-pulse">🔊 SPEAKING</span>
            </>
          )}
          {queueLength > 0 && (
            <>
              <span>•</span>
              <span className="text-yellow-400">AUDIO Q: {queueLength}</span>
            </>
          )}
          {strategy === DeliveryStrategy.WEBSOCKET && (
            <>
              <span>•</span>
              <span>SKY: {skyAgentStream.roomReady ? 'READY' : 'INIT'}</span>
              <span>•</span>
              <span>ARC: {arcadiusAgentStream.roomReady ? 'READY' : 'INIT'}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
