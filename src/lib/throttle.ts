import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { authAttempts } from "@/db/schema";
import { sha256 } from "@/lib/ids";

/**
 * Limits for sign-in and other account requests, counted per email and per IP address in
 * 15-minute windows. A request is refused while the current and previous windows together are at
 * the limit, so a lockout lasts between 15 and 30 minutes. Keys are hashed before storage.
 */

const WINDOW_MS = 15 * 60_000;

export type Rule = { scope: string; max: number };

const envInt = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export const RULES = {
  /** Wrong passwords for one email. */
  loginEmail: (): Rule => ({ scope: "login:email", max: envInt("AUTH_LOGIN_EMAIL_LIMIT", 5) }),
  /** Wrong passwords from one network, across any emails. */
  loginIp: (): Rule => ({ scope: "login:ip", max: envInt("AUTH_LOGIN_IP_LIMIT", 30) }),
  /** Password reset emails for one address. */
  forgotEmail: (): Rule => ({ scope: "forgot:email", max: envInt("AUTH_FORGOT_EMAIL_LIMIT", 3) }),
  /** Password reset requests from one network. */
  forgotIp: (): Rule => ({ scope: "forgot:ip", max: envInt("AUTH_FORGOT_IP_LIMIT", 10) }),
  /** New accounts from one network. */
  signupIp: (): Rule => ({ scope: "signup:ip", max: envInt("AUTH_SIGNUP_IP_LIMIT", 10) }),
};

const windowOf = (now: number) => Math.floor(now / WINDOW_MS);
const hashKey = (raw: string) => sha256(raw.trim().toLowerCase());

export type Verdict = { blocked: boolean; retryMinutes: number; count: number };

/** Whether `raw` has reached the rule's limit. Does not record anything. */
export async function checkLimit(rule: Rule, raw: string, now = Date.now()): Promise<Verdict> {
  const d = await db();
  const w = windowOf(now);
  const rows = await d
    .select({ window: authAttempts.window, count: authAttempts.count })
    .from(authAttempts)
    .where(and(eq(authAttempts.scope, rule.scope), eq(authAttempts.key, hashKey(raw)), inArray(authAttempts.window, [w, w - 1])));
  const current = rows.find((r) => r.window === w)?.count ?? 0;
  const previous = rows.find((r) => r.window === w - 1)?.count ?? 0;
  const count = current + previous;
  if (count < rule.max) return { blocked: false, retryMinutes: 0, count };
  // Time until enough old attempts fall out of the two-window lookback.
  const endOfCurrent = (w + 1) * WINDOW_MS - now;
  const waitMs = previous > 0 && current < rule.max ? endOfCurrent : endOfCurrent + WINDOW_MS;
  return { blocked: true, retryMinutes: Math.max(1, Math.ceil(waitMs / 60_000)), count };
}

/** Count one attempt against the rule. */
export async function recordAttempt(rule: Rule, raw: string, now = Date.now()): Promise<void> {
  const d = await db();
  await d
    .insert(authAttempts)
    .values({ scope: rule.scope, key: hashKey(raw), window: windowOf(now), count: 1 })
    .onConflictDoUpdate({
      target: [authAttempts.scope, authAttempts.key, authAttempts.window],
      set: { count: sql`${authAttempts.count} + 1` },
    });
}

/** Forget attempts for a key, after it proves itself (a correct password). */
export async function clearAttempts(rule: Rule, raw: string): Promise<void> {
  const d = await db();
  await d.delete(authAttempts).where(and(eq(authAttempts.scope, rule.scope), eq(authAttempts.key, hashKey(raw))));
}

/** Drop windows that no longer count. Called by the scheduled job. */
export async function pruneAttempts(now = Date.now()): Promise<void> {
  const d = await db();
  await d.delete(authAttempts).where(lt(authAttempts.window, windowOf(now) - 2));
}

/** The caller's IP address as Vercel reports it. Falls back to a fixed key so limits still apply. */
export function ipFrom(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

export function lockoutMessage(minutes: number): string {
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or reset your password.`;
}
