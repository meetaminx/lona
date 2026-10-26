import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { handleError } from "@/lib/api";
import { startPayment } from "@/lib/invoices";
import { publicInvoice } from "@/lib/public-invoice";

const schema = z.object({ refund_address: z.string().max(100).optional().nullable() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));
    const d = await db();
    const { invoice, attempt } = await startPayment(d, id, { refundAddress: body.refund_address });
    return NextResponse.json(await publicInvoice(d, invoice, attempt));
  } catch (err) {
    return handleError(err);
  }
}
