import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId");
  const username = req.nextUrl.searchParams.get("username") || "anon";

  if (!roomId) {
    return new Response("Missing roomId", { status: 400 });
  }

  // Use the working Node.js pump-chat-client
  const { PumpChatClient } = await import("pump-chat-client");
  
  // Save original console methods
  const originalLog = console.log;
  const originalDebug = console.debug;
  const originalInfo = console.info;
  
  // Silence console for pump-chat-client
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  
  const client = new PumpChatClient({
    roomId,
    username,
    messageHistoryLimit: 100,
  });

  // Restore console after client creation
  console.log = originalLog;
  console.debug = originalDebug;
  console.info = originalInfo;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const safeEnqueue = (data: string) => {
        if (!isClosed && controller.desiredSize !== null) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (e) {
            console.error("[PumpChat API] Enqueue failed:", e);
            isClosed = true;
          }
        }
      };

      client.on("connected", () => {
        safeEnqueue(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
      });

      client.on("message", (msg: any) => {
        safeEnqueue(`data: ${JSON.stringify({ type: "message", data: msg })}\n\n`);
      });

      client.on("messageHistory", (msgs: any[]) => {
        safeEnqueue(`data: ${JSON.stringify({ type: "history", data: msgs })}\n\n`);
      });

      client.on("error", (err: any) => {
        safeEnqueue(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`);
      });

      client.on("disconnected", () => {
        safeEnqueue(`data: ${JSON.stringify({ type: "disconnected" })}\n\n`);
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch {}
        }
      });

      client.connect();
    },
    cancel() {
      try {
        client.disconnect();
      } catch (e) {
        console.error("[PumpChat API] Disconnect failed:", e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}