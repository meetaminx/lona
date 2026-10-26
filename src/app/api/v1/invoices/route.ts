import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { amountSchema, readJson, withApiKey } from "@/lib/api";
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
  return withApiKey(req, async (auth) => {
    const body = createSchema.parse(await readJson(req));
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
    return NextResponse.json(serializeInvoice(inv), { status: 201 });
  });
}

export async function GET(req: Request) {
  return withApiKey(req, async (auth) => {
    const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? "25") || 25, 100);
    const d = await db();
    const rows = await d
      .select()
      .from(invoices)
      .where(and(eq(invoices.merchantId, auth.merchantId), eq(invoices.livemode, auth.livemode)))
      .orderBy(desc(invoices.createdAt))
      .limit(limit);
    return NextResponse.json({ object: "list", data: rows.map((r) => serializeInvoice(r)) });
  });
}
