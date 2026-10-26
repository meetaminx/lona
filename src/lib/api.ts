import { NextResponse } from "next/server";
import { and, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apiUsage, idempotencyKeys } from "@/db/schema";
import { authenticateApiKey, type ApiAuth } from "@/lib/auth";
import { sha256 } from "@/lib/ids";
import { InvoiceError } from "@/lib/invoices";

export const ratePerMin = () => Number(process.env.API_RATE_PER_MIN ?? "120");

export function jsonError(status: number, code: string, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export function handleError(err: unknown) {
  if (err instanceof InvoiceError) return jsonError(err.status, err.code, err.message);
  if (err instanceof z.ZodError) {
    const issue = err.issues[0];
    return jsonError(400, "invalid_request", `${issue.path.join(".") || "body"}: ${issue.message}`);
  }
  console.error(err);
  return jsonError(500, "internal_error", "Something went wrong on our side. The request was not completed.");
}

/** Count a request against the key's per-minute budget. */
async function rateLimit(keyId: string): Promise<{ ok: boolean; remaining: number; reset: number }> {
  const now = Date.now();
  const windowStart = Math.floor(now / 60_000);
  const d = await db();
  const [row] = await d
    .insert(apiUsage)
    .values({ keyId, window: String(windowStart), count: 1 })
    .onConflictDoUpdate({ target: [apiUsage.keyId, apiUsage.window], set: { count: sql`${apiUsage.count} + 1` } })
    .returning({ count: apiUsage.count });
  const reset = Math.ceil(((windowStart + 1) * 60_000 - now) / 1000);
  const limit = ratePerMin();
  return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count), reset };
}

export async function withApiKey(req: Request, fn: (auth: ApiAuth) => Promise<Response>): Promise<Response> {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) {
    return jsonError(401, "unauthorized", "Send your secret key as: Authorization: Bearer lona_sk_test_...");
  }
  const limit = await rateLimit(auth.keyId);
  const rlHeaders = {
    "X-RateLimit-Limit": String(ratePerMin()),
    "X-RateLimit-Remaining": String(limit.remaining),
    "X-RateLimit-Reset": String(limit.reset),
  };
  if (!limit.ok) {
    return jsonError(429, "rate_limited", `Too many requests. The limit is ${ratePerMin()} per minute per key.`, {
      ...rlHeaders,
      "Retry-After": String(limit.reset),
    });
  }
  let res: Response;
  try {
    res = await fn(auth);
  } catch (err) {
    res = handleError(err);
  }
  for (const [k, v] of Object.entries(rlHeaders)) res.headers.set(k, v);
  return res;
}

/**
 * A POST endpoint with optional idempotency. When the request carries an Idempotency-Key header,
 * the first response is stored for 24 hours and replayed for retries with the same key and body.
 */
export async function apiPost(
  req: Request,
  path: string,
  fn: (auth: ApiAuth, body: unknown) => Promise<{ status: number; json: unknown }>,
): Promise<Response> {
  return withApiKey(req, async (auth) => {
    const raw = await req.text();
    let body: unknown = {};
    if (raw.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        throw new InvoiceError("The request body must be JSON.", 400, "invalid_json");
      }
    }
    const key = req.headers.get("idempotency-key")?.trim();
    if (!key) {
      const out = await fn(auth, body);
      return NextResponse.json(out.json, { status: out.status });
    }
    if (key.length > 255) return jsonError(400, "invalid_idempotency_key", "Idempotency-Key must be 255 characters or fewer.");

    const d = await db();
    const requestHash = sha256(`${path}\n${raw}`);
    const inserted = await d
      .insert(idempotencyKeys)
      .values({ merchantId: auth.merchantId, livemode: auth.livemode, key, path, requestHash })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key });

    if (!inserted.length) {
      const [prev] = await d
        .select()
        .from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.merchantId, auth.merchantId), eq(idempotencyKeys.livemode, auth.livemode), eq(idempotencyKeys.key, key)));
      if (prev.requestHash !== requestHash) {
        return jsonError(422, "idempotency_key_reused", "This Idempotency-Key was already used with a different request.");
      }
      if (prev.statusCode === null) {
        return jsonError(409, "idempotency_key_in_use", "A request with this Idempotency-Key is still being processed. Retry shortly.");
      }
      return NextResponse.json(prev.response, { status: prev.statusCode, headers: { "Idempotent-Replayed": "true" } });
    }

    let status: number;
    let json: unknown;
    try {
      ({ status, json } = await fn(auth, body));
    } catch (err) {
      const res = handleError(err);
      status = res.status;
      json = await res.json();
    }
    if (status >= 500) {
      // Server errors are not stored, so the client can retry with the same key.
      await d
        .delete(idempotencyKeys)
        .where(and(eq(idempotencyKeys.merchantId, auth.merchantId), eq(idempotencyKeys.livemode, auth.livemode), eq(idempotencyKeys.key, key)));
    } else {
      await d
        .update(idempotencyKeys)
        .set({ statusCode: status, response: json })
        .where(and(eq(idempotencyKeys.merchantId, auth.merchantId), eq(idempotencyKeys.livemode, auth.livemode), eq(idempotencyKeys.key, key)));
    }
    return NextResponse.json(json, { status });
  });
}

/** Housekeeping for the scheduler: drop stored idempotency responses and old rate windows. */
export async function pruneApiState(): Promise<void> {
  const d = await db();
  await d.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, new Date(Date.now() - 24 * 3600_000)));
  await d.delete(apiUsage).where(lt(apiUsage.window, String(Math.floor(Date.now() / 60_000) - 10)));
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new InvoiceError("The request body must be JSON.", 400, "invalid_json");
  }
}

export const amountSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const raw = typeof v === "number" ? v.toFixed(2) : v.replace(/[,\s$]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      ctx.addIssue({ code: "custom", message: 'Use a dollar amount like "49.00"' });
      return z.NEVER;
    }
    const [w, f = ""] = raw.split(".");
    const cents = Number(w) * 100 + Number(f.padEnd(2, "0"));
    if (cents < 100 || cents > 10_000_000) {
      ctx.addIssue({ code: "custom", message: "Amount must be between 1.00 and 100,000.00" });
      return z.NEVER;
    }
    return cents;
  });
