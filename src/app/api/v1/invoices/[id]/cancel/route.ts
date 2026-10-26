import { NextResponse } from "next/server";
import { db } from "@/db";
import { jsonError, withApiKey } from "@/lib/api";
import { cancelInvoice, getInvoice, serializeInvoice } from "@/lib/invoices";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiKey(req, async (auth) => {
    const d = await db();
    const inv = await getInvoice(d, id);
    if (!inv || inv.merchantId !== auth.merchantId || inv.livemode !== auth.livemode) {
      return jsonError(404, "not_found", `No invoice with id ${id}.`);
    }
    return NextResponse.json(serializeInvoice(await cancelInvoice(d, inv)));
  });
}
