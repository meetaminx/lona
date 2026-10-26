import { randomBytes } from "node:crypto";
import type { PaymentAttempt, ProviderStatus } from "@/db/schema";
import { ZEC } from "@/lib/assets";
import { formatBaseUnits } from "@/lib/money";
import type { QuoteRequest, QuoteResult, StatusResult, SwapProvider } from "./types";

/**
 * Test-mode provider. The swap network has no testnet, so test mode simulates the full
 * lifecycle without moving funds. Quotes use a fixed test price, not a market price.
 */

export type SandboxOutcome = "paid_out" | "underpaid" | "refunded" | "failed";

type SandboxState = { outcome: SandboxOutcome; startedAt: number };

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function fakeTransparentAddress(): string {
  const bytes = randomBytes(33);
  let out = "t1";
  for (let i = 0; i < 33; i++) out += B58[bytes[i] % 58];
  return out;
}

function fakeHash(length = 64): string {
  return randomBytes(length / 2).toString("hex");
}

export const SANDBOX_ZEC_USD = Number(process.env.SANDBOX_ZEC_USD ?? "40");

export class SandboxProvider implements SwapProvider {
  readonly name = "sandbox";

  async quote(req: QuoteRequest): Promise<QuoteResult> {
    // USD value of output, plus a 0.5% simulated network spread, priced at the test rate.
    const cents = BigInt(req.amountOutBase) / 10n ** BigInt(req.settlement.decimals - 2);
    const priceCents = BigInt(Math.round(SANDBOX_ZEC_USD * 100));
    const zecBase = (cents * 10n ** BigInt(ZEC.decimals) * 1005n) / (priceCents * 1000n);
    const amountInBase = zecBase.toString();
    return {
      depositAddress: fakeTransparentAddress(),
      depositMemo: null,
      amountInBase,
      amountInFormatted: formatBaseUnits(amountInBase, ZEC.decimals),
      amountOutBase: req.amountOutBase,
      deadline: req.deadline,
      raw: { sandbox: true, priceUsd: SANDBOX_ZEC_USD },
    };
  }

  async status(attempt: PaymentAttempt): Promise<StatusResult> {
    const sim = (attempt.raw as { sim?: SandboxState }).sim;
    if (!sim) {
      return { status: "PENDING_DEPOSIT", originTxs: [], destinationTxs: [], raw: attempt.raw };
    }
    const elapsed = Date.now() - sim.startedAt;
    let status: ProviderStatus;
    if (elapsed < 3_000) status = "KNOWN_DEPOSIT_TX";
    else if (elapsed < 8_000) status = "PROCESSING";
    else {
      status = {
        paid_out: "SUCCESS",
        underpaid: "INCOMPLETE_DEPOSIT",
        refunded: "REFUNDED",
        failed: "FAILED",
      }[sim.outcome] as ProviderStatus;
    }
    const originTxs = attempt.originTxs.length ? attempt.originTxs : [{ hash: fakeHash() }];
    const destinationTxs =
      status === "SUCCESS"
        ? attempt.destinationTxs.length
          ? attempt.destinationTxs
          : [{ hash: `0x${fakeHash()}` }]
        : [];
    return { status, originTxs, destinationTxs, raw: attempt.raw };
  }
}

export function sandboxStartState(outcome: SandboxOutcome): SandboxState {
  return { outcome, startedAt: Date.now() };
}
