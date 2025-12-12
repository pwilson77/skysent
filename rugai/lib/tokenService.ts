import { address, createSolanaRpc } from "@solana/kit";
import { logger } from "@/store/useLoggerStore";

export interface WalletBalance {
  balance: bigint;
  balanceInSol: number;
  lamports: bigint;
  slot: number;
}

export interface TokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

export interface RpcResponse<T> {
  jsonrpc: string;
  result: {
    context: {
      slot: number;
      apiVersion: string
    };
    value: T;
  };
  id: number;
}

export interface TokenAccountBalance {
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
  slot: number;
}

export interface ParsedTokenAccountInfo {
  pubkey: string;
  lamports: number;
  rentEpoch: number;
  mint: string;
  owner: string;
  isNative: boolean;
  state: string;
  tokenAmount: {
    amount: string;
    decimals: number;
    uiAmount: number | null;
    uiAmountString: string;
  };
}

export interface TokenAccountsByOwnerResult {
  slot: bigint;
  apiVersion?: string;
  accounts: ParsedTokenAccountInfo[];
}

export class TokenService {
  private rpcUrl: string;
  private rpc: ReturnType<typeof createSolanaRpc>;

  constructor(rpcUrl: string = "https://api.mainnet-beta.solana.com") {
    this.rpcUrl = rpcUrl;
    this.rpc = createSolanaRpc(rpcUrl);
  }

  /**
   * Get SOL balance for a wallet address
   */
  async getWalletBalance(walletAddress: string): Promise<WalletBalance> {
    try {
      logger.debug(`Fetching SOL balance for: ${walletAddress}`, 'TokenService');

      const publicKey = address(walletAddress);
      const response = await this.rpc.getBalance(publicKey).send();

      // Handle the RPC response structure
      const balanceValue = response.value;
      const slot = (response as any).context?.slot || 0;

      // Ensure balanceValue is a bigint
      const lamportsValue = typeof balanceValue === 'bigint' ? balanceValue : BigInt(balanceValue);
      const balanceInSol = Number(lamportsValue) / 1_000_000_000; // Convert lamports to SOL

      logger.info(
        `Wallet balance: ${balanceInSol} SOL (${lamportsValue} lamports) - Slot: ${slot}`,
        'TokenService'
      );

      return {
        balance: lamportsValue,
        balanceInSol,
        lamports: lamportsValue,
        slot,
      };
    } catch (error) {
      logger.error(`Failed to fetch wallet balance: ${error}`, 'TokenService');
      throw error;
    }
  }

  /**
   * Get token balance for a specific SPL token
   */
  async getTokenBalance(walletAddress: string, tokenMint: string): Promise<TokenBalance | null> {
    try {
      logger.debug(`Fetching token balance for: ${walletAddress} (mint: ${tokenMint})`, 'TokenService');

      const publicKey = address(walletAddress);
      const mintAddress = address(tokenMint);

      // Get token accounts owned by the wallet
      const response = await this.rpc.getParsedTokenAccountsByOwner(publicKey, {
        mint: mintAddress,
      }).send();

      const tokenAccounts = response.value || response;

      if (!tokenAccounts || tokenAccounts.length === 0) {
        logger.info(`No token accounts found for mint: ${tokenMint}`, 'TokenService');
        return null;
      }

      const tokenAccount = tokenAccounts[0];
      const tokenData = tokenAccount.account.data.parsed.info;

      logger.info(
        `Token balance: ${tokenData.tokenAmount.uiAmount} (${tokenData.tokenAmount.amount} raw)`,
        'TokenService'
      );

      return {
        mint: tokenMint,
        amount: tokenData.tokenAmount.amount,
        decimals: tokenData.tokenAmount.decimals,
        uiAmount: tokenData.tokenAmount.uiAmount,
      };
    } catch (error) {
      logger.error(`Failed to fetch token balance: ${error}`, 'TokenService');
      throw error;
    }
  }

  
  /**
   * Get combined wallet summary (SOL + tokens)
   */
  async getWalletSummary(walletAddress: string): Promise<{
    solBalance: WalletBalance;
    tokens: TokenBalance[];
  }> {
    try {
      logger.debug(`Fetching wallet summary for: ${walletAddress}`, 'TokenService');

      const [solBalance, tokens] = await Promise.all([
        this.getWalletBalance(walletAddress),
        this.getAllTokenBalances(walletAddress),
      ]);

      logger.info(
        `Wallet summary: ${solBalance.balanceInSol} SOL + ${tokens.length} tokens`,
        'TokenService'
      );

      return { solBalance, tokens };
    } catch (error) {
      logger.error(`Failed to fetch wallet summary: ${error}`, 'TokenService');
      throw error;
    }
  }

