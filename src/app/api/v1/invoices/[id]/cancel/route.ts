import { db } from "@/db";
import { apiPost } from "@/lib/api";
import { cancelInvoice, getInvoice, InvoiceError, serializeInvoice } from "@/lib/invoices";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return apiPost(req, `/v1/invoices/${id}/cancel`, async (auth) => {
    const d = await db();
    const inv = await getInvoice(d, id);
    if (!inv || inv.merchantId !== auth.merchantId || inv.livemode !== auth.livemode) {
      throw new InvoiceError(`No invoice with id ${id}.`, 404, "not_found");
    }
    return { status: 200, json: serializeInvoice(await cancelInvoice(d, inv)) };
  });
}
