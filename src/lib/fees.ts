/** Lona's fee in basis points, added to the customer's quote. One setting for the pricing page and live quotes. */
export function feeBps(): number {
  const n = Number(process.env.LONA_FEE_BPS ?? "50");
  return Number.isFinite(n) && n >= 0 ? n : 50;
}

/** Where the fee is paid. Without it, quotes carry no fee. */
export function feeRecipient(): string | null {
  return process.env.LONA_FEE_RECIPIENT?.trim() || null;
}
