import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey, type ApiAuth } from "@/lib/auth";
import { InvoiceError } from "@/lib/invoices";

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
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

export async function withApiKey(req: Request, fn: (auth: ApiAuth) => Promise<Response>): Promise<Response> {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) {
    return jsonError(401, "unauthorized", "Send your secret key as: Authorization: Bearer lona_sk_test_...");
  }
  try {
    return await fn(auth);
  } catch (err) {
    return handleError(err);
  }
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
