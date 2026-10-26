import { Medallion } from "@/components/medallion";

/** The merchant's side: a payout landing in their wallet. */
export function PayoutCard({ visible, amount, network }: { visible: boolean; amount: string; network: string }) {
  return (
    <div className={`notice-card payout-card ${visible ? "is-in" : ""}`} aria-hidden="true">
      <Medallion seed={`net:${network}`} size={34} tone="blue" />
      <div>
        <p className="nc-title">Payout received</p>
        <p className="nc-sub">Your wallet on {network}</p>
      </div>
      <p className="nc-amount">
        +{amount} <span>USDC</span>
      </p>
    </div>
  );
}

/** The developer's side: the signed webhook hitting their server. */
export function WebhookCard({ lines }: { lines: { t: string; event: string; code: string; on: boolean }[] }) {
  return (
    <div className="notice-card webhook-card" aria-hidden="true">
      <p className="wh-head">
        <span className="wh-dot" /> POST /webhooks/lona
      </p>
      {lines.map((l) => (
        <p key={l.event} className={`wh-line ${l.on ? "is-on" : ""}`}>
          <span className="wh-t">{l.t}</span>
          <span className="wh-e">{l.event}</span>
          <span className="wh-c">{l.code}</span>
        </p>
      ))}
    </div>
  );
}
