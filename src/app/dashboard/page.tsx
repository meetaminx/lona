import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { setupState } from "@/app/actions/dashboard";
import { IconCheck } from "@/components/icons";
import { InvoiceTable } from "@/components/invoice-table";
import { isLivemode, requireMerchant } from "@/lib/auth";
import { formatUsd } from "@/lib/money";

export const metadata = { title: "Overview" };

export default async function Overview() {
  const m = await requireMerchant();
  const live = await isLivemode();
  const d = await db();
  const scope = and(eq(invoices.merchantId, m.id), eq(invoices.livemode, live));
  const recent = await d.select().from(invoices).where(scope).orderBy(desc(invoices.createdAt)).limit(8);
  const [totals] = await d
    .select({
      paid: sql<number>`coalesce(sum(case when ${invoices.status} = 'paid_out' then ${invoices.amountCents} else 0 end), 0)::int`,
      paidCount: sql<number>`count(*) filter (where ${invoices.status} = 'paid_out')::int`,
      inFlight: sql<number>`count(*) filter (where ${invoices.status} in ('awaiting_payment','payment_received','converting'))::int`,
      needsAttention: sql<number>`count(*) filter (where ${invoices.status} in ('underpaid','failed'))::int`,
    })
    .from(invoices)
    .where(scope);
  const setup = await setupState(m.id, live);
  const steps = [
    { done: setup.settlement, title: "Set your payout wallet", body: "Choose the stablecoin and network you want to receive.", href: "/dashboard/settlement", cta: "Set wallet" },
    { done: setup.invoice, title: "Create your first invoice", body: live ? "Send it to a customer or open it yourself." : "Open it and simulate a payment to see the full flow.", href: "/dashboard/invoices/new", cta: "Create invoice" },
    { done: setup.key, title: "Create an API key", body: "Create invoices from your own site or app.", href: "/dashboard/developers", cta: "Create key" },
    { done: setup.webhook, title: "Add a webhook endpoint", body: "Get told the moment a payment reaches your wallet.", href: "/dashboard/developers", cta: "Add endpoint" },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="h1">{m.businessName}</h1>
          <p>{live ? "Live payments" : "Test payments. Nothing here is real money."}</p>
        </div>
        <Link href="/dashboard/invoices/new" className="btn btn-primary">Create invoice</Link>
      </div>

      {remaining > 0 && (
        <section className="panel" aria-labelledby="setup-h">
          <div className="panel-head">
            <h2 id="setup-h" className="h3">Get ready to take payments</h2>
            <span className="small soft">{4 - remaining} of 4 done</span>
          </div>
          <ul className="checklist">
            {steps.map((s) => (
              <li key={s.title} className={s.done ? "done" : ""}>
                <span className="tick">{s.done && <IconCheck />}</span>
                <div className="grow">
                  <p style={{ fontWeight: 500 }}>{s.title}</p>
                  <p className="small soft">{s.body}</p>
                </div>
                {!s.done && <Link href={s.href} className="btn btn-secondary" style={{ height: 32 }}>{s.cta}</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel totals" aria-label="Totals">
        <div>
          <p className="small soft">Paid out to your wallet</p>
          <p className="amount num">{formatUsd(totals.paid)}</p>
          <p className="small soft">{totals.paidCount} {totals.paidCount === 1 ? "payment" : "payments"}</p>
        </div>
        <div>
          <p className="small soft">Payments in progress</p>
          <p className="amount num">{totals.inFlight}</p>
          <p className="small soft">Waiting for the customer or converting</p>
        </div>
        <div>
          <p className="small soft">Need your attention</p>
          <p className="amount num">{totals.needsAttention}</p>
          <p className="small soft">Underpaid or failed</p>
        </div>
      </section>

      <section className="panel" aria-labelledby="recent-h">
        <div className="panel-head">
          <h2 id="recent-h" className="h3">Recent invoices</h2>
          <Link href="/dashboard/invoices" className="small">See all invoices</Link>
        </div>
        {recent.length ? (
          <InvoiceTable rows={recent} />
        ) : (
          <div className="empty">
            <p>No invoices yet. Create one to get a checkout link you can share or open yourself.</p>
            <Link href="/dashboard/invoices/new" className="btn btn-primary">Create invoice</Link>
          </div>
        )}
      </section>
    </div>
  );
}
