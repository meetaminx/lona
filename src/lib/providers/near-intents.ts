import type { PaymentAttempt, ProviderStatus, TxRef } from "@/db/schema";
import { ZEC, type SettlementAsset } from "@/lib/assets";
import { formatBaseUnits } from "@/lib/money";
import { ProviderError, type QuoteRequest, type QuoteResult, type StatusResult, type SwapProvider } from "./types";
import { feeBps, feeRecipient } from "@/lib/fees";

let warnedNoFeeRecipient = false;

/** A quote must pay out at least the invoice amount and ask for a positive ZEC amount. */
export function assertQuoteCovers(requestedOut: string, amountIn: string, amountOut: unknown, raw?: unknown) {
  if (!/^\d+$/.test(amountIn) || BigInt(amountIn) <= 0n) {
    throw new ProviderError("The swap network returned an invalid ZEC amount.", true, raw);
  }
  if (typeof amountOut === "string" && /^\d+$/.test(amountOut) && BigInt(amountOut) < BigInt(requestedOut)) {
    throw new ProviderError("The swap network quoted less than the invoice amount. Try again in a moment.", true, raw);
  }
}

/**
 * NEAR Intents 1Click API.
 * Docs: https://docs.near-intents.org/integration/distribution-channels/1click-api/about-1click-api
 *
 * Notes that shape this adapter:
 * - Zcash is supported with transparent deposit addresses. A shielded wallet can pay a
 *   transparent address; the payer's wallet and history stay shielded, the amount is public.
 * - There is no testnet. Test mode in Lona uses the sandbox provider instead.
 * - A JWT (ONECLICK_JWT) moves the integration onto the authenticated fee schedule.
 */

type Token = {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price?: number;
  contractAddress?: string;
};

const VALID_STATUSES: ProviderStatus[] = [
  "PENDING_DEPOSIT",
  "KNOWN_DEPOSIT_TX",
  "PROCESSING",
  "SUCCESS",
  "INCOMPLETE_DEPOSIT",
  "REFUNDED",
  "FAILED",
];

export class NearIntentsProvider implements SwapProvider {
  readonly name = "near-intents";
  private tokens: { at: number; list: Token[] } | null = null;

