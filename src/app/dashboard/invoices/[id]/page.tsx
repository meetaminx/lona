import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { cancelInvoiceAction } from "@/app/actions/dashboard";
import { CopyButton } from "@/components/copy-button";
import { SealFrame } from "@/components/seal-frame";
import { Seal } from "@/components/seal";
import { Amount } from "@/components/amount";
import { StatusChip } from "@/components/status-chip";
import { assetLabel, getSettlementAsset } from "@/lib/assets";
import { requireMerchant } from "@/lib/auth";
import { attemptsFor, getInvoice, hostedUrl, primaryAttempt, syncInvoice } from "@/lib/invoices";
import { formatAmount, truncateMiddle } from "@/lib/money";
import { sealStage } from "@/lib/stage";

const dt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await requireMerchant();
  const d = await db();
  const found = await getInvoice(d, id);
  if (!found || found.merchantId !== m.id) notFound();
  const inv = await syncInvoice(d, found);
  const attempts = await attemptsFor(d, inv.id);
  const attempt = primaryAttempt(attempts);
  const asset = getSettlementAsset(inv.settlementAssetKey);
  const events = await d
    .select()
    .from(webhookEvents)
    .where(and(eq(webhookEvents.invoiceId, inv.id), eq(webhookEvents.merchantId, m.id)))
    .orderBy(desc(webhookEvents.createdAt));
  const url = hostedUrl(inv.id);
  const { stage, tone } = sealStage(inv.status);
  const cancelable = inv.status === "open" || inv.status === "awaiting_payment";
  const eventAt = (type: string) => events.find((e) => e.type === type)?.createdAt ?? null;
  const firstAttempt = attempts[attempts.length - 1];
  const bad = ["underpaid", "refunded", "failed", "expired", "canceled"].includes(inv.status);
  const timeline: { label: string; at: Date | null; state: "done" | "todo" | "bad" }[] = [
    { label: "Invoice created", at: inv.createdAt, state: "done" },
    { label: "Customer opened checkout", at: firstAttempt?.createdAt ?? null, state: firstAttempt ? "done" : "todo" },
    { label: "Payment received", at: eventAt("invoice.payment_received"), state: eventAt("invoice.payment_received") ? "done" : "todo" },
    { label: "Paid out to your wallet", at: inv.paidOutAt, state: inv.paidOutAt ? "done" : "todo" },
  ];
  if (bad) {
    const label = { underpaid: "Underpaid", refunded: "Refunded", failed: "Failed", expired: "Expired", canceled: "Canceled" }[inv.status as "underpaid"];
    const at = eventAt(`invoice.${inv.status}`) ?? inv.updatedAt;
    timeline.splice(timeline.findIndex((t) => t.state === "todo") === -1 ? timeline.length : timeline.findIndex((t) => t.state === "todo"), Infinity, { label, at, state: "bad" });
  }

  return (
    <div className="stack">
      <p className="small"><Link href="/dashboard/invoices">Invoices</Link></p>
      <div className="page-head">
        <div>
          <p style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <StatusChip status={inv.status} /> <span className="soft">{inv.description}</span>
          </p>
          <h1 className="h1">
            <Amount value={formatAmount(inv.amountCents)} prefix="$" currency="USD" />
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={url} target="_blank" rel="noreferrer" className="btn btn-primary">Open checkout</a>
          {cancelable && (
            <form action={cancelInvoiceAction}>
              <input type="hidden" name="id" value={inv.id} />
              <button className="btn btn-danger">Cancel invoice</button>
            </form>
          )}
        </div>
      </div>

      <section className="panel inv-hero">
        <div className="inv-hero-seal">
          <SealFrame id={inv.id} stage={stage} tone={tone} size={260} label={`Invoice seal, ${inv.status.replace("_", " ")}`}>
            <Seal id={inv.id} stage={Math.max(stage, 1)} tone={tone} size={118} />
          </SealFrame>
        </div>
        <div className="inv-hero-time">
          <h2 className="h3" style={{ marginBottom: 16 }}>What happened</h2>
          <ol className="timeline">
            {timeline.map((t) => (
              <li key={t.label} className={`is-${t.state}`}>
                <span className="t-dot" />
                <span>{t.label}</span>
                <span className="t-time">{t.at ? dt.format(t.at) : ""}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="panel panel-body">
        <p className="label">Checkout link</p>
        <div className="copy-row" style={{ marginTop: 8 }}>
          <code className="addr">{url}</code>
          <CopyButton value={url} label="Copy link" />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2 className="h3">Details</h2></div>
        <div className="panel-body">
          <dl className="kv">
            <dt>Invoice ID</dt><dd className="addr">{inv.id}</dd>
            <dt>Pays out as</dt><dd>{asset ? assetLabel(asset) : inv.settlementAssetKey}</dd>
            <dt>Payout wallet</dt><dd className="addr">{inv.payoutAddress}</dd>
            {inv.reference && (<><dt>Reference</dt><dd>{inv.reference}</dd></>)}
            {inv.customerEmail && (<><dt>Customer email</dt><dd>{inv.customerEmail}</dd></>)}
            <dt>Created</dt><dd className="num">{dt.format(inv.createdAt)}</dd>
            <dt>Customer can pay until</dt><dd className="num">{dt.format(inv.expiresAt)}</dd>
            {inv.paidOutAt && (<><dt>Paid out</dt><dd className="num">{dt.format(inv.paidOutAt)}</dd></>)}
          </dl>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2 className="h3">Payment</h2></div>
        {attempt ? (
          <div className="panel-body">
            <dl className="kv">
              <dt>Customer pays</dt><dd className="num">{attempt.amountInFormatted} ZEC</dd>
              <dt>Deposit address</dt><dd className="addr">{attempt.depositAddress}</dd>
              <dt>Price held until</dt><dd className="num">{dt.format(attempt.quoteDeadline)}</dd>
              <dt>Route</dt><dd>{attempt.provider === "sandbox" ? "Test mode simulator" : "NEAR Intents"}</dd>
              <dt>Deposit transaction</dt>
              <dd className="addr">{attempt.originTxs.length ? attempt.originTxs.map((t) => <TxLink key={t.hash} tx={t} />) : "Not seen yet"}</dd>
              <dt>Payout transaction</dt>
              <dd className="addr">{attempt.destinationTxs.length ? attempt.destinationTxs.map((t) => <TxLink key={t.hash} tx={t} />) : "Not sent yet"}</dd>
            </dl>
            {attempts.length > 1 && <p className="small soft" style={{ marginTop: 12 }}>The customer refreshed the price {attempts.length - 1} {attempts.length === 2 ? "time" : "times"}.</p>}
          </div>
        ) : (
          <div className="empty"><p>The customer has not opened checkout yet. The ZEC price is set when they do.</p></div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2 className="h3">Events sent to your server</h2></div>
        {events.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Event</th><th scope="col">ID</th><th scope="col">Time</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}><td>{e.type}</td><td className="addr soft">{e.id}</td><td className="num soft">{dt.format(e.createdAt)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty"><p>Events appear here as the payment moves. Add an endpoint under Developers to receive them.</p></div>
        )}
      </section>
    </div>
  );
}

function TxLink({ tx }: { tx: { hash: string; explorerUrl?: string } }) {
  return tx.explorerUrl ? (
    <a href={tx.explorerUrl} target="_blank" rel="noreferrer" style={{ display: "block" }}>{truncateMiddle(tx.hash, 10, 8)}</a>
  ) : (
    <span style={{ display: "block" }}>{truncateMiddle(tx.hash, 10, 8)}</span>
  );
}
