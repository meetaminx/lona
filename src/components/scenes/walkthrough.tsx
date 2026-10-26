"use client";

import { useEffect, useState } from "react";
import { InvoiceComposer } from "./invoice-composer";
import { PayoutCard, WebhookCard } from "./notice-cards";
import { RouteVignette } from "./route-vignette";
import { WalletPhone } from "./wallet-phone";

const STEPS = [
  {
    title: "Create an invoice or a link",
    body: "Price it in dollars from the dashboard or one API call. Share the link, show the QR at the counter, or redirect from your cart.",
  },
  {
    title: "Your customer pays from a shielded wallet",
    body: "Checkout shows an exact ZEC amount, held for 20 minutes. They scan and send. Their balance and history never appear on chain.",
  },
  {
    title: "The swap network converts it",
    body: "NEAR Intents market makers compete to fill the conversion. The deposit and your payout are not publicly linked.",
  },
  {
    title: "The full amount lands in your wallet",
    body: "You receive exactly the invoice amount in USDC. Your server gets a signed webhook, so the order can ship.",
  },
];
const STEP_MS = 5200;

export function Walkthrough() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [sub, setSub] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);

  useEffect(() => {
    setSub(false);
    const s = setTimeout(() => setSub(true), 1500);
    if (!playing) return () => clearTimeout(s);
    const t = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), STEP_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(s);
    };
  }, [active, playing]);

  return (
    <div className="walk">
      <div className="walk-steps">
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.title} className={i === active ? "is-active" : ""}>
              <button type="button" onClick={() => setActive(i)} aria-current={i === active ? "step" : undefined}>
                <span className="walk-num">{i + 1}</span>
                <span className="walk-text">
                  <span className="h3">{s.title}</span>
                  <span className="walk-body soft">{s.body}</span>
                </span>
              </button>
              <span className="walk-progress" aria-hidden="true">
                <span key={`${active}-${playing}`} className={i === active && playing ? "is-running" : i === active ? "is-full" : ""} style={{ animationDuration: `${STEP_MS}ms` }} />
              </span>
            </li>
          ))}
        </ol>
        <button type="button" className="hs-toggle walk-toggle" onClick={() => setPlaying((p) => !p)} aria-pressed={!playing}>
          {playing ? "Pause walkthrough" : "Play walkthrough"}
        </button>
      </div>
      <div className="walk-stage" aria-live="off">
        <div key={active} className="walk-scene">
          {active === 0 && <InvoiceComposer created={sub} />}
          {active === 1 && (
            <div className="walk-phone">
              <WalletPhone state={sub ? "sent" : "review"} amount="3.216" address="t1Tj9cSiNQJbCmuFVPqkQhuvT2hkMEcmzoB" />
            </div>
          )}
          {active === 2 && <RouteVignette />}
          {active === 3 && (
            <div className="walk-stack">
              <PayoutCard visible amount="128.00" network="Base" />
              <WebhookCard
                lines={[
                  { t: "12:04:09", event: "invoice.payment_received", code: "200", on: true },
                  { t: "12:04:15", event: "invoice.paid_out", code: "200", on: sub },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
