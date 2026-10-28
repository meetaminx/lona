// Full product walk-through in test mode: every merchant feature, the public API and webhooks.
// Start a build with:  ALLOW_PRIVATE_WEBHOOKS=1 CRON_SECRET=e2e-cron SANDBOX_ZEC_USD=1300 npm start
// Then:  BASE_URL=http://localhost:3000 SERVER_LOG=/path/to/server.log node tests/e2e/full-product.e2e.mjs
import { createRequire } from "node:module";
import { createHmac, timingSafeEqual } from "node:crypto";
import http from "node:http";
import fs from "node:fs";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const serverLog = process.env.SERVER_LOG;
const cronSecret = process.env.CRON_SECRET ?? "e2e-cron";
const stamp = Date.now();
const email = `merchant${stamp}@e2e.example`;
let password = "first-password-1";

const results = [];
let section = "";
const check = (name, ok, note = "") => {
  results.push({ section, name, ok: !!ok, note: String(note ?? "").slice(0, 160) });
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- webhook receiver ---------- */
const received = [];
const receiver = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    received.push({ path: req.url, sig: req.headers["lona-signature"], body, at: Date.now() });
    res.writeHead(200).end("ok");
  });
});
await new Promise((r) => receiver.listen(4555, "127.0.0.1", r));
function verify(secret, header, body) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = createHmac("sha256", secret).update(`${parts.t}.${body}`).digest();
  const given = Buffer.from(parts.v1 ?? "", "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message));
const notice = async () => ((await page.locator(".notice[role=alert], .notice-error, .notice-ok, [role=status]").allInnerTexts()).join(" | ")).trim();
const go = async (path) => {
  const r = await page.goto(base + path);
  await page.waitForLoadState("networkidle").catch(() => {});
  return r;
};
async function run(name, fn) {
  section = name;
  try {
    await fn();
  } catch (e) {
    check("section finished without crashing", false, e.message.split("\n")[0]);
  }
}
async function poll(id, until, ms = 30000) {
  const t = Date.now();
  let last;
  while (Date.now() - t < ms) {
    last = await (await page.request.get(`${base}/api/pay/${id}`)).json();
    if (until.includes(last.status)) return last;
    await sleep(1500);
  }
  return last;
}
async function newInvoice(amount, description) {
  await go("/dashboard/invoices/new");
  await page.fill("#amount", amount);
  await page.fill("#description", description);
  await Promise.all([page.waitForURL(/invoices\/inv_/, { timeout: 15000 }), page.click("button:has-text('Create invoice')")]);
  return page.url().split("/").pop();
}

/* ---------- 1. public pages ---------- */
await run("Public pages", async () => {
  for (const p of ["/", "/docs", "/privacy", "/terms", "/login", "/signup", "/forgot"]) {
    const r = await go(p);
    check(`${p} loads`, r.status() === 200, r.status());
  }
  check("No script errors on public pages", consoleErrors.length === 0, consoleErrors[0]);
});

/* ---------- 2. account ---------- */
await run("Account", async () => {
  await go("/signup");
  await page.fill("#businessName", "Harbor Goods");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button:has-text('Create account')");
  check("Sign up lands on the dashboard", await page.waitForURL(/\/dashboard$/, { timeout: 15000 }).then(() => true, () => false));
  const body = await page.locator("main").innerText();
  check("Overview shows the setup checklist", /Get ready to take payments/i.test(body));
  check("New accounts start in test mode", /test mode/i.test(body));
});

/* ---------- 3. payout wallet ---------- */
await run("Settlement", async () => {
  await newInvoiceBlocked();
  await go("/dashboard/settlement");
  await page.selectOption("select[name=assetKey]", "usdc-base");
  await page.fill("#payoutAddress", "0x123");
  await page.fill("#refundAddress", "t1Rv4exT7bqhZqi2j7xz8bUHDMxwosrjADU");
  await page.click("button:has-text('Save payout settings')");
  await sleep(800);
  check("Bad wallet address is refused", /not a base address|starts? with 0x|42 characters/i.test(await notice()), await notice());
  await page.fill("#payoutAddress", "0x4E9a2c71B3d58F0e6A1c47D2b9E5f803C6a7D1e2");
  await page.fill("#refundAddress", "zs1notatransparentaddress");
  await page.click("button:has-text('Save payout settings')");
  await sleep(800);
  check("Shielded refund address is refused", /t1|t3|transparent/i.test(await notice()), await notice());
  await page.fill("#refundAddress", "t1Rv4exT7bqhZqi2j7xz8bUHDMxwosrjADU");
  await page.click("button:has-text('Save payout settings')");
  await sleep(800);
  check("Valid wallet saves", /saved/i.test(await notice()), await notice());
  await page.selectOption("select[name=assetKey]", "usdc-solana");
  await page.click("button:has-text('Save payout settings')");
  await sleep(800);
  check("Solana payout refuses an Ethereum-style address", !/saved/i.test(await notice()), await notice());
  await page.selectOption("select[name=assetKey]", "usdc-base");
  await page.fill("#payoutAddress", "0x4E9a2c71B3d58F0e6A1c47D2b9E5f803C6a7D1e2");
  await page.click("button:has-text('Save payout settings')");
  await sleep(800);
});
async function newInvoiceBlocked() {
  await go("/dashboard/invoices/new");
  const text = await notice();
  check("Invoices need a payout wallet first", /set your payout wallet/i.test(text) && (await page.locator("button:has-text('Create invoice')").isDisabled()), text);
}

/* ---------- 4. invoices ---------- */
let paidId, cancelId;
await run("Invoices", async () => {
  await go("/dashboard/invoices/new");
  for (const [amt, why] of [["0.50", "under $1"], ["abc", "not a number"], ["200000", "over $100,000"]]) {
    await page.fill("#amount", amt);
    await page.fill("#description", "Bad amount");
    await page.click("button:has-text('Create invoice')");
    await sleep(700);
    check(`Amount ${why} is refused`, page.url().endsWith("/new") && (await notice()).length > 0, await notice());
  }
  paidId = await newInvoice("128.00", "Oak side table");
  const detail = await page.locator("main").innerText();
  check("Invoice page shows amount and status", /\$128/.test(detail) && /Open/i.test(detail));
  check("Invoice page shows the checkout link", detail.includes(`/pay/${paidId}`));
  cancelId = await newInvoice("40.00", "Linen napkins");
  page.once("dialog", (d) => d.accept());
  await page.click("button:has-text('Cancel invoice')");
  await sleep(1200);
  await page.reload();
  check("Cancel invoice works", /canceled/i.test(await page.locator("main").innerText()));
  await go(`/pay/${cancelId}`);
  check("Canceled checkout tells the customer", /canceled/i.test(await page.locator("main").innerText()));
});

/* ---------- 5. checkout outcomes ---------- */
const outcomes = {};
await run("Checkout outcomes", async () => {
  const plan = [
    ["paid_out", "Pay in full", ["paid_out"], paidId],
    ["underpaid", "Underpay", ["underpaid", "refunded"], null],
    ["refunded", "Refund", ["refunded"], null],
    ["failed", "Fail", ["failed"], null],
  ];
  for (const [key, button, terminal, existing] of plan) {
    const id = existing ?? (await newInvoice("25.00", `Outcome ${key}`));
    outcomes[key] = id;
    await go(`/pay/${id}`);
    await page.click("button:has-text('Get payment details')");
    await page.waitForSelector(".pay-zec", { timeout: 15000 });
    if (key === "paid_out") {
      const zec = Number((await page.locator(".pay-zec").innerText()).replace(/[^0-9.]/g, ""));
      check("Quote is right for $128 at the test price", Math.abs(zec * 1300 - 128 * 1.005) < 0.05, `${zec} ZEC`);
      check("QR code and wallet button are shown", (await page.locator(".qr-box svg, .qr-box").count()) > 0 && (await page.locator("a[href^='zcash:']").count()) === 1);
      const again = await (await page.request.post(`${base}/api/pay/${id}/start`, { data: {} })).json();
      check("Reopening checkout keeps the same price", again.payment?.zecAmount && Number(again.payment.zecAmount) === zec, again.payment?.zecAmount);
    }
    await page.click(`.sandbox-box button:has-text('${button}')`);
    const final = await poll(id, terminal, 40000);
    check(`"${button}" ends as ${terminal.join(" or ")}`, terminal.includes(final?.status), final?.status);
  }
  await go(`/pay/${outcomes.paid_out}`);
  const receipt = await page.locator(".checkout-pay").innerText();
  check("Paid checkout shows a receipt", /You paid/i.test(receipt) && /128\.00 USDC/.test(receipt));
  await go(`/dashboard/invoices/${outcomes.paid_out}`);
  const tl = await page.locator("main").innerText();
  check("Invoice timeline records every step", /Invoice created/.test(tl) && /Payment received/.test(tl) && /Paid out to your wallet/.test(tl));
});

/* ---------- 6. invoice list, search, filters, export ---------- */
await run("Invoice list", async () => {
  await go("/dashboard/invoices?q=Oak");
  let t = await page.locator("main").innerText();
  check("Search finds by description", /Oak side table/.test(t) && !/Linen napkins/.test(t));
  await go("/dashboard/invoices?filter=paid");
  t = await page.locator("main").innerText();
  check("Paid out filter", /Oak side table/.test(t) && !/Outcome failed/.test(t));
  await go("/dashboard/invoices?filter=attention");
  t = await page.locator("main").innerText();
  check("Need attention filter", /Outcome failed/.test(t) && !/Oak side table/.test(t));
  await go("/dashboard/invoices?filter=closed");
  check("Expired or canceled filter", /Linen napkins/.test(await page.locator("main").innerText()));
  const csv = await (await page.request.get(`${base}/dashboard/invoices/export`)).text();
  check("CSV export includes invoices", csv.split("\n")[0].includes("id") && csv.includes(outcomes.paid_out), `${csv.split("\n").length - 1} rows`);
});

/* ---------- 7. payment links ---------- */
let linkUrl;
await run("Payment links", async () => {
  await go("/dashboard/links");
  await page.fill("#link-amount", "25.00");
  await page.click("button:has-text('Create payment link')");
  await sleep(800);
  check("Link without a title is refused", (await page.locator("a[href*='/l/']").count()) === 0);
  await page.fill("#title", "Pottery class");
  await page.fill("#link-amount", "25.00");
  await page.click("button:has-text('Create payment link')");
  await sleep(1200);
  await page.reload();
  linkUrl = await page.locator("a[href*='/l/']").first().getAttribute("href");
  check("Payment link is created", !!linkUrl, linkUrl);
  const p2 = await ctx.newPage();
  const ids = [];
  for (let i = 0; i < 2; i++) {
    await p2.goto(linkUrl);
    await p2.waitForLoadState("networkidle");
    const btn = p2.locator("button:has-text('Continue'), button:has-text('Pay'), a:has-text('Continue')").first();
    if (await btn.count()) await btn.click();
    await p2.waitForURL(/\/pay\/inv_/, { timeout: 15000 }).catch(() => {});
    ids.push(p2.url().split("/").pop());
  }
  check("Each visit opens its own invoice", ids[0]?.startsWith("inv_") && ids[1]?.startsWith("inv_") && ids[0] !== ids[1], ids.join(" vs "));
  check("Link invoice has the right amount", /25\.00/.test(await p2.locator("main").innerText()));
  await go("/dashboard/links");
  await page.click("button:has-text('Turn off')");
  await sleep(1000);
  await p2.goto(linkUrl);
  check("Turned-off link stops taking payments", /not available|turned off|no longer|inactive/i.test(await p2.locator("main").innerText()));
  await go("/dashboard/links");
  await page.click("button:has-text('Turn on')");
  await sleep(800);
  await p2.close();
});

/* ---------- 8. API keys and REST API ---------- */
let apiKey;
await run("API", async () => {
  await go("/dashboard/developers");
  await page.fill("#key-name", "E2E server");
  await page.click("button:has-text('Create test key')");
  await page.waitForSelector(".secret-box code", { timeout: 10000 });
  apiKey = (await page.locator(".secret-box code").first().innerText()).trim();
  check("Test key is created and shown once", apiKey.startsWith("lona_sk_test_"), apiKey.slice(0, 16));
  await page.reload();
  check("Key is not shown again after reload", (await page.locator(".secret-box").count()) === 0);
  const api = (path, opts = {}) => page.request.fetch(`${base}/api${path}`, { ...opts, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(opts.headers ?? {}) } });
  const noAuth = await page.request.get(`${base}/api/v1/invoices`);
  check("No key gives 401", noAuth.status() === 401);
  const body = { amount: "49.00", description: "API order", reference: "order_7" };
  const r1 = await api("/v1/invoices", { method: "POST", data: body, headers: { "Idempotency-Key": `k${stamp}` } });
  const j1 = await r1.json();
  check("Create invoice returns 201", r1.status() === 201 && j1.id?.startsWith("inv_"), r1.status());
  check("Rate limit headers are sent", !!r1.headers()["x-ratelimit-limit"], r1.headers()["x-ratelimit-limit"]);
  const r2 = await api("/v1/invoices", { method: "POST", data: body, headers: { "Idempotency-Key": `k${stamp}` } });
  const j2 = await r2.json();
  check("Retry with same key returns the same invoice", j2.id === j1.id && r2.headers()["idempotent-replayed"] === "true");
  const r3 = await api("/v1/invoices", { method: "POST", data: { ...body, amount: "50.00" }, headers: { "Idempotency-Key": `k${stamp}` } });
  check("Same key with a different body gives 422", r3.status() === 422, r3.status());
  const bad = await api("/v1/invoices", { method: "POST", data: { amount: "0.10" } });
  const badJ = await bad.json();
  check("Invalid amount gives a clear 400", bad.status() === 400 && !!badJ.error?.message, badJ.error?.message);
  const g = await (await api(`/v1/invoices/${j1.id}`)).json();
  check("Get invoice by id", g.id === j1.id && g.amount === "49.00" && g.reference === "order_7");
  const list = await (await api("/v1/invoices?limit=1")).json();
  check("List with paging", list.object === "list" && list.data.length === 1 && list.has_more === true);
  const next = await (await api(`/v1/invoices?limit=1&starting_after=${list.data[0].id}`)).json();
  check("Next page continues", next.data[0]?.id && next.data[0].id !== list.data[0].id);
  const c = await (await api(`/v1/invoices/${j1.id}/cancel`, { method: "POST" })).json();
  check("Cancel invoice by API", c.status === "canceled", c.status);
  const lk = await api("/v1/payment_links", { method: "POST", data: { title: "API link", amount: "12.00" } });
  const lkJ = await lk.json();
  check("Create payment link by API", lk.status() === 201 && !!lkJ.url, lk.status());
  const lks = await (await api("/v1/payment_links")).json();
  check("List payment links by API", lks.data?.length >= 2, lks.data?.length);
  const missing = await api("/v1/invoices/inv_doesnotexist");
  check("Unknown invoice gives 404", missing.status() === 404, missing.status());
});

