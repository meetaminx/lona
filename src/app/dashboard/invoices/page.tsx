import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { InvoiceTable } from "@/components/invoice-table";
import { isLivemode, requireMerchant } from "@/lib/auth";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const m = await requireMerchant();
  const live = await isLivemode();
  const d = await db();
  const rows = await d
    .select()
    .from(invoices)
    .where(and(eq(invoices.merchantId, m.id), eq(invoices.livemode, live)))
    .orderBy(desc(invoices.createdAt))
    .limit(200);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="h1">Invoices</h1>
          <p>Each invoice has its own checkout page and seal.</p>
        </div>
        <Link href="/dashboard/invoices/new" className="btn btn-primary">Create invoice</Link>
      </div>
      <section className="panel">
        {rows.length ? (
          <InvoiceTable rows={rows} />
        ) : (
          <div className="empty">
            <p>Invoices you create here or through the API show up in this list.</p>
            <Link href="/dashboard/invoices/new" className="btn btn-primary">Create invoice</Link>
          </div>
        )}
      </section>
    </div>
  );
}
