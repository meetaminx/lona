import { NextResponse } from "next/server";
import { db } from "@/db";
import { jsonError, withApiKey } from "@/lib/api";
import { attemptsFor, getInvoice, primaryAttempt, serializeInvoice, syncInvoice } from "@/lib/invoices";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiKey(req, async (auth) => {
    const d = await db();
    const found = await getInvoice(d, id);
    if (!found || found.merchantId !== auth.merchantId || found.livemode !== auth.livemode) {
      return jsonError(404, "not_found", `No invoice with id ${id} in ${auth.livemode ? "live" : "test"} mode.`);
    }
    const inv = await syncInvoice(d, found);
    return NextResponse.json(serializeInvoice(inv, primaryAttempt(await attemptsFor(d, inv.id))));
  });
}
