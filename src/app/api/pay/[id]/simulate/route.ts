import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { handleError, jsonError } from "@/lib/api";
import { attemptsFor, getInvoice, primaryAttempt, simulatePayment } from "@/lib/invoices";
import { publicInvoice } from "@/lib/public-invoice";

const schema = z.object({ outcome: z.enum(["paid_out", "underpaid", "refunded", "failed"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { outcome } = schema.parse(await req.json().catch(() => ({})));
    const d = await db();
    const found = await getInvoice(d, id);
    if (!found) return jsonError(404, "not_found", "This invoice does not exist.");
    const inv = await simulatePayment(d, found, outcome);
    return NextResponse.json(await publicInvoice(d, inv, primaryAttempt(await attemptsFor(d, inv.id))));
  } catch (err) {
    return handleError(err);
  }
}
