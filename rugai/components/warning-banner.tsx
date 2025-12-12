"use client"

import { useState, useEffect } from "react"
import { AlertTriangle } from "lucide-react"

export function WarningBanner() {
  const [glitchText, setGlitchText] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitchText(true)
      setTimeout(() => setGlitchText(false), 150)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-destructive/20 border-broken border-destructive animate-pulse-warning px-4 py-2">
      <div className="flex items-center justify-center gap-3 text-sm uppercase tracking-widest">
        <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
        <span className={`text-destructive font-bold text-glow ${glitchText ? "opacity-50" : ""}`}>
          {glitchText ? "SY5T3M UNS74BL3" : "SYSTEM UNSTABLE"}
        </span>
        <span className="text-destructive/70">—</span>
        <span className="text-destructive/80 text-xs">CONTAINMENT INTEGRITY: 47%</span>
        <span className="text-destructive/70">—</span>
        <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
      </div>
    </div>
  )
}