/* ---------- 9. webhooks ---------- */
await run("Webhooks", async () => {
  await go("/dashboard/developers");
  await page.fill("#hook-url", "http://127.0.0.1:4555/lona");
  await page.click("button:has-text('Add endpoint')");
  await page.waitForSelector(".secret-box code", { timeout: 10000 });
  const secret = (await page.locator(".secret-box code").first().innerText()).trim();
  check("Endpoint is added with a signing secret", secret.startsWith("whsec_"));
  await page.reload();
  const before = received.length;
  await page.click("button:has-text('Send test event')");
  await sleep(2500);
  const test = received.slice(before).find((r) => /test/i.test(r.body));
  check("Test event arrives", !!test, `${received.length - before} requests`);
  check("Test event signature verifies", test && verify(secret, test.sig, test.body));
  const startCount = received.length;
  const id = await newInvoice("60.00", "Webhook order");
  await go(`/pay/${id}`);
  await page.click("button:has-text('Get payment details')");
  await page.waitForSelector(".pay-zec");
  await page.click(".sandbox-box button:has-text('Pay in full')");
  await poll(id, ["paid_out"], 40000);
  await sleep(2500);
  const events = received.slice(startCount).map((r) => ({ ...r, json: JSON.parse(r.body) }));
  const types = events.map((e) => e.json.type);
  check("invoice.payment_received is delivered", types.includes("invoice.payment_received"), types.join(", "));
  check("invoice.paid_out is delivered", types.includes("invoice.paid_out"), types.join(", "));
  check("Every event signature verifies", events.length > 0 && events.every((e) => verify(secret, e.sig, e.body)));
  const paidEvt = events.find((e) => e.json.type === "invoice.paid_out");
  check("Event carries the invoice", paidEvt?.json.data?.object?.id === id || paidEvt?.json.data?.id === id, JSON.stringify(paidEvt?.json.data ?? {}).slice(0, 80));
  await go("/dashboard/developers");
  const log = await page.locator("main").innerText();
  check("Delivery log lists deliveries", /200/.test(log) && log.includes(id));
  // A receiver that is down: the delivery fails, is logged, and "Retry now" re-sends once it is back.
  await page.fill("#hook-url", "http://127.0.0.1:4556/down");
  await page.click("button:has-text('Add endpoint')");
  await page.waitForSelector(".secret-box code", { timeout: 10000 });
  const downSecret = (await page.locator(".secret-box code").first().innerText()).trim();
  await page.reload();
  await page.locator(".endpoint, li, tr, div").filter({ hasText: "4556" }).locator("button:has-text('Send test event')").first().click();
  await sleep(2500);
  await page.reload();
  const retry = page.locator("button:has-text('Retry now')");
  check("Failed delivery is logged with a retry button", (await retry.count()) > 0);
  const backUp = [];
  const second = http.createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      backUp.push({ sig: req.headers["lona-signature"], body: b });
      res.writeHead(200).end("ok");
    });
  });
  await new Promise((r) => second.listen(4556, "127.0.0.1", r));
  if (await retry.count()) {
    await retry.first().click();
    await sleep(2500);
  }
  check("Retry now re-sends once the receiver is back", backUp.length > 0 && verify(downSecret, backUp[0].sig, backUp[0].body), `${backUp.length} received`);
  second.close();
});

