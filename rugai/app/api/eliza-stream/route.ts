import { NextRequest } from 'next/server';
import { io, Socket } from 'socket.io-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Updated protocol types
const ROOM_JOINING = 1;
const SEND_MESSAGE = 2;

type RoomJoinPayload = {
  roomId: string;
  entityId: string;
};

type SendMessagePayload = {
  senderId: string;
  senderName: string;
  message: string;
  channelId: string;
  messageId: string;
  source: string;
  attachments: any[];
  metadata: Record<string, any>;
  serverId: string;
};

type OutgoingEnvelope =
  | { type: typeof ROOM_JOINING; payload: RoomJoinPayload }
  | { type: typeof SEND_MESSAGE; payload: SendMessagePayload };

interface MessageBroadcast {
  senderId: string;
  senderName: string;
  text: string;
  roomId?: string;
  channelId?: string;
  serverId?: string;
  createdAt: number;
  source?: string;
  id?: string;
  thought?: string;
  actions?: string[];
  attachments?: any[];
}

interface MessageComplete {
  channelId: string;
  serverId: string;
}

interface LogEntry {
  level: number;
  time: number;
  msg: string;
  agentId: string;
  agentName: string;
}

interface ErrorEvent {
  error: string;
  details?: any;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roomId = searchParams.get('roomId');
  const agentId = searchParams.get('agentId'); // still used by your client, but not part of the new join payload
  const entityId = searchParams.get('entityId') || searchParams.get('userId') || 'anonymous';
  const name = searchParams.get('name') || 'User';

  if (!roomId || !entityId) {
    return new Response(
      JSON.stringify({ error: 'roomId and entityId are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const elizaServerUrl = process.env.ELIZA_SERVER_URL || 'http://localhost:3000';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let socket: Socket | null = null;
      let isConnected = false;

      const sendSSE = (event: string, data: any) => {
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          console.error('[eliza-stream] SSE send error:', err);
        }
      };

      try {
        socket = io(elizaServerUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
        });

        socket.on('connect', () => {
          isConnected = true;

          // Join the room using the new envelope format
          const joinEnvelope: OutgoingEnvelope = {
            type: ROOM_JOINING,
            payload: { roomId, entityId },
          };
          socket!.emit('message', joinEnvelope);
          sendSSE('connected', { status: 'connected', roomId, entityId, name });

          // Optional: server may emit a connection_established event
        });

        socket.on('disconnect', (reason: string) => {
          isConnected = false;
          sendSSE('disconnected', { reason });
        });

        socket.on('connect_error', (error: Error) => {
          console.error('[eliza-stream] connect_error:', error);
          sendSSE('error', { error: error.message, type: 'connection' });
        });

        // Updated broadcast listener
        socket.on('messageBroadcast', (data: MessageBroadcast) => {
          try {
            const targetId = data.roomId || data.channelId;
            if (targetId !== roomId) return;

            sendSSE('message', {
              type: 'message',
              senderId: data.senderId,
              senderName: data.senderName,
              text: data.text,
              roomId: targetId,
              thought: data.thought,
              actions: data.actions,
              timestamp: data.createdAt,
            });
          } catch (err) {
            console.error('[eliza-stream] messageBroadcast handling error:', err);
          }
        });

        socket.on('messageComplete', (data: MessageComplete) => {
          sendSSE('complete', {
            type: 'complete',
            channelId: data.channelId,
            serverId: data.serverId,
          });
        });

        // Reduce logs to errors only; ignore normal log entries unless level >= 50
        socket.on('logEntry', (data: LogEntry) => {
          if (data.level >= 50) {
            sendSSE('log', {
              type: 'log',
              level: data.level,
              message: data.msg,
              agentId: data.agentId,
              agentName: data.agentName,
              timestamp: data.time,
            });
          }
        });

        socket.on('error', (data: ErrorEvent) => {
          console.error('[eliza-stream] server error:', data);
          sendSSE('error', {
            type: 'error',
            error: data.error,
            details: data.details,
          });
        });

        const keepAliveInterval = setInterval(() => {
          if (isConnected) {
            sendSSE('ping', { timestamp: Date.now() });
          }
        }, 30000);

        request.signal.addEventListener('abort', () => {
          clearInterval(keepAliveInterval);
          if (socket) {
            socket.emit('message', {
              type: ROOM_JOINING, // no explicit leave in new format; if server supports leave you can use it
              payload: { roomId, entityId },
            } as OutgoingEnvelope);
            socket.disconnect();
          }
          controller.close();
        });
      } catch (err) {
        console.error('[eliza-stream] initialization error:', err);
        sendSSE('error', { error: String(err), type: 'initialization' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, roomId, userId, name, entityId } = body;

    if (!text || !roomId || !(entityId || userId)) {
      return new Response(
        JSON.stringify({ error: 'text, roomId and entityId (or userId) are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const elizaServerUrl = process.env.ELIZA_SERVER_URL || 'http://localhost:3000';
    const senderId = entityId || userId;

    const socket = io(elizaServerUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Connection timeout'));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);

        const envelope: OutgoingEnvelope = {
          type: SEND_MESSAGE,
          payload: {
            senderId,
            senderName: name || 'Extension User',
            serverId: "00000000-0000-0000-0000-000000000000",
            message: text,
            channelId: roomId,
            messageId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            source: 'extension',
            attachments: [],
            metadata: {},
          },
        };

        socket.emit('message', envelope);

        // Give a short delay to flush the emit, then disconnect
        setTimeout(() => {
          socket.disconnect();
          resolve();
        }, 400);
      });

      socket.on('connect_error', (error: Error) => {
        clearTimeout(timeout);
        socket.disconnect();
        reject(error);
      });

      socket.on('error', (err: any) => {
        clearTimeout(timeout);
        socket.disconnect();
        reject(new Error(typeof err === 'string' ? err : JSON.stringify(err)));
      });
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Message sent' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[eliza-stream] POST error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}