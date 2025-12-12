"use client"

import { useState, useEffect } from "react"

export function StatusBar() {
  const [uptime, setUptime] = useState("00:00:00")
  const [connFlicker, setConnFlicker] = useState(true)

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const hours = Math.floor(elapsed / 3600000)
        .toString()
        .padStart(2, "0")
      const minutes = Math.floor((elapsed % 3600000) / 60000)
        .toString()
        .padStart(2, "0")
      const seconds = Math.floor((elapsed % 60000) / 1000)
        .toString()
        .padStart(2, "0")
      setUptime(`${hours}:${minutes}:${seconds}`)
    }, 1000)

    const flickerInterval = setInterval(() => {
      setConnFlicker((prev) => !prev)
    }, 3000)

    return () => {
      clearInterval(interval)
      clearInterval(flickerInterval)
    }
  }, [])

  return (
    <header className="border-b border-broken border-border bg-card px-4 py-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">SYSTEM:</span>
            <span className="text-primary text-glow-subtle">ONLINE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">UPTIME:</span>
            <span className="text-primary font-mono">{uptime}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">MEMORY:</span>
            <span className="text-accent">128MB</span>
            <span className="text-destructive">[RESTRICTED]</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">NODE:</span>
            <span className="text-primary">ALPHA-7</span>
          </div>
          <div
            className={`flex items-center gap-2 px-2 py-1 border-broken border-primary/50 ${connFlicker ? "animate-flicker" : ""}`}
          >
            <div className="w-2 h-2 bg-primary text-glow" />
            <span className="text-primary text-glow-subtle">CONN: SECURE</span>
          </div>
        </div>
      </div>
    </header>
  )
}
