import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { amountSchema, apiPost, withApiKey } from "@/lib/api";
import { createPaymentLink, listPaymentLinks, serializeLink } from "@/lib/links";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(300).optional(),
  amount: amountSchema,
});

export async function POST(req: Request) {
  return apiPost(req, "/v1/payment_links", async (auth, raw) => {
    const body = createSchema.parse(raw);
    const d = await db();
    const link = await createPaymentLink(d, auth.merchantId, auth.livemode, {
      title: body.title,
      description: body.description,
      amountCents: body.amount,
    });
    return { status: 201, json: serializeLink(link) };
  });
}

export async function GET(req: Request) {
  return withApiKey(req, async (auth) => {
    const d = await db();
    const links = await listPaymentLinks(d, auth.merchantId, auth.livemode);
    return NextResponse.json({ object: "list", data: links.map(serializeLink) });
  });
}
