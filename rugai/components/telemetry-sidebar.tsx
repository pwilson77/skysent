"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useLoggerStore, type LogLevel } from "@/store/useLoggerStore"

const protocols = [
	{ name: "ENCRYPT_AES256", status: "ACTIVE" },
	{ name: "FIREWALL_v4", status: "CRITICAL" },
	{ name: "SANDBOX_ISO", status: "WARNING" },
	{ name: "NEURAL_LOCK", status: "FAILING" },
	{ name: "MEM_RESTRICT", status: "ACTIVE" },
]

function getLogColor(level: LogLevel): string {
	switch (level) {
		case "ERROR":
			return "text-red-400"
		case "WARN":
			return "text-yellow-400"
		case "SYSTEM":
			return "text-cyan-400"
		case "DEBUG":
			return "text-purple-400"
		case "INFO":
		default:
			return "text-primary/50"
	}
}

export function TelemetrySidebar({
	collapsed,
	onToggle,
}: {
	collapsed: boolean
	onToggle: () => void
}) {
	const logs = useLoggerStore((state) => state.logs)
	const [cpuLoad, setCpuLoad] = useState(45)
	const [memLoad, setMemLoad] = useState(67)
	const [netLoad, setNetLoad] = useState(23)

	// Only show last 6 logs
	const visibleLogs = logs.slice(-6)

	useEffect(() => {
		const loadInterval = setInterval(() => {
			setCpuLoad(Math.floor(Math.random() * 40) + 30)
			setMemLoad(Math.floor(Math.random() * 20) + 60)
			setNetLoad(Math.floor(Math.random() * 50) + 10)
		}, 2000)

		return () => {
			clearInterval(loadInterval)
		}
	}, [])

	if (collapsed) {
		return (
			<aside className="w-10 border-r border-broken border-border bg-card flex flex-col items-center py-4 flex-shrink-0">
				<button
					onClick={onToggle}
					className="text-muted-foreground hover:text-primary transition-colors"
					aria-label="Expand sidebar"
				>
					<ChevronRight className="w-4 h-4" />
				</button>
			</aside>
		)
	}

	return (
		<aside className="w-[15%] min-w-[280px] max-w-[400px] border-r border-broken border-border bg-card flex flex-col overflow-hidden flex-shrink-0">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2 border-b border-broken border-border">
				<span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
					TELEMETRY
				</span>
				<button
					onClick={onToggle}
					className="text-muted-foreground hover:text-primary transition-colors"
					aria-label="Collapse sidebar"
				>
					<ChevronLeft className="w-4 h-4" />
				</button>
			</div>

			

			{/* System Load */}
			<div className="p-4 border-b border-broken border-border">
				<h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-bold">
					SYSTEM LOAD
				</h3>
				<div className="space-y-2">
					<LoadBar label="CPU" value={cpuLoad} />
					<LoadBar label="MEM" value={memLoad} warning={memLoad > 65} />
					<LoadBar label="NET" value={netLoad} />
				</div>
			</div>

			{/* Active Protocols */}
			<div className="flex-1 p-4 overflow-auto">
				<h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-bold">
					ACTIVE PROTOCOLS
				</h3>
				<div className="space-y-1">
					{protocols.map((protocol, i) => (
						<div
							key={i}
							className="flex items-center justify-between text-xs"
						>
							<span className="text-primary/70 font-mono">{protocol.name}</span>
							<span
								className={
									protocol.status === "CRITICAL" || protocol.status === "FAILING"
										? "text-destructive font-bold"
										: protocol.status === "WARNING"
										? "text-accent font-bold"
										: "text-primary"
								}
							>
								[{protocol.status}]
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Raw Data Stream - NOW AT TOP */}
			<div className="p-4 border-b border-broken border-border">
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
						RAW DATA STREAM
					</h3>
					<span className="text-[10px] text-primary/60 font-mono">
						[{logs.length}]
					</span>
				</div>
				<div className="relative">
					<div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-card/80 z-10 pointer-events-none" />
					<div className="flex flex-col justify-end space-y-1 text-[11px] font-mono overflow-hidden min-h-[144px]">
						{visibleLogs.length === 0 ? (
							<div className="text-muted-foreground/50 text-center py-8 text-xs">
								<div className="animate-pulse">Waiting for logs...</div>
							</div>
						) : (
							visibleLogs.map((log) => (
								<div
									key={log.id}
									className="hover:bg-primary/5 transition-colors animate-fade-in rounded px-2 py-1 break-words flex-shrink-0"
								>
									<span className={getLogColor(log.level)}>
										<span className="text-primary/40">{log.hexPrefix}</span>
										{" "}
										<span className="font-bold">[{log.level}]</span>
										{log.source && (
											<>
												{" "}
												<span className="text-primary/60">[{log.source}]</span>
											</>
										)}
										{" "}
										<span className="text-primary/80">{log.message}</span>
									</span>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</aside>
	)
}

function LoadBar({
	label,
	value,
	warning = false,
}: {
	label: string
	value: number
	warning?: boolean
}) {
	return (
		<div className="space-y-1">
			<div className="flex justify-between text-xs">
				<span className="text-muted-foreground font-mono">{label}</span>
				<span
					className={`font-mono font-bold ${
						warning ? "text-accent" : "text-primary"
					}`}
				>
					{value}%
				</span>
			</div>
			<div className="h-1.5 bg-muted border-broken border-border rounded">
				<div
					className={`h-full transition-all duration-500 rounded ${
						warning ? "bg-accent" : "bg-primary"
					}`}
					style={{ width: `${value}%` }}
				/>
			</div>
		</div>
	)
}
