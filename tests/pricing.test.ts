process.env.DATABASE_URL = "pglite://memory";
process.env.SANDBOX_ZEC_USD = "1296.40";

import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_COST_BPS, demoQuote, formatZec, usdCentsForZecBase, zecBaseForUsd } from "../src/lib/pricing";
import { centsToBaseUnits, formatBaseUnits } from "../src/lib/money";
import { SandboxProvider, SANDBOX_COST_BPS } from "../src/lib/providers/sandbox";
import { assertQuoteCovers } from "../src/lib/providers/near-intents";
import { ProviderError } from "../src/lib/providers/types";
import { getSettlementAsset } from "../src/lib/assets";
import { quoteUsd } from "../src/lib/public-invoice";
import { createMerchant } from "../src/lib/auth";

test("ZEC for a dollar amount matches price arithmetic", () => {
  // The case from the bug report: $128 at $1,296.40 is about 0.0987 ZEC, not 3.216.
  const base = zecBaseForUsd(12_800, 1296.4);
  assert.equal(base, 9_873_496n); // 128 / 1296.40 = 0.098734958..., rounded up
  assert.ok(Math.abs(Number(base) / 1e8 - 128 / 1296.4) < 1e-8);
  // A cost is added on top, never subtracted.
  const withCost = zecBaseForUsd(12_800, 1296.4, 100);
  assert.ok(withCost > base);
  assert.ok(Math.abs(Number(withCost) / Number(base) - 1.01) < 1e-6);
});

test("rounding always favours the merchant", () => {
  // 1 cent at a price that does not divide evenly must round up, not down.
  const base = zecBaseForUsd(1, 3);
  assert.equal(base, 333_334n); // 0.01 / 3 = 0.00333... ZEC = 333,333.33 base units, rounded up
  assert.equal(formatZec(9_873_496n), "0.0988");
  assert.equal(formatZec(100_000_000n), "1.0000");
  assert.equal(formatZec(1n), "0.0001");
});

test("dollar value of a ZEC amount round-trips", () => {
  for (const [cents, price] of [[12_800, 1296.4], [4_900, 1300], [650, 87.25], [10_000_000, 2500]] as const) {
    const base = zecBaseForUsd(cents, price);
    const back = usdCentsForZecBase(base, price);
    assert.ok(back >= cents && back - cents <= 1, `${cents} at ${price}: got ${back}`);
  }
  assert.throws(() => zecBaseForUsd(100, 0));
  assert.throws(() => zecBaseForUsd(1.5, 100));
});

test("stablecoin base units keep every cent at 6 and 18 decimals", () => {
  assert.equal(centsToBaseUnits(12_800, 6), "128000000");
  assert.equal(centsToBaseUnits(1, 6), "10000");
  assert.equal(centsToBaseUnits(12_345_67, 18), "12345670000000000000000");
  assert.equal(formatBaseUnits("128000000", 6), "128");
  assert.equal(formatBaseUnits("123456789", 8), "1.23456789");
});

test("homepage demo figures agree with the price shown", () => {
  const d = demoQuote({ usd: 1296.4 });
  assert.equal(d.live, true);
  assert.equal(d.usd, "128.00");
  assert.equal(d.zec, "0.0998"); // 128 / 1296.40 plus the 1% demo cost, rounded up
  const implied = Number(d.zecUsd);
  assert.ok(implied >= 128 && implied < 128 * (1 + DEMO_COST_BPS / 10_000) + 0.2, `implied ${implied}`);
  const fallback = demoQuote(null);
  assert.equal(fallback.live, false);
});

test("test-mode quotes use the configured price", async () => {
  const asset = getSettlementAsset("usdc-base")!;
  const q = await new SandboxProvider().quote({
    invoiceId: "inv_t",
    settlement: asset,
    amountOutBase: centsToBaseUnits(12_800, asset.decimals),
    recipient: "0x0000000000000000000000000000000000000001",
    refundTo: "t1Rv4exT7bqhZqi2j7xz8bUHDMxwosrjADU",
    deadline: new Date(Date.now() + 60_000),
  });
  assert.equal(BigInt(q.amountInBase), zecBaseForUsd(12_800, 1296.4, SANDBOX_COST_BPS));
  assert.equal((q.raw as { priceSource: string }).priceSource, "override");
  // Checkout's dollar estimate for this quote covers the invoice plus the simulated cost.
  const usd = quoteUsd({ amountInBase: q.amountInBase, raw: q.raw } as never);
  assert.ok(usd && Number(usd) >= 128 && Number(usd) <= 128.7, `usd ${usd}`);
});

test("checkout shows the swap network's own dollar figure when it has one", () => {
  const usd = quoteUsd({ amountInBase: "9900000", raw: { quote: { amountInUsd: "129.07" } } } as never);
  assert.equal(usd, "129.07");
  assert.equal(quoteUsd({ amountInBase: "1", raw: {} } as never), null);
});

test("quotes that pay out less than the invoice are rejected", () => {
  assert.doesNotThrow(() => assertQuoteCovers("128000000", "9900000", "128000000"));
  assert.doesNotThrow(() => assertQuoteCovers("128000000", "9900000", undefined));
  assert.throws(() => assertQuoteCovers("128000000", "9900000", "127999999"), ProviderError);
  assert.throws(() => assertQuoteCovers("128000000", "0", "128000000"), ProviderError);
  assert.throws(() => assertQuoteCovers("128000000", "abc", "128000000"), ProviderError);
});

test("two sign-ups for one email at the same moment create one account", async () => {
  const input = { email: "Race@Example.com", password: "longenough123", businessName: "Race" };
  const results = await Promise.all([createMerchant(input), createMerchant(input), createMerchant(input)]);
  const created = results.filter((r) => "merchant" in r && r.merchant);
  const refused = results.filter((r) => "error" in r && r.error);
  assert.equal(created.length, 1);
  assert.equal(refused.length, 2);
  for (const r of refused) assert.match((r as { error: string }).error, /already exists/);
});
