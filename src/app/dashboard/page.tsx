import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { setupState } from "@/app/actions/dashboard";
import { IconCheck } from "@/components/icons";
import { InvoiceTable } from "@/components/invoice-table";
import { isLivemode, requireMerchant } from "@/lib/auth";
import { formatAmount } from "@/lib/money";
import { Amount } from "@/components/amount";
import { PayoutChart, type DayTotal } from "@/components/payout-chart";

export const metadata = { title: "Overview" };

export default async function Overview({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
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
  const since = new Date(Date.now() - 29 * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const daily = await d
    .select({
      day: sql<string>`to_char(date_trunc('day', ${invoices.paidOutAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
      cents: sql<number>`sum(${invoices.amountCents})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(and(scope, eq(invoices.status, "paid_out"), gte(invoices.paidOutAt, since)))
    .groupBy(sql`1`);
  const byDay = new Map(daily.map((r) => [r.day, r]));
  const days: DayTotal[] = Array.from({ length: 30 }, (_, i) => {
    const key = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(key);
    return { day: key, cents: r?.cents ?? 0, count: r?.count ?? 0 };
  });
  const last30 = days.reduce((a, b) => a + b.cents, 0);
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

      {notice === "password-reset" && <p className="notice notice-ok" role="status">Password changed. You are logged in on this device only.</p>}

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

      <section className="panel" aria-labelledby="payouts-h">
        <div className="overview-top">
          <div>
            <h2 id="payouts-h" className="small soft">Paid out to your wallet, last 30 days</h2>
            <Amount value={formatAmount(last30)} prefix="$" className="overview-amount" />
            <p className="small soft">{totals.paidCount} {totals.paidCount === 1 ? "payment" : "payments"} all time, {live ? "live" : "test"} mode</p>
          </div>
          <dl className="overview-stats">
            <div>
              <dt>In progress</dt>
              <dd>{totals.inFlight}</dd>
            </div>
            <div>
              <dt>Need attention</dt>
              <dd className={totals.needsAttention ? "is-bad" : ""}>{totals.needsAttention}</dd>
            </div>
          </dl>
        </div>
        <div className="overview-chart">
          <PayoutChart days={days} />
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