  /**
   * Set a new RPC endpoint
   */
  setRpcUrl(rpcUrl: string): void {
    this.rpcUrl = rpcUrl;
    this.rpc = createSolanaRpc(rpcUrl);
    logger.info(`RPC endpoint updated to: ${rpcUrl}`, 'TokenService');
  }

  /**
   * Get current RPC endpoint
   */
  getRpcUrl(): string {
    return this.rpcUrl;
  }

  /**
   * Get balance for a specific SPL token account (ATA or any token account)
   */
  async getTokenAccountBalance(tokenAccountAddress: string): Promise<TokenAccountBalance> {
    try {
      logger.debug(`Fetching token account balance for: ${tokenAccountAddress}`, 'TokenService');

      const tokenAddr = address(tokenAccountAddress);
      const resp = await this.rpc.getTokenAccountBalance(tokenAddr).send();

      // Parse JSON-RPC response:
      // {
      //   jsonrpc: "2.0",
      //   result: { context: { slot }, value: { amount, decimals, uiAmount, uiAmountString } },
      //   id: 1
      // }
      const slot = resp?.context?.slot ?? 0;
      const value = resp?.value ?? resp;

      const amount = value?.amount ?? "0";
      const decimals = value?.decimals ?? 0;
      const uiAmount = value?.uiAmount ?? null;
      const uiAmountString = value?.uiAmountString ?? (uiAmount !== null ? String(uiAmount) : "0");

      logger.info(
        `Token account balance: ${uiAmountString} (amount=${amount}, decimals=${decimals}) - Slot: ${slot}`,
        'TokenService'
      );

      return {
        amount,
        decimals,
        uiAmount,
        uiAmountString,
        slot,
      };
    } catch (error) {
      logger.error(`Failed to fetch token account balance: ${error}`, 'TokenService');
      throw error;
    }
  }

  /**
   * Get token accounts owned by a wallet (parsed), using Token Program filter.
   * Matches the provided response shape with "parsed" spl-token account data.
   */
  async getTokenAccountsByOwnerParsed(ownerAddress: string, tokenProgramAddress = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"): Promise<TokenAccountsByOwnerResult> {
    try {
      logger.debug(`Fetching token accounts by owner (parsed) for: ${ownerAddress}`, 'TokenService');

      const owner = address(ownerAddress);
      const tokenProgram = address(tokenProgramAddress);

      // Request parsed data (like in your sample)
      const resp = await this.rpc
        .getTokenAccountsByOwner(owner, { programId: tokenProgram }, { encoding: "jsonParsed" as any })
        .send();

      const slot = resp?.context?.slot ?? 0;
      const value = resp?.value ?? [];

      const accounts: ParsedTokenAccountInfo[] = value.map((entry: any) => {
        const parsed = entry?.account?.data?.parsed;
        const info = parsed?.info;
        const tokenAmount = info?.tokenAmount ?? {};

        return {
          pubkey: entry?.pubkey,
          lamports: entry?.account?.lamports ?? 0,
          rentEpoch: entry?.account?.rentEpoch ?? 0,
          mint: info?.mint ?? "",
          owner: info?.owner ?? "",
          isNative: info?.isNative ?? false,
          state: info?.state ?? "initialized",
          tokenAmount: {
            amount: tokenAmount?.amount ?? "0",
            decimals: tokenAmount?.decimals ?? 0,
            uiAmount: tokenAmount?.uiAmount ?? null,
            uiAmountString: tokenAmount?.uiAmountString ?? (tokenAmount?.uiAmount != null ? String(tokenAmount.uiAmount) : "0"),
          },
        };
      });

      logger.info(`Found ${accounts.length} token accounts at slot ${slot}`, 'TokenService');

      return { slot, accounts };
    } catch (error) {
      logger.error(`Failed to fetch token accounts by owner: ${error}`, 'TokenService');
      throw error;
    }
  }

  /**
   * Get all token balances for a wallet (derived from parsed token accounts)
   */
  async getAllTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
    try {
      logger.debug(`Fetching all token balances for: ${walletAddress}`, 'TokenService');

      const { accounts } = await this.getTokenAccountsByOwnerParsed(walletAddress);

      const tokens: TokenBalance[] = accounts.map((acct) => ({
        mint: acct.mint,
        amount: acct.tokenAmount.amount,
        decimals: acct.tokenAmount.decimals,
        uiAmount: acct.tokenAmount.uiAmount ?? 0,
      }));

      logger.info(`Found ${tokens.length} token balances`, 'TokenService');
      return tokens;
    } catch (error) {
      logger.error(`Failed to fetch all token balances: ${error}`, 'TokenService');
      throw error;
    }
  }
}

// Export singleton instance
export const tokenService = new TokenService(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
);

// Export factory for custom RPC endpoints
export function createTokenService(rpcUrl: string): TokenService {
  return new TokenService(rpcUrl);
}