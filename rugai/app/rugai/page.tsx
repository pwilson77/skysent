"use client"

import { AnimatedFace } from "@/components/animated-face"
import { TradingMetrics } from "@/components/trading-metrics"
import { ChatStream } from "@/components/chat-stream"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground overflow-hidden">
      {/* Scan line effect */}
      <div className="scan-line absolute inset-0 z-10 pointer-events-none" />

      <div className="relative z-20 h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-purple-500/20 bg-slate-900/40 backdrop-blur-sm px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold glow-neon text-cyan-300">⟨ rugai.sys ⟩</h1>
              <p className="text-xs text-purple-400/60 font-mono mt-1">AUTONOMOUS_TRADING_PROTOCOL v2.1</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-cyan-300/80 font-mono">STATUS: ACTIVE</p>
              <p className="text-xs text-green-400 font-mono">► STREAMING LIVE</p>
            </div>
          </div>
        </header>

        {/* Main content grid */}
        <div className="flex-1 flex flex-col gap-6 p-6 overflow-hidden">
          <div className="flex-1 bg-slate-900/60 border border-purple-500/30 rounded-lg flex flex-col glow-cyan overflow-hidden">
            <ChatStream />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 overflow-hidden">
            {/* Left: Avatar */}
            <div className="md:col-span-1 flex flex-col items-center justify-start">
              <AnimatedFace />
            </div>

            {/* Right: Trading metrics */}
            <div className="md:col-span-3 overflow-y-auto">
              <TradingMetrics />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
