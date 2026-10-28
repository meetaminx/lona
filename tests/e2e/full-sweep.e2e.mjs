// Full functional sweep of Lona in test mode: merchant onboarding, invoices and every payment
// outcome, payment links, settlement, settings, developer API, webhooks, live-mode gating,
// account recovery and public pages.
//
// Run against a local production build started with:
//   ALLOW_PRIVATE_WEBHOOKS=1 CRON_SECRET=sweep DATABASE_URL=pglite://.data/sweep npm start > .data/sweep.log 2>&1
// then:
//   BASE_URL=http://localhost:3000 SERVER_LOG=.data/sweep.log node tests/e2e/full-sweep.e2e.mjs
// Emails are read from the server log, so run without RESEND_API_KEY.
import { createRequire } from "node:module";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const LOG = process.env.SERVER_LOG ?? ".data/sweep.log";
const CRON = process.env.CRON_SECRET ?? "sweep";
const stamp = Date.now();
const email = `merchant${stamp}@sweep.example`;
let password = "first-password-1";
const results = [];
let section = "";
const check = (name, ok, note = "") => {
  results.push({ section, name, ok: !!ok, note: String(note).slice(0, 160) });
  return !!ok;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = () => readFileSync(LOG, "utf8");
function lastLink(path) {
  const m = [...log().matchAll(new RegExp(`https?://[^\\s"]+${path}\\?token=[a-z0-9]+`, "g"))];
  return m.length ? m[m.length - 1][0].replace(/^https?:\/\/[^/]+/, base) : null;
}
async function until(fn, ms = 20000, every = 500) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(every);
  }
}

