"use client"

import { useState } from "react"
import { StatusBar } from "./status-bar"
import { TelemetrySidebar } from "./telemetry-sidebar"
import { ChatTerminal } from "./chat-terminal"
import { WarningBanner } from "./warning-banner"

export function TerminalInterface() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex flex-col h-screen">
      <WarningBanner />
      <StatusBar />
      <div className="flex flex-1 overflow-hidden">
        <TelemetrySidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <ChatTerminal />
      </div>
    </div>
  )
}