/* ---------- 10. settings ---------- */
await run("Settings", async () => {
  await go("/dashboard/settings");
  await page.fill("#businessName", "Harbor Goods Co");
  await page.fill("#supportEmail", "help@harbor.example");
  await page.fill("#defaultSuccessUrl", "https://harbor.example/thanks");
  await page.click("button:has-text('Save profile')");
  await sleep(1000);
  check("Profile saves", /saved/i.test(await notice()), await notice());
  const id = await newInvoice("10.00", "Settings check");
  await go(`/pay/${id}`);
  check("New business name shows at checkout", /Harbor Goods Co/.test(await page.locator("main").innerText()));
  await go("/dashboard/settings");
  await page.fill("#current", "wrong-password-1");
  await page.fill("#next", "second-password-2");
  await page.click("button:has-text('Change password')");
  await sleep(1000);
  check("Wrong current password is refused", /current password|incorrect|does not match/i.test(await notice()), await notice());
  await page.fill("#current", password);
  await page.fill("#next", "second-password-2");
  await page.click("button:has-text('Change password')");
  await sleep(1200);
  check("Password change succeeds", /changed|updated/i.test(await notice()), await notice());
  password = "second-password-2";
});

/* ---------- 11. live mode gate ---------- */
await run("Live mode", async () => {
  await go("/dashboard");
  await page.click("button[name=mode][value=live]");
  await sleep(1200);
  const live = (await page.locator("button[name=mode][value=live]").getAttribute("aria-pressed")) === "true";
  check("Live mode stays locked until email is confirmed", !live, await notice());
});

