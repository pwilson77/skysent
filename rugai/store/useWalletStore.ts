import { create } from "zustand";

export type TokenInfo = {
    name: string;
    symbol: string;
    balance: number;
    usdValue: number;
}

export type WalletBalance = {
  address?: string;
  walletBalanceInSol: number;
  walletBalanceInUsd: number;
  tokens: TokenInfo[];
  lastUpdated?: string;
};

type WalletState = {
  wallet?: WalletBalance;
  setWallet: (w: Partial<WalletBalance>) => void;
  setWalletBalanceInSol: (sol: number) => void;
  setWalletBalanceInUsd: (usd: number) => void;
  setTokenBalance: (tokenMint: string, amount: number) => void;
  clear: () => void;
  getWallet: () => WalletBalance | undefined;
};

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet: undefined,

  setWallet: (w) =>
    set(() => ({
      wallet: {
        address: w.address ?? get().wallet?.address,
        walletBalanceInSol: w.walletBalanceInSol ?? get().wallet?.walletBalanceInSol ?? 0,
        walletBalanceInUsd: w.walletBalanceInUsd ?? get().wallet?.walletBalanceInUsd ?? 0,
        tokens: [...(w.tokens ?? []) ],
        lastUpdated: Date.now().toString(),
      },
    })),

  setWalletBalanceInSol: (sol) =>
    set(() => ({
      wallet: {
        address: get().wallet?.address,
        walletBalanceInSol: sol,
        walletBalanceInUsd: get().wallet?.walletBalanceInUsd ?? 0,
        tokens: get().wallet?.tokens ?? [],
        lastUpdated: Date.now().toString(),
      },
    })),

  setWalletBalanceInUsd: (usd) =>
    set(() => ({
      wallet: {
        address: get().wallet?.address,
        walletBalanceInSol: get().wallet?.walletBalanceInSol ?? 0,
        tokens: get().wallet?.tokens ?? [],
        walletBalanceInUsd: usd,
        lastUpdated: Date.now().toString(),
      },
    })),

  setTokenBalance: (tokenMint, amount) =>
    set(() => {
      const currentTokens = get().wallet?.tokens ?? [];
      const updatedTokens = currentTokens.map((t) =>
        t.symbol === tokenMint ? { ...t, balance: amount } : t
      );
      if (!updatedTokens.find((t) => t.symbol === tokenMint)) {
        updatedTokens.push({
          name: tokenMint,
          symbol: tokenMint,
          balance: amount,
          usdValue: 0,
        });
      }
      return {
        wallet: {
          address: get().wallet?.address,
          walletBalanceInSol: get().wallet?.walletBalanceInSol ?? 0,
          walletBalanceInUsd: get().wallet?.walletBalanceInUsd ?? 0,
          tokens: updatedTokens,
          lastUpdated: Date.now().toString(),
        },
      };
    }),

  clear: () => set({ wallet: undefined }),

  getWallet: () => get().wallet,
}));