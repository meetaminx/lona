import Link from "next/link";
import { db } from "@/db";
import { InvoiceTable } from "@/components/invoice-table";
import { isLivemode, requireMerchant } from "@/lib/auth";
import { syncMerchantActive } from "@/lib/invoices";
import { FILTERS, queryInvoices } from "@/lib/invoice-query";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const m = await requireMerchant();
  const live = await isLivemode();
  const { filter = "all", q = "" } = await searchParams;
  await syncMerchantActive(await db(), m.id, live);
  const rows = await queryInvoices(await db(), m.id, live, { filter, q });
  const qs = (f: string) => `?${new URLSearchParams({ ...(f !== "all" ? { filter: f } : {}), ...(q ? { q } : {}) })}`;
  const exportHref = `/dashboard/invoices/export${qs(filter)}`;
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="h1">Invoices</h1>
          <p>Each invoice has its own checkout page and seal.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={exportHref} className="btn btn-secondary">Export CSV</a>
          <Link href="/dashboard/invoices/new" className="btn btn-primary">Create invoice</Link>
        </div>
      </div>

      <div className="filter-bar">
        <nav className="seg" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <Link key={f.key} href={`/dashboard/invoices${qs(f.key)}`} aria-current={f.key === filter ? "page" : undefined}>
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="search" role="search">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <label htmlFor="q" className="visually-hidden">Search invoices</label>
          <input className="input" id="q" name="q" defaultValue={q} placeholder="Search description, reference, email or ID" />
        </form>
      </div>

      <section className="panel">
        {rows.length ? (
          <InvoiceTable rows={rows} />
        ) : q || filter !== "all" ? (
          <div className="empty">
            <p>No invoices match this search.</p>
            <Link href="/dashboard/invoices" className="btn btn-secondary">Clear filters</Link>
          </div>
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
