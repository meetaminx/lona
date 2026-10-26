process.env.DATABASE_URL = "pglite://memory";

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { merchants, paymentAttempts, settlementSettings, webhookDeliveries, webhookEndpoints } from "../src/db/schema";
import { createInvoice, startPayment, simulatePayment, syncInvoice, getInvoice, cancelInvoice } from "../src/lib/invoices";
import { verifySignature, deliverDue } from "../src/lib/webhooks";
import { checkPayoutAddress, checkZcashRefundAddress, getSettlementAsset } from "../src/lib/assets";
import { centsToBaseUnits, formatBaseUnits, parseAmountToCents } from "../src/lib/money";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("money helpers", () => {
  assert.equal(parseAmountToCents("49"), 4900);
  assert.equal(parseAmountToCents("1,200.5"), 120050);
  assert.equal(parseAmountToCents("0.50"), null);
  assert.equal(parseAmountToCents("abc"), null);
  assert.equal(centsToBaseUnits(4900, 6), "49000000");
  assert.equal(formatBaseUnits("123450000", 8), "1.2345");
});

test("address checks", () => {
  const base = getSettlementAsset("usdc-base")!;
  const sol = getSettlementAsset("usdc-solana")!;
  assert.equal(checkPayoutAddress(base, "0x" + "a".repeat(40)), null);
  assert.ok(checkPayoutAddress(base, "0x123"));
  assert.equal(checkPayoutAddress(sol, "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV"), null);
  assert.ok(checkPayoutAddress(sol, "0x" + "a".repeat(40)));
  assert.equal(checkZcashRefundAddress("t1" + "a".repeat(33)), null);
  assert.ok(checkZcashRefundAddress("u1shielded"));
});

test("invoice lifecycle in test mode with signed webhooks", async () => {
  const received: { body: string; sig: string }[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ body, sig: String(req.headers["lona-signature"]) });
      res.writeHead(200).end("ok");
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;

  const d = await db();
  await d.insert(merchants).values({ id: "mer_test", email: "a@b.co", passwordHash: "x", businessName: "Kiln Coffee" });

  await assert.rejects(
    createInvoice(d, "mer_test", false, { amountCents: 4900, description: "Beans" }),
    /payout wallet/,
  );

  await d.insert(settlementSettings).values({
    merchantId: "mer_test",
    assetKey: "usdc-base",
    payoutAddress: "0x" + "b".repeat(40),
    refundAddress: "t1" + "c".repeat(33),
  });
  const secret = "whsec_test";
  await d.insert(webhookEndpoints).values({ id: "whe_1", merchantId: "mer_test", livemode: false, url: `http://127.0.0.1:${port}/hook`, secret });

  const inv = await createInvoice(d, "mer_test", false, { amountCents: 4900, description: "Beans", reference: "order_1" });
  assert.equal(inv.status, "open");

  const { invoice: started, attempt } = await startPayment(d, inv.id);
  assert.equal(started.status, "awaiting_payment");
  assert.match(attempt.depositAddress, /^t1/);
  assert.equal(attempt.amountOutBase, "49000000");
  // 49 USD at the 40 USD test price plus 0.5% spread
  assert.equal(attempt.amountInFormatted, "1.231125");

  // Reuses the live quote
  const again = await startPayment(d, inv.id);
  assert.equal(again.attempt.id, attempt.id);

  // Bad refund address is rejected
  await assert.rejects(startPayment(d, inv.id, { refundAddress: "zs1nope" }), /transparent Zcash address/);

  await simulatePayment(d, (await getInvoice(d, inv.id))!, "paid_out");
  let cur = (await getInvoice(d, inv.id))!;
  assert.equal(cur.status, "payment_received");

  // Fast-forward the simulation
  const [a] = await d.select().from(paymentAttempts).where(eq(paymentAttempts.id, attempt.id));
  const raw = a.raw as { sim: { outcome: string; startedAt: number } };
  await d.update(paymentAttempts).set({ raw: { ...raw, sim: { ...raw.sim, startedAt: Date.now() - 20_000 } }, lastSyncedAt: null }).where(eq(paymentAttempts.id, attempt.id));
  cur = await syncInvoice(d, cur, { force: true });
  assert.equal(cur.status, "paid_out");
  assert.ok(cur.paidOutAt);

  // Terminal: further syncs are no-ops, cancel is refused
  assert.equal((await syncInvoice(d, cur, { force: true })).status, "paid_out");
  await assert.rejects(cancelInvoice(d, cur), /Only invoices/);

  await sleep(300);
  await deliverDue(d);
  await sleep(200);
  const types = received.map((r) => JSON.parse(r.body).type);
  assert.deepEqual(types.sort(), ["invoice.paid_out", "invoice.payment_received"]);
  for (const r of received) assert.ok(verifySignature(secret, r.sig, r.body), "signature verifies");
  assert.ok(!verifySignature("whsec_wrong", received[0].sig, received[0].body));

  const deliveries = await d.select().from(webhookDeliveries);
  assert.ok(deliveries.every((x) => x.status === "succeeded"));

  server.close();
});

test("underpaid then refunded, and expiry", async () => {
  const d = await db();
  const inv = await createInvoice(d, "mer_test", false, { amountCents: 1000, description: "Mug" });
  await startPayment(d, inv.id);
  await simulatePayment(d, (await getInvoice(d, inv.id))!, "underpaid");
  const [a] = await d.select().from(paymentAttempts).where(eq(paymentAttempts.invoiceId, inv.id));
  const raw = a.raw as { sim: { outcome: string; startedAt: number } };
  await d.update(paymentAttempts).set({ raw: { ...raw, sim: { ...raw.sim, startedAt: Date.now() - 20_000 } }, lastSyncedAt: null }).where(eq(paymentAttempts.id, a.id));
  const cur = await syncInvoice(d, (await getInvoice(d, inv.id))!, { force: true });
  assert.equal(cur.status, "underpaid");

  const old = await createInvoice(d, "mer_test", false, { amountCents: 1000, description: "Old", expiresInMinutes: 15 });
  const { invoices } = await import("../src/db/schema");
  await d.update(invoices).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invoices.id, old.id));
  const expired = await syncInvoice(d, (await getInvoice(d, old.id))!);
  assert.equal(expired.status, "expired");
});
