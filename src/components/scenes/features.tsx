import { Medallion } from "@/components/medallion";
import { Qr } from "@/components/qr";
import { SealFrame } from "@/components/seal-frame";
import { SETTLEMENT_ASSETS } from "@/lib/assets";

export function Features() {
  return (
    <div className="bento">
      <article className="bento-card bento-wide">
        <div className="bento-vig vig-link" aria-hidden="true">
          <div className="link-card">
            <div>
              <p className="micro soft">Payment link</p>
              <p className="h3">Cupping class</p>
              <p className="link-price">25.00 USD</p>
              <p className="addr small soft">/l/k7q2m9xd4p</p>
            </div>
            <div className="link-qr">
              <Qr value="https://example.com/l/k7q2m9xd4p" label="" />
            </div>
          </div>
          <div className="link-visits">
            {["inv_8h2k", "inv_3mq9", "inv_v71c"].map((id, i) => (
              <div key={id} className="link-visit">
                <Medallion seed={id} size={22} tone={i === 0 ? "blue" : "amber"} />
                <span className="addr micro">{id}...</span>
                <span className={`chip ${i === 0 ? "chip-green" : "chip-amber"}`}>{i === 0 ? "Paid out" : "Awaiting payment"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bento-text">
          <h3 className="h3">Payment links you can share forever</h3>
          <p className="soft">Put one link on your site, in a post or on a printed QR at the counter. Every visit opens its own invoice, so payments never collide.</p>
        </div>
      </article>

      <article className="bento-card">
        <div className="bento-vig vig-seal" aria-hidden="true">
          <SealFrame id="inv_feature_seal_44" stage={4} tone="blue" size={170} />
        </div>
        <div className="bento-text">
          <h3 className="h3">A seal for every invoice</h3>
          <p className="soft">Each invoice draws its own pattern as the payment moves. Customers can see where their money is.</p>
        </div>
      </article>

      <article className="bento-card">
        <div className="bento-vig vig-net" aria-hidden="true">
          {SETTLEMENT_ASSETS.slice(0, 4).map((a, i) => (
            <div key={a.key} className={`net-opt ${i === 0 ? "is-on" : ""}`}>
              <span className="net-radio" />
              <Medallion seed={`net:${a.chainName}`} size={24} tone={i === 0 ? "blue" : "ink"} />
              <span className="small">
                {a.symbol} on {a.chainName}
              </span>
            </div>
          ))}
        </div>
        <div className="bento-text">
          <h3 className="h3">Your chain, your stablecoin</h3>
          <p className="soft">Choose USDC on Base, Arbitrum, Ethereum or Solana, or USDT on Ethereum. Change it any time.</p>
        </div>
      </article>

      <article className="bento-card">
        <div className="bento-vig vig-hook" aria-hidden="true">
          <p className="hook-sig">
            <span>Lona-Signature</span> t=1793016000,v1=5f2c09e1a4...
          </p>
          {["invoice.payment_received", "invoice.paid_out", "invoice.underpaid"].map((e, i) => (
            <p key={e} className="hook-ev">
              <span className={`hook-dot ${i === 2 ? "is-red" : ""}`} />
              {e}
            </p>
          ))}
        </div>
        <div className="bento-text">
          <h3 className="h3">Signed webhooks</h3>
          <p className="soft">Every change reaches your server signed with HMAC-SHA256, and is retried for about a day if you are down.</p>
        </div>
      </article>

      <article className="bento-card">
        <div className="bento-vig vig-test" aria-hidden="true">
          <p className="small"><strong>Test mode.</strong> Choose how it ends.</p>
          <div className="btns">
            <span className="btn btn-primary">Pay in full</span>
            <span className="btn btn-secondary">Underpay</span>
            <span className="btn btn-secondary">Refund</span>
          </div>
        </div>
        <div className="bento-text">
          <h3 className="h3">Every outcome, before real money</h3>
          <p className="soft">Test mode simulates payments, underpayments and refunds, with the same webhooks as live.</p>
        </div>
      </article>
    </div>
  );
}
