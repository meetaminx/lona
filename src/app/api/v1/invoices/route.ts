import { NextResponse } from "next/server";
import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invoices, type InvoiceStatus } from "@/db/schema";
import { amountSchema, apiPost, jsonError, withApiKey } from "@/lib/api";
import { createInvoice, serializeInvoice } from "@/lib/invoices";

const createSchema = z.object({
  amount: amountSchema,
  description: z.string().trim().min(1).max(200),
  reference: z.string().max(120).optional(),
  customer_email: z.string().email().optional(),
  success_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.string().max(500)).optional(),
  expires_in_minutes: z.number().int().min(15).max(43200).optional(),
});

export async function POST(req: Request) {
  return apiPost(req, "/v1/invoices", async (auth, raw) => {
    const body = createSchema.parse(raw);
    const d = await db();
    const inv = await createInvoice(d, auth.merchantId, auth.livemode, {
      amountCents: body.amount,
      description: body.description,
      reference: body.reference,
      customerEmail: body.customer_email,
      successUrl: body.success_url,
      metadata: body.metadata,
      expiresInMinutes: body.expires_in_minutes,
    });
    return { status: 201, json: serializeInvoice(inv) };
  });
}

const STATUSES: InvoiceStatus[] = ["open", "awaiting_payment", "payment_received", "converting", "paid_out", "underpaid", "refunded", "failed", "expired", "canceled"];

/** List invoices, newest first. Filters: status, reference. Paging: limit, starting_after. */
export async function GET(req: Request) {
  return withApiKey(req, async (auth) => {
    const q = new URL(req.url).searchParams;
    const limit = Math.min(Math.max(Number(q.get("limit") ?? "25") || 25, 1), 100);
    const status = q.get("status");
    if (status && !STATUSES.includes(status as InvoiceStatus)) {
      return jsonError(400, "invalid_request", `status must be one of: ${STATUSES.join(", ")}`);
    }
    const d = await db();
    const where: SQL[] = [eq(invoices.merchantId, auth.merchantId), eq(invoices.livemode, auth.livemode)];
    if (status) where.push(eq(invoices.status, status as InvoiceStatus));
    const reference = q.get("reference");
    if (reference) where.push(eq(invoices.reference, reference));
    const after = q.get("starting_after");
    if (after) {
      const [cursor] = await d.select({ createdAt: invoices.createdAt }).from(invoices).where(and(eq(invoices.id, after), eq(invoices.merchantId, auth.merchantId)));
      if (!cursor) return jsonError(400, "invalid_request", `starting_after: no invoice with id ${after}`);
      where.push(lt(invoices.createdAt, cursor.createdAt));
    }
    const rows = await d.select().from(invoices).where(and(...where)).orderBy(desc(invoices.createdAt)).limit(limit + 1);
    const page = rows.slice(0, limit);
    return NextResponse.json({ object: "list", data: page.map((r) => serializeInvoice(r)), has_more: rows.length > limit });
  });
}
