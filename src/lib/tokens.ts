import { and, eq, gt, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import { authTokens } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/ids";

export type TokenPurpose = "reset" | "verify";

const TTL_MIN: Record<TokenPurpose, number> = { reset: 60, verify: 60 * 24 * 3 };

/** Issue a single-use token. Returns the raw value for the link; only its hash is stored. */
export async function issueToken(d: DB, merchantId: string, purpose: TokenPurpose): Promise<string> {
  const raw = randomToken(40);
  await d.insert(authTokens).values({
    id: sha256(raw),
    merchantId,
    purpose,
    expiresAt: new Date(Date.now() + TTL_MIN[purpose] * 60_000),
  });
  return raw;
}

/** Mark a token used and return its merchant, or null if it is unknown, used, expired or the wrong kind. */
export async function consumeToken(d: DB, raw: string, purpose: TokenPurpose): Promise<string | null> {
  if (!/^[0-9a-z]{40}$/.test(raw)) return null;
  const [row] = await d
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(eq(authTokens.id, sha256(raw)), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())),
    )
    .returning({ merchantId: authTokens.merchantId });
  return row?.merchantId ?? null;
}

/** Check a token without using it (to decide whether to show the reset form). */
export async function peekToken(d: DB, raw: string, purpose: TokenPurpose): Promise<boolean> {
  if (!/^[0-9a-z]{40}$/.test(raw)) return false;
  const [row] = await d
    .select({ id: authTokens.id })
    .from(authTokens)
    .where(and(eq(authTokens.id, sha256(raw)), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())));
  return !!row;
}