  constructor(
    private readonly baseUrl = process.env.ONECLICK_BASE_URL ?? "https://1click.chaindefuser.com",
    private readonly jwt = process.env.ONECLICK_JWT,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.jwt) headers.Authorization = `Bearer ${this.jwt}`;
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch (err) {
      throw new ProviderError("The swap network did not respond. Try again in a moment.", true, String(err));
    }
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const detail = body && typeof body === "object" ? (body as { message?: unknown }).message : undefined;
      const message = typeof detail === "string" && detail ? detail : `Swap network returned ${res.status}`;
      throw new ProviderError(message, res.status >= 500 || res.status === 429, body);
    }
    return body as T;
  }

  private async tokenList(): Promise<Token[]> {
    if (this.tokens && Date.now() - this.tokens.at < 10 * 60_000) return this.tokens.list;
    const list = await this.request<Token[]>("/v0/tokens");
    this.tokens = { at: Date.now(), list };
    return list;
  }

  /** Resolve 1Click asset IDs from the live token list, falling back to known IDs. */
  async resolveAssetIds(settlement: SettlementAsset): Promise<{ zec: string; out: string }> {
    let list: Token[] = [];
    try {
      list = await this.tokenList();
    } catch {
      return { zec: ZEC.assetIdHint, out: settlement.assetIdHint };
    }
    const zec = list.find((t) => t.blockchain === ZEC.blockchain && t.symbol.toUpperCase() === "ZEC");
    const out =
      list.find(
        (t) =>
          t.blockchain === settlement.blockchain &&
          t.contractAddress?.toLowerCase() === settlement.contractAddress.toLowerCase(),
      ) ?? list.find((t) => t.blockchain === settlement.blockchain && t.symbol.toUpperCase() === settlement.symbol);
    return { zec: zec?.assetId ?? ZEC.assetIdHint, out: out?.assetId ?? settlement.assetIdHint };
  }

  async quote(req: QuoteRequest): Promise<QuoteResult> {
    const ids = await this.resolveAssetIds(req.settlement);
    const appFeeBps = feeBps();
    const recipient = feeRecipient();
    if (appFeeBps > 0 && !recipient && !warnedNoFeeRecipient) {
      warnedNoFeeRecipient = true;
      console.warn("[lona] LONA_FEE_RECIPIENT is not set, so live quotes carry no Lona fee.");
    }

    const body: Record<string, unknown> = {
      dry: false,
      swapType: "EXACT_OUTPUT",
      slippageTolerance: Number(process.env.ONECLICK_SLIPPAGE_BPS ?? "100"),
      originAsset: ids.zec,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: ids.out,
      amount: req.amountOutBase,
      recipient: req.recipient,
      recipientType: "DESTINATION_CHAIN",
      refundTo: req.refundTo,
      refundType: "ORIGIN_CHAIN",
      deadline: req.deadline.toISOString(),
      referral: "lona",
      confidentiality: process.env.ONECLICK_CONFIDENTIALITY ?? "basic",
    };
    if (appFeeBps > 0 && recipient) body.appFees = [{ recipient, fee: appFeeBps }];

    const res = await this.request<{ quote?: Record<string, unknown> } & Record<string, unknown>>("/v0/quote", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const q = (res.quote ?? {}) as Record<string, unknown>;
    const depositAddress = typeof q.depositAddress === "string" ? q.depositAddress : null;
    const amountIn = typeof q.amountIn === "string" ? q.amountIn : null;
    if (!depositAddress || !amountIn) {
      throw new ProviderError("The swap network returned a quote without a deposit address.", true, res);
    }
    assertQuoteCovers(req.amountOutBase, amountIn, q.amountOut, res);
    return {
      depositAddress,
      depositMemo: typeof q.depositMemo === "string" ? q.depositMemo : null,
      amountInBase: amountIn,
      amountInFormatted:
        typeof q.amountInFormatted === "string" ? q.amountInFormatted : formatBaseUnits(amountIn, ZEC.decimals),
      amountOutBase: typeof q.amountOut === "string" ? q.amountOut : req.amountOutBase,
      deadline: typeof q.deadline === "string" ? new Date(q.deadline) : req.deadline,
      raw: res,
    };
  }

  async status(attempt: PaymentAttempt): Promise<StatusResult> {
    const params = new URLSearchParams({ depositAddress: attempt.depositAddress });
    if (attempt.depositMemo) params.set("depositMemo", attempt.depositMemo);
    const res = await this.request<Record<string, unknown>>(`/v0/status?${params}`);
    const status = VALID_STATUSES.includes(res.status as ProviderStatus)
      ? (res.status as ProviderStatus)
      : attempt.providerStatus;
    const details = (res.swapDetails ?? {}) as Record<string, unknown>;
    return {
      status,
      originTxs: toTxRefs(details.originChainTxHashes),
      destinationTxs: toTxRefs(details.destinationChainTxHashes),
      raw: res,
    };
  }

  async submitDepositTx(depositAddress: string, txHash: string): Promise<void> {
    await this.request("/v0/deposit/submit", {
      method: "POST",
      body: JSON.stringify({ depositAddress, txHash }),
    });
  }
}

function toTxRefs(value: unknown): TxRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v === "string") return { hash: v };
      if (v && typeof v === "object" && typeof (v as { hash?: unknown }).hash === "string") {
        const o = v as { hash: string; explorerUrl?: unknown };
        return { hash: o.hash, explorerUrl: typeof o.explorerUrl === "string" ? o.explorerUrl : undefined };
      }
      return null;
    })
    .filter((v): v is TxRef => v !== null);
}
