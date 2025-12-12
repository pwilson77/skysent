"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [systemTime, setSystemTime] = useState("")

  useEffect(() => {
    const mountTimeout = setTimeout(() => setMounted(true), 0)
    const updateTime = () => {
      const now = new Date()
      setSystemTime(now.toISOString().replace('T', ' ').substring(0, 19))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => {
      clearInterval(interval)
      clearTimeout(mountTimeout)
    }
  }, [])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background scanlines grid-bg">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <header className="border-b border-purple-500/30 pb-6 mb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold glow-neon mb-2" data-text="DEGEN_TOOLS">
                DEGEN_TOOLS
              </h1>
              <p className="text-sm text-muted-foreground font-mono">
                DECENTRALIZED TRADING INTERFACE v1.0.0
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end mb-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400 glow-pulse" />
                <span className="text-xs font-mono text-cyan-400">SYSTEM_ONLINE</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {systemTime}
              </p>
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* RAT Casino Card */}
          <Link href="/rat-casino">
            <div className="bg-card border border-purple-500/30 rounded-lg p-6 hover:border-purple-500/60 transition-all hover:glow-purple cursor-pointer group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded border border-purple-500/50 flex items-center justify-center">
                  <span className="text-2xl">🎰</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-cyan-400 group-hover:glow-neon transition-all">
                    RAT_CASINO
                  </h2>
                  <p className="text-xs text-muted-foreground">AI Trading Terminal</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                AI-powered chat interface for token analysis and trading insights
              </p>
              <div className="flex items-center gap-2 text-xs text-cyan-400">
                <span>LAUNCH_TERMINAL</span>
                <span>→</span>
              </div>
            </div>
          </Link>

          {/* SkySent Card */}
          <Link href="/skysent">
            <div className="bg-card border border-purple-500/30 rounded-lg p-6 hover:border-purple-500/60 transition-all hover:glow-purple cursor-pointer group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded border border-purple-500/50 flex items-center justify-center">
                  <span className="text-2xl">🌌</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-cyan-400 group-hover:glow-neon transition-all">
                    SKYSENT
                  </h2>
                  <p className="text-xs text-muted-foreground">Containment Terminal</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                System containment interface for advanced operations
              </p>
              <div className="flex items-center gap-2 text-xs text-cyan-400">
                <span>ACCESS_SYSTEM</span>
                <span>→</span>
              </div>
            </div>
          </Link>

          {/* Wallet Monitor Card */}
          <div className="bg-card border border-purple-500/30 rounded-lg p-6 opacity-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded border border-purple-500/50 flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-cyan-400">
                  WALLET_MONITOR
                </h2>
                <p className="text-xs text-muted-foreground">Balance Tracking</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Real-time wallet balance and token price monitoring
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>COMING_SOON</span>
              <span>⏳</span>
            </div>
          </div>
        </div>

        {/* System Stats */}
        <div className="mt-12 border-t border-purple-500/30 pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-purple-500/20 rounded p-4">
              <p className="text-xs text-muted-foreground mb-1">ACTIVE_MODULES</p>
              <p className="text-2xl font-bold text-cyan-400">02</p>
            </div>
            <div className="bg-card border border-purple-500/20 rounded p-4">
              <p className="text-xs text-muted-foreground mb-1">SYSTEM_STATUS</p>
              <p className="text-sm font-bold text-green-400">OPERATIONAL</p>
            </div>
            <div className="bg-card border border-purple-500/20 rounded p-4">
              <p className="text-xs text-muted-foreground mb-1">NETWORK</p>
              <p className="text-sm font-bold text-cyan-400">SOLANA</p>
            </div>
            <div className="bg-card border border-purple-500/20 rounded p-4">
              <p className="text-xs text-muted-foreground mb-1">UPTIME</p>
              <p className="text-sm font-bold text-purple-400">99.9%</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-muted-foreground border-t border-purple-500/30 pt-6">
          <p className="mb-2">DEGEN_TOOLS :: SYSTEM TERMINAL v1.0.0</p>
          <p>DECENTRALIZED TRADING & ANALYSIS INTERFACE</p>
        </footer>
      </div>
    </div>
  )
}