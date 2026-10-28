// End-to-end checks for signup, login, checkout amounts and the homepage demo.
// Run against a local build:  npm run build && npm start   then:  BASE_URL=http://localhost:3000 node tests/e2e/auth-and-checkout.e2e.mjs
// Needs Playwright with Chromium installed (npx playwright install chromium).
import { createRequire } from "node:module";

// Resolved through require so a global Playwright (NODE_PATH) works as well as a local one.
const { chromium } = createRequire(import.meta.url)("playwright");

const base = process.env.BASE_URL ?? "http://localhost:3000";
const stamp = Date.now();
const results = [];
const check = (name, ok, note = "") => results.push({ name, ok: !!ok, note });

const b = await chromium.launch();
async function page(path = "/signup") {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto(base + path);
  return { ctx, p };
}
const alertText = async (p) => ((await p.locator(".notice[role=alert]").allInnerTexts())[0] ?? "").trim();
const invalid = (p, id) => p.locator(`#${id}[aria-invalid="true"]`).count();

// Signup: empty form flags every field at once
{
  const { ctx, p } = await page();
  await p.click("button:has-text('Create account')");
  const n = (await invalid(p, "businessName")) + (await invalid(p, "email")) + (await invalid(p, "password"));
  check("Empty form flags all three fields", n === 3, `${n} fields marked`);
  check("Focus moves to the first problem", (await p.evaluate(() => document.activeElement?.id)) === "businessName");
  await ctx.close();
}
// Invalid email keeps the password
{
  const { ctx, p } = await page();
  await p.fill("#businessName", "E2E Co");
  await p.fill("#email", "not-an-email");
  await p.fill("#password", "longenough123");
  await p.click("button:has-text('Create account')");
  check("Invalid email is flagged on the email field", (await invalid(p, "email")) === 1, await p.locator("#email-error").innerText().catch(() => ""));
  check("Password is kept after a failed submit", (await p.inputValue("#password")) === "longenough123");
  await ctx.close();
}
// Short password
{
  const { ctx, p } = await page();
  await p.fill("#businessName", "E2E Co");
  await p.fill("#email", `short${stamp}@e2e.example`);
  await p.fill("#password", "short");
  await p.click("button:has-text('Create account')");
  check("Password under 10 characters is refused", (await invalid(p, "password")) === 1);
  await ctx.close();
}
// Show / hide toggle
{
  const { ctx, p } = await page();
  await p.fill("#password", "secret-value-1");
  const before = await p.getAttribute("#password", "type");
  await p.click("button[aria-label='Show password']");
  const after = await p.getAttribute("#password", "type");
  await p.click("button[aria-label='Hide password']");
  const back = await p.getAttribute("#password", "type");
  check("Show/hide password toggle", before === "password" && after === "text" && back === "password", `${before} -> ${after} -> ${back}`);
  await ctx.close();
}
// Success, refresh, duplicate
const email = `owner${stamp}@e2e.example`;
let session;
{
  const { ctx, p } = await page();
  await p.fill("#businessName", "E2E Studio");
  await p.fill("#email", email);
  await p.fill("#password", "longenough123");
  await p.click("button:has-text('Create account')");
  const ok = await p.waitForURL(/\/dashboard/, { timeout: 15000 }).then(() => true, () => false);
  check("New account lands on the dashboard", ok, new URL(p.url()).pathname);
  await p.reload();
  check("Refresh keeps the session", p.url().includes("/dashboard"));
  session = ctx;
}
{
  const { ctx, p } = await page();
  await p.fill("#businessName", "Other");
  await p.fill("#email", email.toUpperCase());
  await p.fill("#password", "longenough123");
  await p.click("button:has-text('Create account')");
  await p.waitForSelector("#email-error", { timeout: 10000 }).catch(() => {});
  check("Same email twice is refused on the email field", /already exists/i.test(await p.locator("#email-error").innerText().catch(() => "")));
  await ctx.close();
}
// Network drop
{
  const { ctx, p } = await page();
  await p.fill("#businessName", "Offline Co");
  await p.fill("#email", `off${stamp}@e2e.example`);
  await p.fill("#password", "longenough123");
  await ctx.setOffline(true);
  await p.click("button:has-text('Create account')");
  await p.waitForTimeout(2500);
  const msg = await alertText(p);
  const btn = await p.locator("form button.btn").innerText();
  check("Network drop shows a clear message", /could not reach lona/i.test(msg), msg);
  check("Button is usable again after a network drop", /create account/i.test(btn), btn);
  check("Typed values survive a network drop", (await p.inputValue("#email")) === `off${stamp}@e2e.example` && (await p.inputValue("#password")) === "longenough123");
  await ctx.close();
}
// Login
{
  const { ctx, p } = await page("/login");
  await p.fill("#email", email);
  await p.fill("#password", "wrong-password");
  await p.click("button:has-text('Log in')");
  await p.waitForSelector(".notice[role=alert]", { timeout: 10000 }).catch(() => {});
  check("Wrong password gives a clear error", /do not match/i.test(await alertText(p)));
  check("Login has a show/hide toggle", (await p.locator("button[aria-label='Show password']").count()) === 1);
  await p.fill("#password", "longenough123");
  await p.click("button:has-text('Log in')");
  check("Correct password logs in", await p.waitForURL(/\/dashboard/, { timeout: 10000 }).then(() => true, () => false));
  await ctx.close();
}
// Login lockout after repeated wrong passwords (uses its own account so the main one stays usable)
{
  const victim = `lock${stamp}@e2e.example`;
  const { ctx, p } = await page();
  await p.fill("#businessName", "Lock Co");
  await p.fill("#email", victim);
  await p.fill("#password", "correct-horse-1");
  await p.click("button:has-text('Create account')");
  await p.waitForURL(/\/dashboard/, { timeout: 15000 });
  await ctx.clearCookies();
  const msgs = [];
  for (let i = 0; i < 6; i++) {
    await p.goto(base + "/login");
    await p.fill("#email", victim);
    await p.fill("#password", `wrong-guess-${i}`);
    await p.click("button:has-text('Log in')");
    await p.waitForSelector(".notice[role=alert]", { timeout: 10000 });
    msgs.push(await alertText(p));
  }
  check("Warns before the lockout", /2 more tries/.test(msgs[2]) && /1 more try/.test(msgs[3]), msgs[3]);
  check("Locks sign-in after 5 wrong passwords", /too many attempts/i.test(msgs[5]), msgs[5]);
  await p.goto(base + "/login");
  await p.fill("#email", victim);
  await p.fill("#password", "correct-horse-1");
  await p.click("button:has-text('Log in')");
  await p.waitForSelector(".notice[role=alert]", { timeout: 10000 }).catch(() => {});
  check("Stays locked even with the right password", /too many attempts/i.test(await alertText(p)) && !p.url().includes("/dashboard"));
  await p.goto(base + "/login");
  await p.fill("#email", `nobody${stamp}@e2e.example`);
  await p.fill("#password", "whatever-1234");
  await p.click("button:has-text('Log in')");
  await p.waitForSelector(".notice[role=alert]", { timeout: 10000 });
  check("Other emails can still sign in", /do not match/i.test(await alertText(p)));
  await ctx.close();
}
// Checkout: dollar value matches the ZEC amount
{
  const p = await session.newPage();
  await p.goto(base + "/dashboard/settlement");
  await p.selectOption("select[name=assetKey]", "usdc-base");
  await p.fill("#payoutAddress", "0x4E9a2c71B3d58F0e6A1c47D2b9E5f803C6a7D1e2");
  await p.fill("#refundAddress", "t1Rv4exT7bqhZqi2j7xz8bUHDMxwosrjADU");
  await p.click("button:has-text('Save payout settings')");
  await p.waitForTimeout(800);
  await p.goto(base + "/dashboard/invoices/new");
  await p.fill("#amount", "128.00");
  await p.fill("#description", "E2E order");
  await Promise.all([p.waitForURL(/invoices\/inv_/), p.click("button:has-text('Create invoice')")]);
  const id = p.url().split("/").pop();
  await p.goto(`${base}/pay/${id}`);
  await p.click("button:has-text('Get payment details')");
  await p.waitForSelector(".pay-zec", { timeout: 15000 });
  const zec = Number((await p.locator(".pay-zec").innerText()).replace(/[^0-9.]/g, ""));
  const usdLine = await p.locator(".pay-usd").innerText().catch(() => "");
  const usd = Number((usdLine.match(/\$([0-9.,]+)/) ?? [])[1]?.replace(/,/g, ""));
  check("Checkout shows the dollar value of the ZEC amount", usd >= 128 && usd < 130, usdLine);
  check("ZEC amount is plausible for $128", zec > 0 && zec < 10, `${zec} ZEC`);
  const r = await p.request.get(`${base}/api/pay/${id}`);
  const body = await r.json();
  check("Checkout shows the server's stored amount", body.payment?.zecAmount && Number(body.payment.zecAmount) === zec, `${body.payment?.zecAmount}`);
  await p.close();
}
// Homepage: demo ZEC matches the demo dollar amount at the price on the page
{
  const { ctx, p } = await page("/");
  await p.waitForTimeout(800);
  const line = (await p.locator(".live-price").first().innerText().catch(() => "")).trim();
  const price = Number((line.match(/ZEC is \$([0-9.,]+)/) ?? [])[1]?.replace(/,/g, ""));
  const zecText = await p.locator(".hs-phone, .wallet-phone").first().innerText().catch(() => "");
  const zec = Number((zecText.match(/([0-9]+\.[0-9]+)\s*ZEC/) ?? [])[1]);
  if (price) {
    const implied = zec * price;
    check("Homepage demo amount matches the live price", implied > 128 && implied < 131, `${zec} ZEC x $${price} = $${implied.toFixed(2)}`);
  } else {
    check("Homepage says amounts are examples when no live price", /examples/i.test(line), line);
  }
  await ctx.close();
}

await session.close();
await b.close();
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.note ? `  (${r.note})` : ""}`);
}
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
