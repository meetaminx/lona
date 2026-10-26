import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, webhookEndpoints } from "@/db/schema";
import { removeEndpointAction, revokeKeyAction } from "@/app/actions/dashboard";
import { isLivemode, requireMerchant } from "@/lib/auth";
import { recentDeliveries } from "@/lib/webhooks";
import { AddEndpointForm, CreateKeyForm } from "./forms";

export const metadata = { title: "Developers" };

const dt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function DevelopersPage() {
  const m = await requireMerchant();
  const live = await isLivemode();
  const d = await db();
  const keys = await d
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.merchantId, m.id), eq(apiKeys.livemode, live), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
  const endpoints = await d
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.merchantId, m.id), eq(webhookEndpoints.livemode, live)))
    .orderBy(desc(webhookEndpoints.createdAt));
  const deliveries = await recentDeliveries(d, m.id, live);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="h1">Developers</h1>
          <p>
            Keys and endpoints for {live ? "live" : "test"} mode. <Link href="/docs">Read the API reference</Link>.
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head"><h2 className="h3">Secret keys</h2></div>
        <div className="panel-body stack" style={{ gap: 16 }}>
          <p className="small soft measure">
            Use a secret key from your server only. Anyone with it can create invoices on your account. Keys are shown once
            and stored as a hash.
          </p>
          <CreateKeyForm live={live} />
        </div>
        {keys.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Name</th><th scope="col">Key</th><th scope="col">Last used</th><th scope="col" className="right"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>{k.name}</td>
                    <td className="addr soft">lona_sk_{k.livemode ? "live" : "test"}_...{k.last4}</td>
                    <td className="soft num">{k.lastUsedAt ? dt.format(k.lastUsedAt) : "Never"}</td>
                    <td className="right">
                      <form action={revokeKeyAction}>
                        <input type="hidden" name="id" value={k.id} />
                        <button className="btn btn-quiet">Revoke</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2 className="h3">Webhook endpoints</h2></div>
        <div className="panel-body stack" style={{ gap: 16 }}>
          <p className="small soft measure">
            Lona sends a signed POST to each endpoint when a payment is received, paid out, underpaid, refunded, failed or
            expired. Failed deliveries are retried for about a day.
          </p>
          <AddEndpointForm live={live} />
        </div>
        {endpoints.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">URL</th><th scope="col">Signing secret</th><th scope="col" className="right"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>
                {endpoints.map((e) => (
                  <tr key={e.id}>
                    <td className="addr">{e.url}</td>
                    <td className="addr soft">whsec_...{e.secret.slice(-4)}</td>
                    <td className="right">
                      <form action={removeEndpointAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className="btn btn-quiet">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2 className="h3">Recent deliveries</h2></div>
        {deliveries.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Event</th><th scope="col">Invoice</th><th scope="col">Result</th><th scope="col">Time</th></tr></thead>
              <tbody>
                {deliveries.map((x) => (
                  <tr key={x.id}>
                    <td>{x.eventType}</td>
                    <td className="addr">{x.invoiceId && <Link href={`/dashboard/invoices/${x.invoiceId}`}>{x.invoiceId}</Link>}</td>
                    <td>
                      <span className={`chip ${x.status === "succeeded" ? "chip-green" : x.status === "failed" ? "chip-red" : "chip-amber"}`}>
                        {x.status === "succeeded" ? `Delivered (${x.lastResponseCode})` : x.status === "failed" ? "Gave up" : x.attempts ? "Retrying" : "Sending"}
                      </span>
                      {x.lastError && x.status !== "succeeded" && <span className="small soft" style={{ display: "block", marginTop: 4 }}>{x.lastError}</span>}
                    </td>
                    <td className="num soft">{dt.format(x.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty"><p>Deliveries show up here once an endpoint is added and a payment moves.</p></div>
        )}
      </section>
    </div>
  );
}
