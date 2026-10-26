import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, merchants, sessions, type Merchant } from "@/db/schema";
import { newId, randomToken, sha256 } from "@/lib/ids";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const SESSION_COOKIE = "lona_session";
const MODE_COOKIE = "lona_mode";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(keyHex, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export async function createSession(merchantId: string): Promise<void> {
  const token = randomToken(40);
  const d = await db();
  await d.insert(sessions).values({
    id: sha256(token),
    merchantId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const d = await db();
    await d.delete(sessions).where(eq(sessions.id, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function currentMerchant(): Promise<Merchant | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const d = await db();
  const [row] = await d
    .select({ merchant: merchants })
    .from(sessions)
    .innerJoin(merchants, eq(merchants.id, sessions.merchantId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())));
  return row?.merchant ?? null;
}

export async function requireMerchant(): Promise<Merchant> {
  const m = await currentMerchant();
  if (!m) redirect("/login");
  return m;
}

/** Dashboard mode. New accounts start in test mode. */
export async function isLivemode(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(MODE_COOKIE)?.value === "live";
}

export async function setLivemode(live: boolean): Promise<void> {
  const jar = await cookies();
  jar.set(MODE_COOKIE, live ? "live" : "test", { path: "/", sameSite: "lax", maxAge: 365 * 86_400 });
}

// ---------- API keys ----------

export async function createApiKey(merchantId: string, livemode: boolean, name: string): Promise<{ id: string; secret: string }> {
  const secret = `lona_sk_${livemode ? "live" : "test"}_${randomToken(32)}`;
  const id = newId("key");
  const d = await db();
  await d.insert(apiKeys).values({ id, merchantId, livemode, name, keyHash: sha256(secret), last4: secret.slice(-4) });
  return { id, secret };
}

export type ApiAuth = { merchantId: string; livemode: boolean; keyId: string };

export async function authenticateApiKey(header: string | null): Promise<ApiAuth | null> {
  const match = header?.match(/^Bearer\s+(lona_sk_(live|test)_[a-z0-9]+)$/i);
  if (!match) return null;
  const d = await db();
  const [key] = await d
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, sha256(match[1])), isNull(apiKeys.revokedAt)));
  if (!key) return null;
  await d.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
  return { merchantId: key.merchantId, livemode: key.livemode, keyId: key.id };
}

export async function createMerchant(input: { email: string; password: string; businessName: string }) {
  const d = await db();
  const email = input.email.trim().toLowerCase();
  const [existing] = await d.select({ id: merchants.id }).from(merchants).where(eq(merchants.email, email));
  if (existing) return { error: "An account with that email already exists. Log in instead." } as const;
  const [m] = await d
    .insert(merchants)
    .values({ id: newId("mer"), email, passwordHash: await hashPassword(input.password), businessName: input.businessName.trim() })
    .returning();
  return { merchant: m } as const;
}
