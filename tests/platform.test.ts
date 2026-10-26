process.env.DATABASE_URL = "pglite://memory";
process.env.API_RATE_PER_MIN = "5";

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { invoices, merchants, settlementSettings, webhookEndpoints } from "../src/db/schema";
import { checkWebhookUrl, isPrivateAddress } from "../src/lib/net-guard";
import { consumeToken, issueToken, peekToken } from "../src/lib/tokens";
import { sendTestEvent } from "../src/lib/webhooks";
import { createInvoice } from "../src/lib/invoices";
import { sendReceipt } from "../src/lib/receipts";
import { createApiKey } from "../src/lib/auth";
import { apiPost } from "../src/lib/api";

async function seed() {
  const d = await db();
  const [existing] = await d.select().from(merchants).where(eq(merchants.id, "mer_p"));
  if (!existing) {
    await d.insert(merchants).values({ id: "mer_p", email: "p@example.com", passwordHash: "x", businessName: "Kiln Coffee" });
    await d.insert(settlementSettings).values({ merchantId: "mer_p", assetKey: "usdc-base", payoutAddress: "0x" + "b".repeat(40), refundAddress: "t1" + "c".repeat(33) });
  }
  return d;
}

test("network guard blocks private addresses", async () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1", "0.0.0.0"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isPrivateAddress(ip), false, ip);
  assert.match((await checkWebhookUrl("http://localhost:3000/hook", false))!, /public address/);
  assert.match((await checkWebhookUrl("https://169.254.169.254/latest", false))!, /private network/);
  assert.match((await checkWebhookUrl("http://8.8.8.8/hook", true))!, /https/);
  assert.match((await checkWebhookUrl("https://user:pw@8.8.8.8/hook", true))!, /username/);
  assert.equal(await checkWebhookUrl("https://8.8.8.8/hook", true), null);
  assert.match((await checkWebhookUrl("not a url", true))!, /full URL/);
});

test("tokens are single use and purpose bound", async () => {
  const d = await seed();
  const raw = await issueToken(d, "mer_p", "reset");
  assert.equal(await peekToken(d, raw, "reset"), true);
  assert.equal(await consumeToken(d, raw, "verify"), null, "wrong purpose");
  assert.equal(await consumeToken(d, raw, "reset"), "mer_p");
  assert.equal(await consumeToken(d, raw, "reset"), null, "second use");
  assert.equal(await consumeToken(d, "nope", "reset"), null);
});

test("test events are signed and reported", async () => {
  process.env.ALLOW_PRIVATE_WEBHOOKS = "1";
  const d = await seed();
  let status = 200;
  const server = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => res.writeHead(status).end());
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  await d.insert(webhookEndpoints).values({ id: "whe_t", merchantId: "mer_p", livemode: false, url: `http://127.0.0.1:${port}/`, secret: "whsec_t" });
  const ok = await sendTestEvent(d, "whe_t");
  assert.equal(ok.ok, true);
  assert.match(ok.message, /200/);
  status = 500;
  const bad = await sendTestEvent(d, "whe_t");
  assert.equal(bad.ok, false);
  assert.match(bad.message, /500/);
  server.close();
  delete process.env.ALLOW_PRIVATE_WEBHOOKS;
});

test("receipts are claimed once", async () => {
  const d = await seed();
  const inv = await createInvoice(d, "mer_p", false, { amountCents: 1000, description: "Mug", customerEmail: "c@example.com" });
  assert.equal(await sendReceipt(d, inv.id), false, "not paid yet");
  await d.update(invoices).set({ status: "paid_out", paidOutAt: new Date() }).where(eq(invoices.id, inv.id));
  await sendReceipt(d, inv.id); // no email provider in tests: logs, claims
  const [after] = await d.select().from(invoices).where(eq(invoices.id, inv.id));
  assert.ok(after.receiptSentAt);
  assert.equal(await sendReceipt(d, inv.id), false, "already sent");
});

test("idempotency replays, rejects reuse, and rate limits", async () => {
  await seed();
  const { secret } = await createApiKey("mer_p", false, "t");
  let calls = 0;
  const handler = async () => ({ status: 201, json: { n: ++calls } });
  const mk = (body: string, key?: string) =>
    new Request("http://x/api/v1/invoices", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, ...(key ? { "idempotency-key": key } : {}) },
      body,
    });

  const a = await apiPost(mk('{"a":1}', "k1"), "/v1/invoices", handler);
  assert.equal(a.status, 201);
  assert.deepEqual(await a.json(), { n: 1 });
  const b = await apiPost(mk('{"a":1}', "k1"), "/v1/invoices", handler);
  assert.equal(b.headers.get("idempotent-replayed"), "true");
  assert.deepEqual(await b.json(), { n: 1 });
  assert.equal(calls, 1, "handler not run again");
  const c = await apiPost(mk('{"a":2}', "k1"), "/v1/invoices", handler);
  assert.equal(c.status, 422);
  const bad = await apiPost(mk("{nope", "k2"), "/v1/invoices", handler);
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("x-ratelimit-limit"), "5");

  // 4 requests so far this minute; the 5th passes, the 6th is limited.
  assert.equal((await apiPost(mk("{}"), "/v1/invoices", handler)).status, 201);
  const limited = await apiPost(mk("{}"), "/v1/invoices", handler);
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"));
});
