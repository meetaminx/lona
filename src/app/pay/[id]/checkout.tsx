"use client";

import { useCallback, useEffect, useState } from "react";
import { Mark } from "@/components/logo";
import { CopyButton } from "@/components/copy-button";
import { Seal } from "@/components/seal";
import type { PublicInvoice } from "@/lib/public-invoice";
import { sealStage } from "@/lib/stage";

const POLL_STATUSES = new Set(["awaiting_payment", "payment_received", "converting", "underpaid"]);

function useCountdown(until: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  const ms = Math.max(0, new Date(until).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { ms, label: `${m}:${s.toString().padStart(2, "0")}` };
}

function Qr({ value }: { value: string }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    let alive = true;
    import("qrcode").then((QR) =>
      QR.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#16223A", light: "#F7F8F9" } }).then(
        (s) => alive && setSvg(s),
      ),
    );
    return () => {
      alive = false;
    };
  }, [value]);
  return <div className="qr" role="img" aria-label="QR code with the payment address and amount" dangerouslySetInnerHTML={{ __html: svg }} />;
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong. Try again.");
  return json as PublicInvoice;
}

export function Checkout({ initial }: { initial: PublicInvoice }) {
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

  const countdown = useCountdown(inv.status === "awaiting_payment" ? inv.payment?.quoteExpiresAt : undefined);
  useEffect(() => {
    if (countdown && countdown.ms === 0) void refresh();
  }, [countdown?.ms === 0, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setInv(await post(`/api/pay/${inv.id}/start`, { refund_address: refund.trim() || null }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function simulate(outcome: string) {
    setBusy(true);
    setError(null);
    try {
      setInv(await post(`/api/pay/${inv.id}/simulate`, { outcome }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const { stage, tone } = sealStage(inv.status);
  const p = inv.payment;
  const priceExpired = inv.status === "open" && !!p;
  const zcashUri = p ? `zcash:${p.depositAddress}?amount=${p.zecAmount}` : "";
  const settle = inv.settlementLabel.split(" on ")[0] || "USDC";

  return (
    <main className="checkout">
      {!inv.livemode && (
        <p className="chip chip-amber" role="note">Test checkout. No real funds move.</p>
      )}
      <article className="ticket" aria-labelledby="ticket-merchant">
        <header className="ticket-top">
          <p id="ticket-merchant" className="ticket-merchant">{inv.merchantName}</p>
          <p className="ticket-desc">{inv.description}{inv.reference ? ` (${inv.reference})` : ""}</p>
          <p className="ticket-amount num">
            {inv.amount}
            <small>{inv.currency}</small>
          </p>
        </header>
        <div className="perf" aria-hidden="true" />

        <div className="ticket-body">
          {error && <p className="notice notice-error" role="alert">{error}</p>}

          {(inv.status === "open") && (
            <div className="reveal" style={{ display: "grid", gap: 16 }}>
              {priceExpired && <p className="notice">The price we held has expired. Get a new one to continue.</p>}
              <p className="soft">
                Pay with Zcash from your shielded balance. {inv.merchantName} receives {inv.settlementLabel}, and your wallet
                history stays private.
              </p>
              <details className="disclose">
                <summary>Add your own refund address</summary>
                <div className="field">
                  <label className="label" htmlFor="refund">Zcash refund address</label>
                  <input className="input addr" id="refund" value={refund} onChange={(e) => setRefund(e.target.value)} placeholder="t1..." spellCheck={false} autoComplete="off" />
                  <span className="hint">
                    If the payment cannot be completed, your ZEC is returned here. Leave empty and {inv.merchantName} will
                    handle any refund. Only transparent addresses (t1 or t3) are accepted.
                  </span>
                </div>
              </details>
              <button className="btn btn-primary btn-lg btn-block" onClick={start} disabled={busy}>
                {busy ? "Getting price" : priceExpired ? "Get a new price" : "Pay with Zcash"}
              </button>
            </div>
          )}

          {inv.status === "awaiting_payment" && p && (
            <div className="reveal" style={{ display: "grid", gap: 16 }}>
              <div className="pay-line">
                <div>
                  <p className="small soft">Send exactly</p>
                  <p className="pay-zec num">{p.zecAmount} ZEC</p>
                </div>
                <CopyButton value={p.zecAmount} label="Copy amount" />
              </div>
              <Qr value={zcashUri} />
              <div className="field">
                <span className="label">To this address</span>
                <div className="copy-field">
                  <span className="addr">{p.depositAddress}</span>
                  <CopyButton value={p.depositAddress} label="Copy address" />
                </div>
              </div>
              <p className="small soft">
                Price held for <span className="num" style={{ color: "var(--ink)", fontWeight: 500 }}>{countdown?.label}</span>.
                Send it in one transaction from your shielded balance. This page updates by itself.
              </p>
              {!inv.livemode && (
                <div className="sandbox-box">
                  <p className="small"><strong>Test mode.</strong> Pretend the customer paid, and choose how it ends.</p>
                  <div className="btns">
                    <button className="btn btn-primary" onClick={() => simulate("paid_out")} disabled={busy}>Pay in full</button>
                    <button className="btn btn-secondary" onClick={() => simulate("underpaid")} disabled={busy}>Underpay</button>
                    <button className="btn btn-secondary" onClick={() => simulate("refunded")} disabled={busy}>Refund</button>
                    <button className="btn btn-secondary" onClick={() => simulate("failed")} disabled={busy}>Fail</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {inv.status !== "open" && (
            <div className="seal-status">
              <Seal id={inv.id} stage={stage} tone={tone} size={96} label="Payment seal" />
              <div style={{ display: "grid", gap: 8 }} aria-live="polite">
                <StatusLine inv={inv} settle={settle} />
                {["awaiting_payment", "payment_received", "converting", "paid_out"].includes(inv.status) && (
                  <ol className="steps-mini">
                    {[
                      { key: "awaiting_payment", label: "Price held for you" },
                      { key: "payment_received", label: "Payment received" },
                      { key: "converting", label: `Converting to ${settle}` },
                      { key: "paid_out", label: `Paid to ${inv.merchantName}` },
                    ].map((s, i) => {
                      const cur = ["awaiting_payment", "payment_received", "converting", "paid_out"].indexOf(inv.status);
                      const cls = i < cur || inv.status === "paid_out" ? "done" : i === cur ? "now" : "";
                      return <li key={s.key} className={cls}>{s.label}</li>;
                    })}
                  </ol>
                )}
              </div>
            </div>
          )}

          {inv.status === "paid_out" && inv.successUrl && (
            <a href={inv.successUrl} className="btn btn-primary btn-lg btn-block">Return to {inv.merchantName}</a>
          )}
        </div>
      </article>
      <p className="checkout-foot">
        <Mark size={16} />
        <span>
          Checkout by <a href="/">Lona</a>. Lona never holds your funds.
        </span>
      </p>
    </main>
  );
}

function StatusLine({ inv, settle }: { inv: PublicInvoice; settle: string }) {
  const text: Record<string, [string, string]> = {
    awaiting_payment: ["Waiting for your payment", "Send the ZEC above. It usually shows up here within a few minutes."],
    payment_received: ["Payment received", `Your ZEC has arrived. It is being converted to ${settle}.`],
    converting: ["Converting", `Your ZEC is being converted and sent to ${inv.merchantName}.`],
    paid_out: ["Paid", `${inv.merchantName} received ${inv.amount} ${settle}. You can close this page.`],
    underpaid: ["Less than the full amount arrived", "The payment cannot complete. Your ZEC will be returned to the refund address."],
    refunded: ["Refunded", "The payment could not complete, so the ZEC was returned to the refund address."],
    failed: ["Payment failed", `The conversion did not complete. Contact ${inv.merchantName} with this page's link.`],
    expired: ["This invoice has expired", `Ask ${inv.merchantName} for a new one.`],
    canceled: ["This invoice was canceled", `Contact ${inv.merchantName} if you still want to pay.`],
  };
  const [title, body] = text[inv.status] ?? ["", ""];
  return (
    <div>
      <p style={{ fontWeight: 600 }}>{title}</p>
      <p className="small soft">{body}</p>
    </div>
  );
}
