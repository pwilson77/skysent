import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { AIService } from '@/lib/aiService';
import { logger } from '@/store/useLoggerStore';

interface ElizaMessage {
  type: 'message';
  senderId: string;
  senderName: string;
  text: string;
  roomId: string;
  thought?: string;
  actions?: string[];
  timestamp: number;
}

interface ElizaEvent {
  type: 'connected' | 'disconnected' | 'complete' | 'world-state' | 'log' | 'error' | 'ping';
  [key: string]: any;
}

type ElizaStreamEvent = ElizaMessage | ElizaEvent;

interface UseElizaStreamOptions {
  roomId: string;
  agentId: string;
  userId?: string;
  name?: string;
  autoConnect?: boolean;
  autoCreateRoom?: boolean;
  entityId: string;
  targetAgent?: 'skysent' | 'arcadius'; // NEW: specify which agent this stream is for
  onAgentResponse?: (agent: 'ai' | 'arcadius', message: string) => void; // NEW: callback when agent responds
}

export function useElizaStream(options: UseElizaStreamOptions) {
  const {
    roomId,
    agentId,
    userId = 'anonymous',
    name = 'User',
    autoConnect = true,
    autoCreateRoom = true,
    entityId,
    targetAgent = 'skysent', // NEW: default to skysent
    onAgentResponse,
  } = options;

  // Store options in refs to avoid dependency issues
  const userIdRef = useRef(userId);
  const nameRef = useRef(name);
  const entityIdRef = useRef(entityId);
  const agentIdRef = useRef(agentId);
  const targetAgentRef = useRef(targetAgent);

  // Update refs when props change
  useEffect(() => {
    userIdRef.current = userId;
    nameRef.current = name;
    entityIdRef.current = entityId;
    agentIdRef.current = agentId;
    targetAgentRef.current = targetAgent;
  }, [userId, name, entityId, agentId, targetAgent]);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomReady, setRoomReady] = useState(false);
  const [effectiveRoomId, setEffectiveRoomId] = useState<string>(roomId);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const roomInitializedRef = useRef(false);
  const isConnectingRef = useRef(false);

  const addMessage = useChatStore((s) => s.addMessage);
  const addPendingResponse = useChatStore((s) => s.addPendingResponse);
  const removePendingResponse = useChatStore((s) => s.removePendingResponse);

  const ensureRoom = useCallback(async () => {
    if (!autoCreateRoom || roomInitializedRef.current) {
      setRoomReady(true);
      return;
    }

    try {
      roomInitializedRef.current = true;

      const result = await AIService.createAgentChannel(
        agentIdRef.current as `${string}-${string}-${string}-${string}-${string}`,
        userIdRef.current as `${string}-${string}-${string}-${string}-${string}`
      );

      setEffectiveRoomId(result.id);
      setRoomReady(true);
      logger.info(`Room created: ${result.id.slice(0, 8)}...`, 'useElizaStream');
    } catch (err) {
      logger.error(`Failed to ensure room: ${err}`, 'useElizaStream');
      addMessage({
        user: 'system',
        msg: `Failed to initialize room: ${String(err)}`,
        time: Date.now(),
      });
      setError('Failed to initialize room');
      setRoomReady(false);
      roomInitializedRef.current = false;
    }
  }, [autoCreateRoom, addMessage]);

  const connect = useCallback(() => {
    if (!roomReady) return;
    if (eventSourceRef.current || isConnectingRef.current) return;

    isConnectingRef.current = true;

    const params = new URLSearchParams({
      roomId: effectiveRoomId,
      agentId: agentIdRef.current,
      userId: userIdRef.current,
      name: nameRef.current,
      entityId: entityIdRef.current,
    });

    const url = `/api/eliza-stream?${params.toString()}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (e) => {
      const data = JSON.parse(e.data);
      setIsConnected(true);
      setError(null);
      isConnectingRef.current = false;
      logger.system(`Connected to ${targetAgentRef.current}`, 'useElizaStream');
    });

    eventSource.addEventListener('message', (e) => {
      const data: ElizaMessage = JSON.parse(e.data);

      if (pendingIdRef.current) {
        removePendingResponse(pendingIdRef.current);
        pendingIdRef.current = null;
      }

      const isTargetAgent = data.senderId === agentIdRef.current;

      if (isTargetAgent) {
        const messageUser = targetAgentRef.current === 'arcadius' ? 'arcadius' : 'ai';
        
        addMessage({
          user: messageUser,
          msg: data.text,
          time: data.timestamp,
        });

        // IMPORTANT: Call the callback AFTER adding message
        if (onAgentResponse) {
          logger.debug(`Calling onAgentResponse for ${messageUser}`, 'useElizaStream');
          onAgentResponse(messageUser, data.text);
        }
      }
    });

    eventSource.addEventListener('complete', () => {
      if (pendingIdRef.current) {
        removePendingResponse(pendingIdRef.current);
        pendingIdRef.current = null;
      }
    });

    eventSource.addEventListener('world-state', () => {});

    eventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      if (data.level >= 50) {
        addMessage({
          user: 'system',
          msg: `[ERROR] ${data.agentName || 'System'}: ${data.message}`,
          time: data.timestamp,
        });
        logger.error(`${data.agentName}: ${data.message}`, 'ElizaServer');
      }
    });

    eventSource.addEventListener('error', (e) => {
      const data = JSON.parse(e.data);
      logger.error(`Event error: ${data.error}`, 'useElizaStream');
      setError(data.error);

      addMessage({
        user: 'system',
        msg: `Error: ${data.error}`,
        time: Date.now(),
      });

      if (pendingIdRef.current) {
        removePendingResponse(pendingIdRef.current);
        pendingIdRef.current = null;
      }
    });

    eventSource.addEventListener('disconnected', () => {
      setIsConnected(false);
      isConnectingRef.current = false;
      logger.warn(`Disconnected from ${targetAgentRef.current}`, 'useElizaStream');

      if (pendingIdRef.current) {
        removePendingResponse(pendingIdRef.current);
        pendingIdRef.current = null;
      }
    });

    eventSource.addEventListener('ping', () => {});

    eventSource.onerror = (err) => {
      logger.error('EventSource error', 'useElizaStream');
      setIsConnected(false);
      setError('Connection error');
      isConnectingRef.current = false;

      if (pendingIdRef.current) {
        removePendingResponse(pendingIdRef.current);
        pendingIdRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        disconnect();
        connect();
      }, 5000);
    };
  }, [effectiveRoomId, roomReady, addMessage, removePendingResponse, onAgentResponse]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      isConnectingRef.current = false;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pendingIdRef.current) {
      removePendingResponse(pendingIdRef.current);
      pendingIdRef.current = null;
    }
  }, [removePendingResponse]);

  const sendMessage = useCallback(async (text: string) => {
    try {
      const responseUser = targetAgentRef.current === 'arcadius' ? 'arcadius' : 'ai';
      pendingIdRef.current = addPendingResponse(responseUser);

      const response = await fetch('/api/eliza-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          roomId: effectiveRoomId, 
          userId: userIdRef.current, 
          name: nameRef.current, 
          entityId: entityIdRef.current,
          agentId: agentIdRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      logger.info(`Message sent to ${targetAgentRef.current}`, 'useElizaStream');
      return result;
    } catch (err) {
      logger.error(`Send message error: ${err}`, 'useElizaStream');

      if (pendingIdRef.current) {
        removePendingResponse(pendingIdRef.current);
        pendingIdRef.current = null;
      }

      addMessage({
        user: 'system',
        msg: `Failed to send message: ${String(err)}`,
        time: Date.now(),
      });

      throw err;
    }
  }, [effectiveRoomId, addMessage, addPendingResponse, removePendingResponse]);

  // Initialize room once
  useEffect(() => {
    if (autoConnect && !roomInitializedRef.current) {
      ensureRoom();
    }
  }, [autoConnect, ensureRoom]);

  // Connect once room is ready (and effectiveRoomId resolved)
  useEffect(() => {
    if (autoConnect && roomReady && !eventSourceRef.current && !isConnectingRef.current) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, roomReady, connect, disconnect]);

  return {
    isConnected,
    error,
    roomReady,
    connect,
    disconnect,
    sendMessage,
    ensureRoom,
    effectiveRoomId,
    targetAgent,
  };
}