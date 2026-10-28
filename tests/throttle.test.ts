process.env.DATABASE_URL = "pglite://memory";

import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES, checkLimit, clearAttempts, ipFrom, pruneAttempts, recordAttempt } from "../src/lib/throttle";
import { db } from "../src/db";
import { authAttempts } from "../src/db/schema";

const W = 15 * 60_000;
const t0 = Math.floor(Date.UTC(2026, 9, 28, 12, 0) / W) * W; // start of a window

test("five wrong passwords lock that email, other emails are unaffected", async () => {
  const rule = RULES.loginEmail();
  for (let i = 0; i < 4; i++) await recordAttempt(rule, "owner@shop.example", t0 + i * 1000);
  assert.equal((await checkLimit(rule, "owner@shop.example", t0 + 5000)).blocked, false);
  await recordAttempt(rule, "owner@shop.example", t0 + 6000);
  const v = await checkLimit(rule, "Owner@Shop.example", t0 + 7000); // case does not matter
  assert.equal(v.blocked, true);
  assert.ok(v.retryMinutes >= 15 && v.retryMinutes <= 30, `retry ${v.retryMinutes}`);
  assert.equal((await checkLimit(rule, "someone@else.example", t0 + 7000)).blocked, false);
});

test("a lockout ends once the attempts age out of the lookback", async () => {
  const rule = RULES.loginEmail();
  const email = "aging@shop.example";
  for (let i = 0; i < 5; i++) await recordAttempt(rule, email, t0 + i);
  assert.equal((await checkLimit(rule, email, t0 + W + 1)).blocked, true); // previous window still counts
  assert.equal((await checkLimit(rule, email, t0 + 2 * W + 1)).blocked, false); // two windows later: clear
});

test("a correct password clears the count", async () => {
  const rule = RULES.loginEmail();
  const email = "clear@shop.example";
  for (let i = 0; i < 5; i++) await recordAttempt(rule, email, t0 + i);
  await clearAttempts(rule, email);
  assert.equal((await checkLimit(rule, email, t0 + 10)).blocked, false);
});

test("emails and IPs are stored hashed", async () => {
  await recordAttempt(RULES.loginIp(), "203.0.113.7", t0);
  const rows = await (await db()).select().from(authAttempts);
  for (const r of rows) {
    assert.ok(!r.key.includes("@") && !r.key.includes("203.0.113"), r.key);
    assert.match(r.key, /^[0-9a-f]{64}$/);
  }
});

test("old windows are pruned", async () => {
  await recordAttempt(RULES.signupIp(), "198.51.100.1", t0 - 10 * W);
  await pruneAttempts(t0);
  const rows = await (await db()).select().from(authAttempts);
  assert.ok(rows.every((r) => r.window >= Math.floor(t0 / W) - 2));
});

test("IP comes from the first forwarded address", () => {
  assert.equal(ipFrom(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  assert.equal(ipFrom(new Headers({ "x-real-ip": "198.51.100.4" })), "198.51.100.4");
  assert.equal(ipFrom(new Headers()), "unknown");
});
