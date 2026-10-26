import type { PaymentAttempt, ProviderStatus, TxRef } from "@/db/schema";
import type { SettlementAsset } from "@/lib/assets";

export type QuoteRequest = {
  invoiceId: string;
  settlement: SettlementAsset;
  /** Exact amount the merchant receives, in the settlement token's smallest unit. */
  amountOutBase: string;
  /** Merchant payout address on the settlement chain. */
  recipient: string;
  /** Transparent Zcash address that receives the ZEC back if the swap cannot complete. */
  refundTo: string;
  deadline: Date;
};

export type QuoteResult = {
  depositAddress: string;
  depositMemo: string | null;
  amountInBase: string;
  amountInFormatted: string;
  amountOutBase: string;
  deadline: Date;
  raw: Record<string, unknown>;
};

export type StatusResult = {
  status: ProviderStatus;
  originTxs: TxRef[];
  destinationTxs: TxRef[];
  raw: Record<string, unknown>;
};

/**
 * A route that turns ZEC into the merchant's settlement asset.
 * Lona never holds funds: the customer pays the provider's deposit address and the
 * provider pays the merchant's wallet directly.
 */
export interface SwapProvider {
  readonly name: string;
  quote(req: QuoteRequest): Promise<QuoteResult>;
  status(attempt: PaymentAttempt): Promise<StatusResult>;
  submitDepositTx?(depositAddress: string, txHash: string): Promise<void>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly retryable = false, readonly detail?: unknown) {
    super(message);
    this.name = "ProviderError";
  }
}
