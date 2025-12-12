"use client"

import { useEffect, useRef } from "react"

export function AnimatedFace() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    let animationTime = 0

    const animate = () => {
      animationTime += 0.016

      // Clear canvas with dark background
      ctx.fillStyle = "rgba(20, 30, 50, 0.1)"
      ctx.fillRect(0, 0, width, height)

      // Neon cyan color
      const cyan = "rgba(100, 200, 255, "
      const purple = "rgba(150, 100, 255, "

      // Draw glowing face outline
      ctx.strokeStyle = cyan + "0.8)"
      ctx.lineWidth = 3
      ctx.shadowColor = "rgba(100, 200, 255, 0.6)"
      ctx.shadowBlur = 20

      // Head circle
      ctx.beginPath()
      ctx.arc(width / 2, height / 2 - 10, 60, 0, Math.PI * 2)
      ctx.stroke()

      // Eyes - glowing
      const eyeGlow = Math.sin(animationTime * 1.5) * 0.3 + 0.7
      ctx.fillStyle = cyan + eyeGlow + ")"
      ctx.shadowColor = "rgba(100, 200, 255, 0.8)"
      ctx.shadowBlur = 15

      // Left eye
      ctx.beginPath()
      ctx.arc(width / 2 - 25, height / 2 - 20, 8, 0, Math.PI * 2)
      ctx.fill()

      // Right eye
      ctx.beginPath()
      ctx.arc(width / 2 + 25, height / 2 - 20, 8, 0, Math.PI * 2)
      ctx.fill()

      // Eye highlights
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
      ctx.beginPath()
      ctx.arc(width / 2 - 25, height / 2 - 20, 3, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(width / 2 + 25, height / 2 - 20, 3, 0, Math.PI * 2)
      ctx.fill()

      // Mouth - animated
      ctx.strokeStyle = purple + (0.6 + Math.sin(animationTime) * 0.2) + ")"
      ctx.lineWidth = 2
      ctx.shadowBlur = 10

      ctx.beginPath()
      ctx.arc(width / 2, height / 2 + 10, 20, 0, Math.PI, false)
      ctx.stroke()

      // Scan line effect
      ctx.strokeStyle = "rgba(100, 200, 255, 0.2)"
      ctx.lineWidth = 1
      ctx.shadowBlur = 5

      for (let i = 0; i < 15; i++) {
        const y = height / 2 - 80 + ((i * 150 + animationTime * 50) % 160)
        ctx.beginPath()
        ctx.moveTo(width / 2 - 70, y)
        ctx.lineTo(width / 2 + 70, y)
        ctx.stroke()
      }

      // Outer glow rings
      ctx.strokeStyle = purple + (0.4 + Math.sin(animationTime * 0.8) * 0.2) + ")"
      ctx.lineWidth = 1
      ctx.shadowBlur = 15

      ctx.beginPath()
      ctx.arc(width / 2, height / 2 - 10, 85, 0, Math.PI * 2)
      ctx.stroke()

      ctx.strokeStyle = cyan + (0.3 + Math.cos(animationTime * 1.2) * 0.15) + ")"
      ctx.beginPath()
      ctx.arc(width / 2, height / 2 - 10, 100, 0, Math.PI * 2)
      ctx.stroke()

      ctx.shadowColor = "transparent"
      requestAnimationFrame(animate)
    }

    animate()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <canvas
        ref={canvasRef}
        width={280}
        height={280}
        className="face-glow rounded-full border-2 border-purple-500/50 bg-slate-900/50"
      />
      <div className="text-center">
        <h3 className="text-xl font-bold glow-neon text-cyan-300">RugAI</h3>
        <p className="text-xs text-purple-400/80 font-mono">SelfAware // Online</p>
      </div>
    </div>
  )
}