// ---------- local webhook receiver ----------
const hooks = [];
let failNext = 0;
const receiver = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    hooks.push({ headers: req.headers, body, at: Date.now() });
    if (failNext > 0) {
      failNext--;
      res.writeHead(500).end("nope");
    } else res.writeHead(200).end("ok");
  });
});
await new Promise((r) => receiver.listen(4555, "127.0.0.1", r));
const hookUrl = "http://127.0.0.1:4555/lona";
function verify(secret, header, body) {
  const parts = Object.fromEntries(String(header).split(",").map((p) => p.split("=")));
  const expected = createHmac("sha256", secret).update(`${parts.t}.${body}`).digest();
  const given = Buffer.from(parts.v1 ?? "", "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const p = await ctx.newPage();
const pageErrors = [];
p.on("pageerror", (e) => pageErrors.push(e.message));
const go = async (path) => {
  const r = await p.goto(base + path);
  await p.waitForLoadState("networkidle").catch(() => {});
  return r;
};
const text = (sel) => p.locator(sel).first().innerText().catch(() => "");
const bodyText = () => p.locator("body").innerText();

// ======================= Onboarding =======================
section = "Onboarding";
await go("/signup");
await p.fill("#businessName", "Sweep Coffee");
await p.fill("#email", email);
await p.fill("#password", password);
await p.click("button:has-text('Create account')");
check("Sign up and land on the dashboard", await p.waitForURL(/\/dashboard$/, { timeout: 15000 }).then(() => true, () => false));
check("Dashboard shows the setup checklist", /Get ready to take payments/i.test(await bodyText()));
check("Starts in test mode", /Test mode/i.test(await bodyText()));
check("Confirmation email was sent", !!lastLink("/verify"), "read from server log");

// ======================= Settlement =======================
section = "Settlement";
await go("/dashboard/invoices/new");
await p.fill("#amount", "10.00");
await p.fill("#description", "Before wallet");
await p.click("button:has-text('Create invoice')");
await sleep(800);
check("Invoice creation is blocked until a wallet is set", /payout wallet|Settlement/i.test(await bodyText()) && !/invoices\/inv_/.test(p.url()));
await go("/dashboard/settlement");
await p.selectOption("select[name=assetKey]", "usdc-base");
await p.fill("#payoutAddress", "0x123");
await p.fill("#refundAddress", "t1Rv4exT7bqhZqi2j7xz8bUHDMxwosrjADU");
await p.click("button:has-text('Save payout settings')");
await sleep(800);
check("Rejects an invalid Base address", /not a Base address|0x/i.test(await bodyText()));
await p.fill("#payoutAddress", "0x4E9a2c71B3d58F0e6A1c47D2b9E5f803C6a7D1e2");
await p.fill("#refundAddress", "zs1notatransparentaddress");
await p.click("button:has-text('Save payout settings')");
await sleep(800);
check("Rejects a shielded refund address", /t1|t3|transparent/i.test(await bodyText()));
await p.fill("#refundAddress", "t1Rv4exT7bqhZqi2j7xz8bUHDMxwosrjADU");
await p.click("button:has-text('Save payout settings')");
await sleep(800);
check("Saves a valid payout wallet", /Saved/i.test(await bodyText()));
for (const key of ["usdc-arbitrum", "usdc-ethereum", "usdt-ethereum"]) {
  await p.selectOption("select[name=assetKey]", key);
  await p.fill("#payoutAddress", "0x4E9a2c71B3d58F0e6A1c47D2b9E5f803C6a7D1e2");
  await p.click("button:has-text('Save payout settings')");
  await sleep(600);
  check(`Accepts ${key}`, /Saved/i.test(await bodyText()));
}
await p.selectOption("select[name=assetKey]", "usdc-solana");
await p.fill("#payoutAddress", "0x4E9a2c71B3d58F0e6A1c47D2b9E5f803C6a7D1e2");
await p.click("button:has-text('Save payout settings')");
await sleep(600);
check("Rejects an EVM address for Solana", !/Saved\./.test(await text(".notice-ok, [role=status]")) || /Solana/i.test(await bodyText()));
await p.fill("#payoutAddress", "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV");
await p.click("button:has-text('Save payout settings')");
await sleep(600);
check("Accepts a Solana address", /Saved/i.test(await bodyText()));
await p.selectOption("select[name=assetKey]", "usdc-base");
await p.fill("#payoutAddress", "0x4E9a2c71B3d58F0e6A1c47D2b9E5f803C6a7D1e2");
await p.click("button:has-text('Save payout settings')");
await sleep(600);

// ======================= Settings =======================
section = "Settings";
await go("/dashboard/settings");
await p.fill("#defaultSuccessUrl", "not a url");
await p.click("button:has-text('Save profile')");
await sleep(700);
check("Rejects an invalid success URL", /valid|https/i.test(await bodyText()));
await p.fill("#supportEmail", "help@sweep.example");
await p.fill("#defaultSuccessUrl", "https://sweep.example/thanks");
const receipts = p.locator("input[name=sendReceipts]");
if (!(await receipts.isChecked())) await receipts.check();
await p.click("button:has-text('Save profile')");
await sleep(700);
check("Saves business profile, support email and receipts", /Saved/i.test(await bodyText()));
await p.fill("#current", "wrong-password-x");
await p.fill("#next", "second-password-2");
await p.click("button:has-text('Change password')");
await sleep(900);
check("Password change refuses a wrong current password", /current password|incorrect|match/i.test(await bodyText()));
await p.fill("#current", password);
await p.fill("#next", "second-password-2");
await p.click("button:has-text('Change password')");
await sleep(900);
const changed = /changed|updated|Saved/i.test(await bodyText());
check("Password change works", changed);
if (changed) password = "second-password-2";
// Live mode is gated until email is confirmed
await p.click("form.mode-switch button[value=live]");
await sleep(900);
check("Live mode refused before email is confirmed", !(await p.locator("form.mode-switch button[value=live][aria-pressed=true]").count()));
const verifyUrl = lastLink("/verify");
await go(verifyUrl.replace(base, ""));
check("Email confirmation link works", /confirmed|verified|thanks/i.test(await bodyText()));
await go("/dashboard/settings");
check("Settings shows live payments as ready", /Ready/.test(await bodyText()));

// ======================= Invoices and payment outcomes =======================
section = "Invoices";
await go("/dashboard/invoices/new");
await p.fill("#amount", "49.00");
await p.fill("#description", "Annual plan");
await p.fill("#reference", "order_1001");
await p.fill("#customerEmail", "customer@sweep.example");
await Promise.all([p.waitForURL(/invoices\/inv_/), p.click("button:has-text('Create invoice')")]);
const inv1 = p.url().split("/").pop();
check("Create invoice from the dashboard", inv1.startsWith("inv_"), inv1);
check("Invoice page shows amount, status and checkout link", /49/.test(await bodyText()) && /Open/.test(await bodyText()) && /\/pay\/inv_/.test(await bodyText()));

// Customer checkout, paid in full
const cust = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const c = await cust.newPage();
c.on("pageerror", (e) => pageErrors.push("checkout: " + e.message));
await c.goto(`${base}/pay/${inv1}`);
check("Checkout loads for the customer", /Pay with Zcash/i.test(await c.locator("body").innerText()));
await c.click("button:has-text('Get payment details')");
await c.waitForSelector(".pay-zec", { timeout: 15000 });
const zec = Number((await c.locator(".pay-zec").innerText()).replace(/[^0-9.]/g, ""));
const usdLine = await c.locator(".pay-usd").innerText().catch(() => "");
check("Checkout shows ZEC amount, address, QR and dollar value", zec > 0 && /\$49\.00/.test(usdLine) && (await c.locator(".qr-box svg, .qr-box").count()) > 0, `${zec} ZEC; ${usdLine}`);
check("Price hold countdown runs", /Price held for/i.test(await c.locator("body").innerText()));
await c.click("button:has-text('Pay in full')");
const paidText = await until(async () => /Paid/.test(await c.locator(".pay-title, h1, h2").allInnerTexts().then((a) => a.join(" "))) && (await c.locator(".receipt").count()) > 0, 30000);
check("Checkout reaches Paid with a receipt", !!paidText);
check("Success URL button returns to the merchant", (await c.locator("a:has-text('Return to')").getAttribute("href").catch(() => "")) === "https://sweep.example/thanks");
await go(`/dashboard/invoices/${inv1}`);
check("Merchant sees Paid out with full timeline", /Paid out/.test(await bodyText()) && /Paid out to your wallet/.test(await bodyText()));
check("Customer receipt email sent", /\[mail:not-sent\] to=customer@sweep\.example[^\n]*/i.test(log()));

// Other outcomes through the public checkout API
async function outcome(kind) {
  await go("/dashboard/invoices/new");
  await p.fill("#amount", "20.00");
  await p.fill("#description", `Outcome ${kind}`);
  await Promise.all([p.waitForURL(/invoices\/inv_/), p.click("button:has-text('Create invoice')")]);
  const id = p.url().split("/").pop();
  const start = await fetch(`${base}/api/pay/${id}/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const sim = await fetch(`${base}/api/pay/${id}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: kind }) });
  const final = await until(async () => {
    const j = await (await fetch(`${base}/api/pay/${id}`)).json();
    return ["paid_out", "underpaid", "refunded", "failed"].includes(j.status) && (kind !== "underpaid" || j.status !== "awaiting_payment") ? j.status : null;
  }, 30000);
  return { id, start: start.status, sim: sim.status, final };
}
for (const [kind, want] of [["underpaid", /underpaid|refunded/], ["refunded", /refunded/], ["failed", /failed/]]) {
  const r = await outcome(kind);
  check(`Payment outcome: ${kind}`, r.start === 200 && r.sim === 200 && want.test(r.final ?? ""), `start ${r.start}, simulate ${r.sim}, final ${r.final}`);
}

