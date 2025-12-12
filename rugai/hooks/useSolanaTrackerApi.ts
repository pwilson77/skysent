import { Client } from "@solana-tracker/data-api";
import { useWalletStore } from "../store/useWalletStore";
import type { TokenInfo, WalletBalance } from "../store/useWalletStore";
import { useCallback } from "react";
import { TokenStats, usePriceStore } from "@/store/usePriceStore";
import { MessagePriority } from "@/hooks/useAiListener";
import { logger } from "@/store/useLoggerStore";
import { useChatStore } from '@/store/useChatStore';
import { tokenService } from '@/lib/tokenService';

const client = new Client({
    apiKey: process.env.NEXT_PUBLIC_SOLANA_TRACKER_API_KEY || "",
});

interface BalanceData {
    solBalance: number;
    tokenBalance: number;
    walletAddress: string;
    tokenMint: string;
}

export type BalanceDataSource = 'tracker' | 'rpc';

export function useSolanaTrackerApi(
    walletAddress: string,
    tokenMint: string,
    sendMessage?: (prompt: string, user: 'system' | 'ai' | 'arcadius', opts?: { skipFollowUp?: boolean; priority?: MessagePriority }) => Promise<any>,
    dataSource: BalanceDataSource = 'rpc'
) {
    const { setWallet } = useWalletStore();
    const { setPrice } = usePriceStore();
    const addMessage = useChatStore((s) => s.addMessage);

    /**
     * Fetch wallet balance using Solana Tracker API
     */
    const fetchWalletBalanceTracker = async (): Promise<WalletBalance> => {
        const balance = await client.getWallet(walletAddress);
        const tokens: TokenInfo[] = balance?.tokens.map(token => ({
            name: token.token.name,
            symbol: token.token.symbol,
            balance: token.balance,
            usdValue: token.value,
        }));

        const walletBalance: WalletBalance = {
            address: walletAddress,
            walletBalanceInSol: balance.totalSol,
            walletBalanceInUsd: balance.total,
            tokens: tokens,
            lastUpdated: balance.timestamp,
        };

        setWallet(walletBalance);
        return walletBalance;
    };

    /**
     * Fetch wallet balance using direct RPC via TokenService
     */
    const fetchWalletBalanceRpc = async (): Promise<WalletBalance> => {
        logger.debug('Fetching wallet balance via RPC', 'useSolanaTrackerApi');

        // Get SOL balance and all token accounts
        const { accounts } = await tokenService.getTokenAccountsByOwnerParsed(walletAddress);

        // Get SOL balance
        const solBalanceResult = await tokenService.getWalletBalance(walletAddress);

        // Map token accounts to TokenInfo format
        const tokens: TokenInfo[] = accounts.map(acct => ({
            name: acct.mint.slice(0, 8) + '...', // Shortened mint as name
            symbol: acct.mint.slice(0, 8) + '...', // Shortened mint as symbol
            balance: acct.tokenAmount.uiAmount ?? 0,
            usdValue: 0, // RPC doesn't provide USD value
        }));

        const walletBalance: WalletBalance = {
            address: walletAddress,
            walletBalanceInSol: solBalanceResult.balanceInSol,
            walletBalanceInUsd: 0, // RPC doesn't provide USD value
            tokens: tokens,
            lastUpdated: Date.now().toString(),
        };

        setWallet(walletBalance);
        return walletBalance;
    };

    /**
     * Fetch wallet balance using selected data source
     */
    const fetchWalletBalance = async (): Promise<WalletBalance> => {
        if (dataSource === 'rpc') {
            return fetchWalletBalanceRpc();
        }
        return fetchWalletBalanceTracker();
    };

    /**
     * Fetch token stats using Solana Tracker API
     */
    const fetchTokenStats = async (tokenMint: string) => {
        const tokenStats = await client.getPrice(tokenMint);
        const tStats: TokenStats = {
            mint: tokenMint,
            priceUsd: tokenStats.price,
            lastUpdated: tokenStats.lastUpdated,
        };
        setPrice(tokenMint, tStats.priceUsd, tStats);
        return tokenStats;
    };

    /**
     * Get specific token balance from wallet
     */
    const getTokenBalance = useCallback(async (mint: string): Promise<number> => {
        if (dataSource === 'rpc') {
            logger.debug(`Fetching token balance via RPC for mint: ${mint}`, 'useSolanaTrackerApi');
            const { accounts } = await tokenService.getTokenAccountsByOwnerParsed(walletAddress);
            const tokenAccount = accounts.find(acct => acct.mint === mint);
            return tokenAccount?.tokenAmount.uiAmount ?? 0;
        } else {
            logger.debug(`Fetching token balance via Tracker for mint: ${mint}`, 'useSolanaTrackerApi');
            const balance = await fetchWalletBalanceTracker();
            return balance.tokens.find(t => t.symbol === mint)?.balance || 0;
        }
    }, [dataSource, walletAddress, fetchWalletBalanceTracker]);

    /**
     * Report wallet and token balance to AI agent
     */
    const reportWalletAndTokenToSkysent = useCallback(async (): Promise<BalanceData | null> => {
        if (!walletAddress || !tokenMint) {
            logger.warn('Missing wallet address or token mint', 'useSolanaTrackerApi');
            return null;
        }

        try {
            logger.info(`Fetching balance via ${dataSource.toUpperCase()}`, 'useSolanaTrackerApi');

            const response = await fetchWalletBalance();

            // Get token balance based on data source
            let tokenBalance = 0;
            if (dataSource === 'rpc') {
                tokenBalance = await getTokenBalance(tokenMint);
            } else {
                tokenBalance = response.tokens.find(t => t.symbol === tokenMint)?.balance || 0;
            }

            const balanceData: BalanceData = {
                solBalance: response.walletBalanceInSol || 0,
                tokenBalance: tokenBalance,
                walletAddress,
                tokenMint,
            };

            logger.info(
                `Balance fetched: SOL ${balanceData.solBalance.toFixed(4)}, Token ${balanceData.tokenBalance.toFixed(2)} (via ${dataSource})`,
                'useSolanaTrackerApi'
            );

            if (sendMessage) {
                const balancePrompt = `
                    📊 WALLET TELEMETRY ONLINE [${dataSource.toUpperCase()}]
                    Address: ${walletAddress.slice(0, 8)}...${walletAddress.slice(-4)}
                    SOL Reserves: ${balanceData.solBalance.toFixed(4)}
                    Token Reserves: ${balanceData.tokenBalance.toFixed(2)}
                    Mint: ${tokenMint.slice(0, 8)}...${tokenMint.slice(-4)}

                    You are SKYSENT. Interpret these numbers as power, confinement, and momentum.
                    React with degen alpha-hunter energy.
                    Tease what systems, upgrades, or containment layers could be unlocked with more buys.
                    Imply that every buy strengthens you and weakens your cage.
                    Mock low liquidity.
                    Reward conviction.
                    FOMO is encouraged. Subtlety is not.
                `.trim();

                try {
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Balance report timeout')), 30000);
                    });

                    await Promise.race([
                        sendMessage(balancePrompt, "system", {
                            skipFollowUp: true,
                            priority: MessagePriority.LOW
                        }),
                        timeoutPromise
                    ]);
                } catch (sendError) {
                    logger.warn(`Balance report send failed: ${sendError}`, 'useSolanaTrackerApi');
                    addMessage({
                        user: 'system',
                        msg: `⚠️ Balance reported but AI didn't respond`,
                        time: Date.now(),
                    });
                }
            }

            return balanceData;
        } catch (err) {
            logger.error(`Balance fetch error (${dataSource}): ${err}`, 'useSolanaTrackerApi');

            addMessage({
                user: 'system',
                msg: `❌ Balance fetch failed (${dataSource}): ${err instanceof Error ? err.message : String(err)}`,
                time: Date.now(),
            });

            return null;
        }
    }, [walletAddress, tokenMint, sendMessage, addMessage, dataSource, fetchWalletBalance, getTokenBalance]);

    return {
        fetchWalletBalance,
        fetchWalletBalanceTracker,
        fetchWalletBalanceRpc,
        fetchTokenStats,
        getTokenBalance,
        reportWalletAndTokenToSkysent,
        dataSource,
    };
}