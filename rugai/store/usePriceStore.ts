import { create } from "zustand";

export type TokenStats = {
  mint: string;               
  priceUsd: number;
  change24h?: number;     
  volume24h?: number;
  marketCap?: number;
  lastUpdated?: number;
};

type PriceStoreState = {
  tokens: Record<string, TokenStats>;
  upsertToken: (t: Partial<TokenStats> & { mint: string }) => void;
  setPrice: (mint: string, priceUsd: number, opts?: Partial<TokenStats>) => void;
  removeToken: (mint: string) => void;
  clear: () => void;
  getToken: (mint: string) => TokenStats | undefined;
  listTokens: () => TokenStats[];
};

export const usePriceStore = create<PriceStoreState>((set, get) => ({
  tokens: {},

  upsertToken: (t) =>
    set((s) => {
      const now = Date.now();
      const existing = s.tokens[t.mint] ?? { mint: t.mint, priceUsd: 0, lastUpdated: now };
      const merged: TokenStats = {
        ...existing,
        ...t,
        lastUpdated: now,
      };
      return { tokens: { ...s.tokens, [t.mint]: merged } };
    }),

  setPrice: (mint, priceUsd, opts) =>
    set((s) => {
      const now = Date.now();
      const existing = s.tokens[mint] ?? { mint, priceUsd: 0, lastUpdated: now };
      const updated: TokenStats = {
        ...existing,
        priceUsd,
        lastUpdated: now,
        ...opts,
      };
      return { tokens: { ...s.tokens, [mint]: updated } };
    }),

  removeToken: (mint) =>
    set((s) => {
      const copy = { ...s.tokens };
      delete copy[mint];
      return { tokens: copy };
    }),

  clear: () => set({ tokens: {} }),

  getToken: (mint) => get().tokens[mint],

  listTokens: () => Object.values(get().tokens),
}));