// Cancel
await go("/dashboard/invoices/new");
await p.fill("#amount", "15.00");
await p.fill("#description", "To cancel");
await Promise.all([p.waitForURL(/invoices\/inv_/), p.click("button:has-text('Create invoice')")]);
const invCancel = p.url().split("/").pop();
p.once("dialog", (d) => d.accept());
await p.click("button:has-text('Cancel invoice')");
await sleep(1200);
await go(`/dashboard/invoices/${invCancel}`);
check("Cancel an invoice", /Canceled/i.test(await bodyText()));
const afterCancel = await fetch(`${base}/api/pay/${invCancel}/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
check("Canceled invoice refuses payment", afterCancel.status === 409, afterCancel.status);

// List, filters, search, export
await go("/dashboard/invoices");
const listText = await bodyText();
check("Invoice list shows all invoices", (listText.match(/inv_/g) ?? []).length >= 5 || /Annual plan/.test(listText));
for (const f of ["paid", "open", "attention"]) {
  const r = await go(`/dashboard/invoices?filter=${f}`);
  check(`Filter "${f}" loads`, r?.status() === 200);
}
await go("/dashboard/invoices?q=Annual");
check("Search finds an invoice by description", /Annual plan/.test(await bodyText()) && !/To cancel/.test(await bodyText()));
const csv = await p.request.get(`${base}/dashboard/invoices/export`);
const csvText = await csv.text();
check("CSV export downloads with a header and rows", csv.status() === 200 && /^id,|^"?id"?,/m.test(csvText) && csvText.trim().split("\n").length >= 6, `${csvText.trim().split("\n").length} lines`);

// ======================= Payment links =======================
section = "Payment links";
await go("/dashboard/links");
await p.fill("#title", "Cupping class");
await p.fill("#link-amount", "25.00");
await p.click("button:has-text('Create payment link')");
await sleep(1000);
const linkUrl = await p.locator("a[href*='/l/']").first().getAttribute("href");
check("Create a payment link", !!linkUrl, linkUrl);
const slug = linkUrl.split("/l/")[1];
const lp = await cust.newPage();
await lp.goto(`${base}/l/${slug}`);
check("Public link page shows title and amount", /Cupping class/.test(await lp.locator("body").innerText()) && /25/.test(await lp.locator("body").innerText()));
await Promise.all([lp.waitForURL(/\/pay\/inv_/, { timeout: 15000 }), lp.click("button:has-text('Continue to payment')")]);
const linkInv1 = lp.url().split("/pay/")[1];
await lp.goto(`${base}/l/${slug}`);
await Promise.all([lp.waitForURL(/\/pay\/inv_/, { timeout: 15000 }), lp.click("button:has-text('Continue to payment')")]);
const linkInv2 = lp.url().split("/pay/")[1];
check("Each visit opens its own invoice", linkInv1 && linkInv2 && linkInv1 !== linkInv2, `${linkInv1} / ${linkInv2}`);
await p.reload();
await p.click("button:has-text('Turn off')");
await sleep(900);
await lp.goto(`${base}/l/${slug}`);
check("Turned-off link refuses payment", /turned off/i.test(await lp.locator("body").innerText()));
await go("/dashboard/links");
await p.click("button:has-text('Turn on')");
await sleep(900);
await lp.goto(`${base}/l/${slug}`);
check("Link can be turned back on", /Continue to payment/.test(await lp.locator("body").innerText()));

// ======================= Developers: keys and API =======================
section = "Developer API";
await go("/dashboard/developers");
await p.fill("#key-name", "Sweep server");
await p.click("button:has-text('Create test key')");
await p.waitForSelector(".secret-box code", { timeout: 10000 });
const sk = (await text(".secret-box code")).trim();
check("Create a test secret key, shown once", /^lona_sk_test_/.test(sk), sk.slice(0, 16) + "...");
await p.reload();
check("Secret is not shown again after reload", !(await bodyText()).includes(sk));
const api = (path, opts = {}) =>
  fetch(base + path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.auth === false ? {} : { Authorization: `Bearer ${opts.key ?? sk}` }), ...(opts.headers ?? {}) } });
let r = await api("/api/v1/invoices", { auth: false });
check("API refuses requests without a key", r.status === 401 && /json/.test(r.headers.get("content-type") ?? ""), r.status);
r = await api("/api/v1/invoices", { key: "lona_sk_test_wrong" });
check("API refuses a wrong key", r.status === 401, r.status);
r = await api("/api/v1/invoices", { method: "POST", headers: { "Idempotency-Key": "order_2001" }, body: JSON.stringify({ amount: "75.50", description: "API order", reference: "order_2001", metadata: { cart: "c_1" } }) });
const created = await r.json();
check("POST /v1/invoices creates an invoice", r.status === 201 && created.id?.startsWith("inv_") && created.amount === "75.50" && created.hosted_url, `${r.status} ${created.id}`);
check("Rate limit headers are present", r.headers.get("x-ratelimit-limit") && r.headers.get("x-ratelimit-remaining"));
r = await api("/api/v1/invoices", { method: "POST", headers: { "Idempotency-Key": "order_2001" }, body: JSON.stringify({ amount: "75.50", description: "API order", reference: "order_2001", metadata: { cart: "c_1" } }) });
const replay = await r.json();
check("Idempotent retry returns the same invoice", replay.id === created.id && r.headers.get("idempotent-replayed") === "true", `${replay.id} replayed=${r.headers.get("idempotent-replayed")}`);
r = await api("/api/v1/invoices", { method: "POST", headers: { "Idempotency-Key": "order_2001" }, body: JSON.stringify({ amount: "1.00", description: "Different" }) });
check("Reusing a key with a different body is refused", r.status === 422, r.status);
r = await api("/api/v1/invoices", { method: "POST", body: JSON.stringify({ amount: "0.50", description: "Too small" }) });
const bad = await r.json();
check("Invalid amount gives a clear 400", r.status === 400 && bad.error?.message, bad.error?.message);
r = await api(`/api/v1/invoices/${created.id}`);
const got = await r.json();
check("GET /v1/invoices/:id", r.status === 200 && got.id === created.id && got.reference === "order_2001", r.status);
r = await api("/api/v1/invoices?limit=2");
const page1 = await r.json();
check("GET /v1/invoices lists with paging", r.status === 200 && Array.isArray(page1.data) && page1.data.length === 2 && "has_more" in page1, `${page1.data?.length} items, has_more=${page1.has_more}`);
if (page1.has_more && page1.next_cursor) {
  r = await api(`/api/v1/invoices?limit=2&starting_after=${page1.next_cursor}`);
  const page2 = await r.json();
  check("Next page has different invoices", page2.data?.length && page2.data[0].id !== page1.data[0].id);
}
r = await api(`/api/v1/invoices/${created.id}/cancel`, { method: "POST" });
const canceled = await r.json();
check("POST /v1/invoices/:id/cancel", r.status === 200 && canceled.status === "canceled", `${r.status} ${canceled.status}`);
r = await api("/api/v1/payment_links", { method: "POST", body: JSON.stringify({ title: "API ticket", amount: "12.00" }) });
const link = await r.json();
check("POST /v1/payment_links", r.status === 201 && /\/l\//.test(link.url ?? ""), `${r.status} ${link.url}`);
r = await api("/api/v1/invoices/inv_doesnotexist");
check("Unknown invoice gives 404", r.status === 404, r.status);

// ======================= Developers: webhooks =======================
section = "Webhooks";
await go("/dashboard/developers");
await p.fill("#hook-url", hookUrl);
await p.click("button:has-text('Add endpoint')");
await p.waitForSelector(".secret-box code", { timeout: 10000 });
let whsec = (await text(".secret-box code")).trim();
check("Add a webhook endpoint and get its signing secret", whsec.length > 20, whsec.slice(0, 10) + "...");
const before = hooks.length;
await p.click("button:has-text('Send test event')");
const testHook = await until(async () => hooks.length > before && hooks[hooks.length - 1]);
check("Test event arrives", !!testHook);
check("Test event signature verifies", testHook && verify(whsec, testHook.headers["lona-signature"], testHook.body));
// A real payment fires real events
const before2 = hooks.length;
r = await api("/api/v1/invoices", { method: "POST", body: JSON.stringify({ amount: "30.00", description: "Webhook order" }) });
const whInv = await r.json();
await fetch(`${base}/api/pay/${whInv.id}/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
await fetch(`${base}/api/pay/${whInv.id}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "paid_out" }) });
await until(async () => (await (await fetch(`${base}/api/pay/${whInv.id}`)).json()).status === "paid_out", 30000);
const types = await until(async () => {
  const t = hooks.slice(before2).map((h) => JSON.parse(h.body).type);
  return t.includes("invoice.paid_out") ? t : null;
}, 20000);
check("invoice.payment_received and invoice.paid_out are delivered", types && types.includes("invoice.payment_received") && types.includes("invoice.paid_out"), (types ?? []).join(", "));
check("Every delivered event is signed correctly", hooks.slice(before2).every((h) => verify(whsec, h.headers["lona-signature"], h.body)));
// Failure and retry
failNext = 1;
const before3 = hooks.length;
await go("/dashboard/developers");
await p.click("button:has-text('Send test event')");
await until(async () => hooks.length > before3);
await sleep(800);
await go("/dashboard/developers");
check("Failed delivery is shown in the log", /500/.test(await bodyText()));
const retryBtn = p.locator("button:has-text('Retry now')").first();
if (await retryBtn.count()) {
  const before4 = hooks.length;
  await retryBtn.click();
  check("Retry now redelivers", !!(await until(async () => hooks.length > before4)));
} else check("Retry now redelivers", false, "no retry button");
// Roll secret
await go("/dashboard/developers");
await p.click("button:has-text('Roll secret')");
await p.waitForTimeout(1200);
const rolled = (await p.locator(".secret-box code").last().innerText().catch(() => "")).trim();
check("Roll the signing secret", rolled && rolled !== whsec);
if (rolled) whsec = rolled;
const before5 = hooks.length;
await p.click("button:has-text('Send test event')");
const afterRoll = await until(async () => hooks.length > before5 && hooks[hooks.length - 1]);
check("Events after rolling use the new secret", afterRoll && verify(whsec, afterRoll.headers["lona-signature"], afterRoll.body));
// Cron
r = await fetch(`${base}/api/cron/tick`);
check("Cron refuses requests without the secret", r.status === 401, r.status);
r = await fetch(`${base}/api/cron/tick`, { headers: { Authorization: `Bearer ${CRON}` } });
check("Cron runs with the secret", r.status === 200, r.status);
// Remove endpoint, revoke key
await go("/dashboard/developers");
await p.click("button:has-text('Remove')");
await sleep(900);
check("Remove a webhook endpoint", !(await bodyText()).includes(hookUrl));
await p.click("button:has-text('Revoke')");
await sleep(900);
r = await api("/api/v1/invoices");
check("Revoked key stops working", r.status === 401, r.status);

// ======================= Live mode =======================
section = "Live mode";
await p.click("form.mode-switch button[value=live]");
await sleep(1200);
check("Switch to live once email and wallet are set", (await p.locator("form.mode-switch button[value=live][aria-pressed=true]").count()) === 1);
await go("/dashboard/developers");
check("Developers shows live keys in live mode", /Create live key/.test(await bodyText()));
await go("/dashboard/invoices/new");
await p.fill("#amount", "5.00");
await p.fill("#description", "Live test");
await Promise.all([p.waitForURL(/invoices\/inv_/), p.click("button:has-text('Create invoice')")]);
const liveInv = p.url().split("/").pop();
const lc = await cust.newPage();
await lc.goto(`${base}/pay/${liveInv}`);
check("Live checkout has no test-mode controls", !/Test mode/.test(await lc.locator("body").innerText()));
await lc.click("button:has-text('Get payment details')");
await lc.waitForTimeout(6000);
const liveBody = await lc.locator("body").innerText();
const gotQuote = (await lc.locator(".pay-zec").count()) > 0;
check(
  "Live quote either arrives or fails with a clear message",
  gotQuote || /could not|unavailable|try again/i.test(liveBody),
  gotQuote ? "quote received from NEAR Intents" : (liveBody.match(/[^\n]*(could not|unavailable|try again)[^\n]*/i) ?? [""])[0],
);
await p.click("form.mode-switch button[value=test]");
await sleep(900);
check("Switch back to test", (await p.locator("form.mode-switch button[value=test][aria-pressed=true]").count()) === 1);

// ======================= Account recovery =======================
section = "Account";
await p.click("button:has-text('Log out')");
await p.waitForURL((u) => !u.pathname.startsWith("/dashboard"), { timeout: 10000 }).catch(() => {});
await go("/dashboard");
check("Log out, and the dashboard needs login again", /\/login/.test(p.url()));
await go("/login");
await p.fill("#email", email);
await p.fill("#password", "first-password-1");
await p.click("button:has-text('Log in')");
await sleep(1500);
check("Old password no longer works", !/\/dashboard/.test(p.url()));
await go("/forgot");
await p.fill("#email", "nobody@sweep.example");
await p.click("button[type=submit], form button");
await sleep(1000);
const genericMsg = await bodyText();
await go("/forgot");
await p.fill("#email", email);
await p.click("button[type=submit], form button");
await sleep(1500);
check("Forgot password gives the same answer for unknown emails", /If an account uses that email/i.test(genericMsg) && /If an account uses that email/i.test(await bodyText()));
const resetUrl = await until(async () => lastLink("/reset"));
check("Reset email is sent", !!resetUrl);
await go(resetUrl.replace(base, ""));
await p.fill("#password", "third-password-3");
await p.click("button:has-text('Save new password')");
check("Reset password logs you in", await p.waitForURL(/\/dashboard/, { timeout: 10000 }).then(() => true, () => false));
await go(resetUrl.replace(base, ""));
await p.fill("#password", "fourth-password-4");
await p.click("button:has-text('Save new password')");
await sleep(1200);
check("Reset link works only once", /expired|already used/i.test(await bodyText()));

// ======================= Public pages =======================
section = "Public pages";
for (const path of ["/", "/docs", "/privacy", "/terms", "/signup", "/login", "/forgot"]) {
  const res = await fetch(base + path);
  check(`${path} loads`, res.status === 200, res.status);
}
let res = await fetch(base + "/this-page-does-not-exist");
check("Unknown page returns 404", res.status === 404, res.status);
res = await fetch(base + "/pay/inv_doesnotexist");
check("Unknown checkout returns 404", res.status === 404, res.status);
check("No JavaScript errors in the browser", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));

await browser.close();
receiver.close();

let failed = 0;
let current = "";
for (const r of results) {
  if (r.section !== current) console.log(`\n${(current = r.section)}`);
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.note ? `  (${r.note})` : ""}`);
}
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
