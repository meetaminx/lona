import { ZEC } from "@/lib/assets";
import { formatBaseUnits } from "@/lib/money";
import { liveZecPrice } from "@/lib/price";

/**
 * ZEC/USD arithmetic shared by test mode, the homepage demo and the checkout's dollar estimate.
 * Live payments never use this to set an amount: their ZEC amount comes from the swap network's quote.
 */

/** Used only when the live price cannot be fetched and SANDBOX_ZEC_USD is not set. */
export const FALLBACK_ZEC_USD = 1300;

/** Typical conversion cost included in demo figures, in basis points. */
export const DEMO_COST_BPS = 100;

/** ZEC in base units (1e-8) needed to buy `cents` US dollars at `priceUsd`, plus `costBps`. Rounds up. */
export function zecBaseForUsd(cents: number, priceUsd: number, costBps = 0): bigint {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) throw new Error("Invalid ZEC price");
  if (!Number.isInteger(cents) || cents < 0) throw new Error("Invalid amount");
  // zec = (cents / 100) / price * (1 + costBps / 10000), in base units, with price held in micro-dollars.
  const priceMicros = BigInt(Math.round(priceUsd * 1_000_000));
  const num = BigInt(cents) * 10n ** BigInt(ZEC.decimals) * BigInt(10_000 + costBps) * 1_000_000n;
  const den = 100n * 10_000n * priceMicros;
  return (num + den - 1n) / den;
}

/** US dollar value of a ZEC base-unit amount at `priceUsd`, in cents, rounded to the nearest cent. */
export function usdCentsForZecBase(zecBase: bigint, priceUsd: number): number {
  const priceMicros = BigInt(Math.round(priceUsd * 1_000_000));
  const cents = (zecBase * priceMicros * 100n + 10n ** BigInt(ZEC.decimals) * 500_000n) / (10n ** BigInt(ZEC.decimals) * 1_000_000n);
  return Number(cents);
}

/** Format ZEC for display at a fixed precision, rounding up so a customer never sends too little. */
export function formatZec(base: bigint, fraction = 4): string {
  const step = 10n ** BigInt(ZEC.decimals - fraction);
  const rounded = ((base + step - 1n) / step) * step;
  const s = formatBaseUnits(rounded.toString(), ZEC.decimals, fraction);
  const [w, f = ""] = s.split(".");
  return `${w}.${f.padEnd(fraction, "0")}`;
}

/** Price used to quote test-mode payments: an explicit override, else the live price, else the fallback. */
export async function testModeZecPrice(): Promise<{ usd: number; source: "override" | "live" | "fallback" }> {
  const override = process.env.SANDBOX_ZEC_USD;
  if (override && Number(override) > 0) return { usd: Number(override), source: "override" };
  const live = await liveZecPrice();
  if (live) return { usd: live.usd, source: "live" };
  return { usd: FALLBACK_ZEC_USD, source: "fallback" };
}

export type DemoQuote = { usd: string; zec: string; zecUsd: string; live: boolean };

/** Figures for the homepage demo, derived from the same price shown on the page. */
export function demoQuote(price: { usd: number } | null, cents = 12_800): DemoQuote {
  const usd = (cents / 100).toFixed(2);
  const p = price?.usd ?? FALLBACK_ZEC_USD;
  const base = zecBaseForUsd(cents, p, DEMO_COST_BPS);
  return { usd, zec: formatZec(base), zecUsd: (usdCentsForZecBase(base, p) / 100).toFixed(2), live: !!price };
}
