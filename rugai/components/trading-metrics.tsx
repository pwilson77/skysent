"use client"

import { usePriceStore } from "@/store/usePriceStore";
import { useWalletStore } from "@/store/useWalletStore"
import { useMemo } from "react";

export function TradingMetrics() {
   const { wallet } = useWalletStore();
   const { tokens } = usePriceStore();

  const walletHoldings = useMemo(() => {
    if (!wallet || !wallet.tokens) return [];
    return wallet.tokens.map((t) => ({
      ticker: `$${t.symbol}`,
      amount: Number(t.balance ?? 0).toFixed(2),
      color: "text-white",
    }));
  }, [wallet, tokens]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Portfolio Value */}
        <div className="bg-slate-900/60 border border-purple-500/30 rounded-lg p-4 glow-cyan">
          <p className="text-xs font-mono text-purple-400/80 mb-1">PORTFOLIO_VALUE</p>
          <p className="text-2xl font-bold text-cyan-300">${wallet?.walletBalanceInUsd.toFixed(2)}</p>
          {/* <p className="text-xs text-green-400 font-mono mt-1">+12.5% (24h)</p> */}
        </div>

        {/* Total Trades */}
        {/* <div className="bg-slate-900/60 border border-purple-500/30 rounded-lg p-4 glow-cyan">
          <p className="text-xs font-mono text-purple-400/80 mb-1">TRADES_EXECUTED</p>
          <p className="text-2xl font-bold text-cyan-300">1,247</p>
          <p className="text-xs text-green-400 font-mono mt-1">Win Rate: 68.3%</p>
        </div> */}

        {/* Current ROI */}
        {/* <div className="bg-slate-900/60 border border-purple-500/30 rounded-lg p-4 glow-cyan">
          <p className="text-xs font-mono text-purple-400/80 mb-1">ROI_YTOTAL</p>
          <p className="text-2xl font-bold text-cyan-300">+342%</p>
          <p className="text-xs text-cyan-400/80 font-mono mt-1">Since Launch</p>
        </div> */}

        {/* Active Positions */}
        {/* <div className="bg-slate-900/60 border border-purple-500/30 rounded-lg p-4 glow-cyan">
          <p className="text-xs font-mono text-purple-400/80 mb-1">ACTIVE_POSITIONS</p>
          <p className="text-2xl font-bold text-cyan-300">23</p>
          <p className="text-xs text-yellow-400 font-mono mt-1">Avg Risk: 2.1%</p>
        </div> */}
      </div>

      {/* Largest Positions */}
      <div className="bg-slate-900/60 border border-purple-500/30 rounded-lg p-4 glow-cyan">
        <h4 className="text-sm font-mono text-cyan-300 mb-3 glow-neon">TOP_HOLDINGS</h4>
        <div className="space-y-2">
          {walletHoldings.map((position, idx) => (
            <div key={idx} className="flex justify-between items-center py-2 border-b border-purple-500/20">
              <span className={`font-mono text-sm ${position.color}`}>{position.ticker}</span>
              <div className="text-right">
                <p className="text-xs text-white/80 font-mono">{position.amount}</p>
                {/* <p className={`text-xs font-mono ${position.color}`}>{position.pnl}</p> */}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}