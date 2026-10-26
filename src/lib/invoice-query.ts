import { and, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import { invoices, type InvoiceStatus } from "@/db/schema";

export const FILTERS: { key: string; label: string; statuses: InvoiceStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "paid", label: "Paid out", statuses: ["paid_out"] },
  { key: "progress", label: "In progress", statuses: ["awaiting_payment", "payment_received", "converting"] },
  { key: "attention", label: "Need attention", statuses: ["underpaid", "failed", "refunded"] },
  { key: "open", label: "Open", statuses: ["open"] },
  { key: "closed", label: "Expired or canceled", statuses: ["expired", "canceled"] },
];

export async function queryInvoices(
  d: DB,
  merchantId: string,
  livemode: boolean,
  opts: { filter?: string; q?: string; limit?: number },
) {
  const where: SQL[] = [eq(invoices.merchantId, merchantId), eq(invoices.livemode, livemode)];
  const f = FILTERS.find((x) => x.key === opts.filter);
  if (f?.statuses) where.push(inArray(invoices.status, f.statuses));
  const q = opts.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(invoices.description, like), ilike(invoices.reference, like), ilike(invoices.id, like), ilike(invoices.customerEmail, like))!);
  }
  return d.select().from(invoices).where(and(...where)).orderBy(desc(invoices.createdAt)).limit(opts.limit ?? 200);
}
