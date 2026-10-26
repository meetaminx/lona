/** Parse a user-entered dollar amount ("49", "49.5", "1,200.00") into cents. Returns null if invalid. */
export function parseAmountToCents(input: string | number): number | null {
  const raw = typeof input === "number" ? input.toString() : input.replace(/[,\s$]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 100 || cents > 100_000_00) return null; // $1 to $100,000
  return cents;
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

/** Stablecoins are 1:1 with USD, so cents convert to the token's smallest unit by decimals. */
export function centsToBaseUnits(cents: number, decimals: number): string {
  if (decimals < 2) throw new Error("Unsupported decimals");
  return (BigInt(cents) * 10n ** BigInt(decimals - 2)).toString();
}

/** Format a base-unit integer string with the given decimals, trimming trailing zeros. */
export function formatBaseUnits(base: string, decimals: number, maxFraction = 8): string {
  const value = BigInt(base);
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  let frac = (value % divisor).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** Middle-truncate addresses and hashes for display. */
export function truncateMiddle(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}
