import { NextRequest } from 'next/server';

// Simple in-memory SSE subscribers list (per server process)
type Subscriber = (data: string) => void;
const subscribers: Set<Subscriber> = (globalThis as any).__customMsgSubs || new Set<Subscriber>();
(globalThis as any).__customMsgSubs = subscribers;

function broadcast(message: string) {
  const payload = JSON.stringify({ message, time: Date.now() });
  for (const cb of subscribers) {
    try { cb(`data: ${payload}\n\n`); } catch {}
  }
}

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => controller.enqueue(new TextEncoder().encode(data));
      subscribers.add(send);
      // Initial ping to open the stream
      send(`data: ${JSON.stringify({ ping: true, time: Date.now() })}\n\n`);
    },
    cancel() {
      // On client disconnect, nothing to do; controller closes stream
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = body?.message ?? '';
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid message' }), { status: 400 });
    }

    broadcast(message);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
  }
}
