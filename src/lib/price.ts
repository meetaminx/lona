/** Live ZEC price from the swap network's public token list. Returns null if unavailable. */
export async function liveZecPrice(): Promise<{ usd: number; at: Date } | null> {
  try {
    const res = await fetch(`${process.env.ONECLICK_BASE_URL ?? "https://1click.chaindefuser.com"}/v0/tokens`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const list = (await res.json()) as { blockchain: string; symbol: string; price?: number; priceUpdatedAt?: string }[];
    const zec = list.find((t) => t.blockchain === "zec" && t.symbol.toUpperCase() === "ZEC");
    if (!zec?.price) return null;
    return { usd: zec.price, at: zec.priceUpdatedAt ? new Date(zec.priceUpdatedAt) : new Date() };
  } catch {
    return null;
  }
}
