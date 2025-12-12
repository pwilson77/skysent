"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAiListener } from "@/hooks/useAiListener";
import { useSolanaTrackerApi } from "@/hooks/useSolanaTrackerApi";
import { usePumpChat } from "@/hooks/usePumpChat";
import { useElizaStream } from "@/hooks/useElizaStream";

export function ChatStream() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);

  // get both startLoop and sendMessage from the hook
  const { startLoop, sendMessage } = useAiListener();
  const walletAddress = process.env.NEXT_PUBLIC_WALLET_ADDRESS || "";
  const tokenMint = process.env.NEXT_PUBLIC_TOKEN_MINT || "";
  const pumpChat = usePumpChat({
    roomId: tokenMint,
    username: "C3GZSW",
    processIntervalMs: 60_000, // 60 seconds
    messageHistoryLimit: 100,
    onFlush: (messages) => {
      // Optional: do something with messages after AI processing
      console.log(`Processed ${messages.length} pump chat messages`);
    },
  });
  const { reportWalletAndTokenToSkysent } = useSolanaTrackerApi(walletAddress, tokenMint);

  // Report wallet balance to Skysent every 10 minutes
  // useEffect(() => {
  //   if (!walletAddress || !tokenMint || typeof reportWalletAndTokenToSkysent !== "function") return;

  //   let mounted = true;

  //   async function reportBalance() {
  //     if (!mounted) return;

  //     try {
  //       addMessage({
  //         user: "system",
  //         msg: `Reporting wallet balance to Skysent...`,
  //         time: Date.now()
  //       });

  //       await reportWalletAndTokenToSkysent();
  //     } catch (err: any) {
  //       if (!mounted) return;
  //       console.error("[ChatStream] Balance report error:", err);
  //       addMessage({
  //         user: "system",
  //         msg: `Balance report failed: ${String(err?.message ?? err)}`, 
  //         time: Date.now()
  //       });
  //     }
  //   }

  //   // Run immediately on mount
  //   void reportBalance();

  //   // Then every 10 minutes (600,000ms)
  //   const intervalId = setInterval(() => {
  //     void reportBalance();
  //   }, 600_000);

  //   return () => {
  //     mounted = false;
  //     clearInterval(intervalId);
  //   };
  // }, [walletAddress, tokenMint, reportWalletAndTokenToSkysent, addMessage]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // Check status
  console.log("Connected:", pumpChat.isConnected());
  console.log("Buffered messages:", pumpChat.getMessageCount());

  return (
    <div className="flex flex-col h-full">
      <h4 className="text-sm font-mono text-cyan-300 mb-3 px-4 pt-4 glow-neon">STREAM_CHAT</h4>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 px-4 scrollbar-hide">
        {messages.map((msg, idx) => (
          <div key={idx} className="flex gap-2 text-xs font-mono group hover:bg-purple-900/20 py-1 px-2 rounded transition-colors">
            <span className="text-purple-400 flex-shrink-0 w-24">{msg.user}</span>
            <span className="text-cyan-300/90 flex-1 break-words">{msg.msg}</span>
            <span className="text-purple-500/50 flex-shrink-0">{msg.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}