/* ---------- 12. log out, log in, reset ---------- */
await run("Sign in and reset", async () => {
  await go("/dashboard");
  await page.click("button:has-text('Log out')");
  await page.waitForURL((u) => !u.pathname.startsWith("/dashboard"), { timeout: 10000 });
  await go("/dashboard");
  check("Dashboard needs a login after logging out", /\/login/.test(page.url()), page.url());
  await go("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button:has-text('Log in')");
  check("Log in with the changed password", await page.waitForURL(/\/dashboard/, { timeout: 10000 }).then(() => true, () => false));
  await page.click("button:has-text('Log out')");
  await page.waitForURL((u) => !u.pathname.startsWith("/dashboard"));
  await go("/forgot");
  await page.fill("#email", email);
  await page.click("button[type=submit], form button");
  await sleep(1500);
  check("Forgot password confirms without revealing accounts", /if an account uses that email/i.test(await notice()), await notice());
  if (serverLog) {
    const m = [...fs.readFileSync(serverLog, "utf8").matchAll(/(\/reset\?token=[a-z0-9]+)/gi)].pop();
    check("Reset email was generated", !!m);
    if (m) {
      await go(m[1]);
      await page.fill("#password", "third-password-3");
      await page.click("button:has-text('Save new password')");
      check("Reset link sets a new password and signs in", await page.waitForURL(/\/dashboard/, { timeout: 10000 }).then(() => true, () => false));
      await go(m[1]);
      check("Reset link works only once", /this link has expired/i.test(await page.locator("body").innerText()) && (await page.locator("#password").count()) === 0);
    }
  }
});

/* ---------- 13. scheduled job ---------- */
await run("Scheduled job", async () => {
  const no = await page.request.get(`${base}/api/cron/tick`);
  check("Cron refuses without the secret", no.status() === 401, no.status());
  const yes = await page.request.get(`${base}/api/cron/tick`, { headers: { Authorization: `Bearer ${cronSecret}` } });
  check("Cron runs with the secret", yes.status() === 200, yes.status());
});

section = "Overall";
check("No script errors anywhere", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" / "));

await browser.close();
receiver.close();
let failed = 0;
let current = "";
for (const r of results) {
  if (r.section !== current) {
    current = r.section;
    console.log(`\n${current}`);
  }
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.note && !r.ok ? `  (${r.note})` : r.note && r.ok ? `  [${r.note}]` : ""}`);
}
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
