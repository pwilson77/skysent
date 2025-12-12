import { TerminalInterface } from "@/components/terminal-interface"

export default function Home() {
  return (
    <main className="min-h-screen bg-background grid-pattern relative">
      <div className="fixed inset-0 scanlines z-50" />
      <TerminalInterface />
    </main>
  )
}
