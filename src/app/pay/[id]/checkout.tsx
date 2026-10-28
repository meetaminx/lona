"use client";

import { useCallback, useEffect, useState } from "react";
import { Amount } from "@/components/amount";
import { Mark } from "@/components/logo";
import { Medallion } from "@/components/medallion";
import { PayPanel } from "@/components/pay-panel";
import type { PublicInvoice } from "@/lib/public-invoice";

const POLL_STATUSES = new Set(["awaiting_payment", "payment_received", "converting", "underpaid"]);
const QUOTE_MS = 20 * 60_000;

/**
 * The first render uses the server's clock (`renderedAt`) so server and browser produce the same
 * text and hydration matches; the live clock takes over once the page is interactive.
 */
function useCountdown(until: string | undefined, renderedAt: number) {
  const [now, setNow] = useState(renderedAt);
  useEffect(() => {
    if (!until) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  const ms = Math.max(0, new Date(until).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { ms, label: `${m}:${s.toString().padStart(2, "0")}`, fraction: ms / QUOTE_MS };
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong. Try again.");
  return json as PublicInvoice;
}

export function Checkout({ initial, renderedAt }: { initial: PublicInvoice; renderedAt: number }) {
  const [inv, setInv] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refund, setRefund] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/pay/${inv.id}`, { cache: "no-store" });
    if (res.ok) setInv(await res.json());
  }, [inv.id]);

  useEffect(() => {
    if (!POLL_STATUSES.has(inv.status)) return;
    const t = setInterval(refresh, 3500);
    return () => clearInterval(t);
  }, [inv.status, refresh]);

  const countdown = useCountdown(inv.status === "awaiting_payment" ? inv.payment?.quoteExpiresAt : undefined, renderedAt);
  const expiredNow = countdown?.ms === 0;
  useEffect(() => {
    if (expiredNow) void refresh();
  }, [expiredNow, refresh]);

  async function run(fn: () => Promise<PublicInvoice>) {
    setBusy(true);
    setError(null);
    try {
      setInv(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const settleSymbol = inv.settlementLabel.split(" on ")[0] || "USDC";
  const priceExpired = inv.status === "open" && !!inv.payment;

  return (
    <main className="checkout">
      <div className="checkout-card">
        <section className="checkout-summary" aria-labelledby="merchant-name">
          <div className="merchant">
            <Medallion seed={inv.merchantName} size={40} />
            <div>
              <p id="merchant-name" className="merchant-name">{inv.merchantName}</p>
              {!inv.livemode && <p className="chip chip-amber">Test mode</p>}
            </div>
          </div>
          <div className="summary-amount">
            <p className="soft">{inv.description}</p>
            <Amount value={inv.amount} currency={inv.currency} className="summary-total" />
            {inv.reference && <p className="small soft">Reference {inv.reference}</p>}
          </div>
          <ol className="route" aria-label="How this payment works">
            <li>
              <span className="route-dot route-amber" />
              <div>
                <p className="small" style={{ fontWeight: 600 }}>You pay in ZEC</p>
                <p className="small soft">From your shielded balance. Your wallet history stays private.</p>
              </div>
            </li>
            <li>
              <span className="route-dot route-ink" />
              <div>
                <p className="small" style={{ fontWeight: 600 }}>Converted by NEAR Intents</p>
                <p className="small soft">At the price shown, held while you pay.</p>
              </div>
            </li>
            <li>
              <span className="route-dot route-blue" />
              <div>
                <p className="small" style={{ fontWeight: 600 }}>{inv.merchantName} receives {settleSymbol}</p>
                <p className="small soft">{inv.settlementLabel}. Lona never holds the funds.</p>
              </div>
            </li>
          </ol>
          <p className="checkout-brand small soft">
            <Mark size={14} />
            <span>
              Checkout by <a href="/">Lona</a>
            </span>
          </p>
        </section>

        <section className="checkout-pay">
          <PayPanel
            id={inv.id}
            status={inv.status}
            merchantName={inv.merchantName}
            settleSymbol={settleSymbol}
            amount={inv.amount}
            payment={inv.payment}
            timer={countdown}
            errorSlot={error ? <p className="notice notice-error" role="alert">{error}</p> : null}
            startSlot={
              <div className="start">
                {priceExpired && <p className="notice">The price we held has expired. Get a new one to continue.</p>}
                <p className="soft">
                  You will get a ZEC amount and an address. Send it from any Zcash wallet with a shielded balance.
                </p>
                <details className="disclose">
                  <summary>Add your own refund address</summary>
                  <div className="field">
                    <label className="label" htmlFor="refund">Zcash refund address</label>
                    <input className="input addr" id="refund" value={refund} onChange={(e) => setRefund(e.target.value)} placeholder="t1..." spellCheck={false} autoComplete="off" />
                    <span className="hint">
                      If the payment cannot complete, your ZEC is returned here. Leave it empty and {inv.merchantName} handles any refund. Transparent addresses only (t1 or t3).
                    </span>
                  </div>
                </details>
                <button className="btn btn-primary btn-lg btn-block" onClick={() => run(() => post(`/api/pay/${inv.id}/start`, { refund_address: refund.trim() || null }))} disabled={busy}>
                  {busy ? "Getting your price" : priceExpired ? "Get a new price" : "Get payment details"}
                </button>
              </div>
            }
            sandboxSlot={
              !inv.livemode ? (
                <div className="sandbox-box">
                  <p className="small"><strong>Test mode.</strong> Pretend the customer paid and choose how it ends.</p>
                  <div className="btns">
                    {[
                      ["paid_out", "Pay in full"],
                      ["underpaid", "Underpay"],
                      ["refunded", "Refund"],
                      ["failed", "Fail"],
                    ].map(([o, l], i) => (
                      <button key={o} className={`btn ${i === 0 ? "btn-primary" : "btn-secondary"}`} onClick={() => run(() => post(`/api/pay/${inv.id}/simulate`, { outcome: o }))} disabled={busy}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null
            }
            footerSlot={
              inv.status === "paid_out" && inv.successUrl ? (
                <a href={inv.successUrl} className="btn btn-primary btn-lg btn-block">Return to {inv.merchantName}</a>
              ) : null
            }
          />
        </section>
      </div>
    </main>
  );
}
