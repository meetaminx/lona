import { Coin } from "@/components/coin";
import Link from "next/link";
import { SealFrame } from "@/components/seal-frame";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { CodeTabs } from "@/components/scenes/code-tabs";
import { Faq } from "@/components/scenes/faq";
import { Features } from "@/components/scenes/features";
import { HeroScene } from "@/components/scenes/hero-scene";
import { Observer } from "@/components/scenes/observer";
import { Walkthrough } from "@/components/scenes/walkthrough";
import { currentMerchant } from "@/lib/auth";
import { rosette } from "@/lib/guilloche";
import { liveZecPrice } from "@/lib/price";
import { SITE } from "@/lib/site";

const ghost = [
  rosette({ cx: 400, cy: 400, radius: 390, R: 64, r: 13, d: 15, rotation: 0.2, samplesPerTurn: 240 }),
  rosette({ cx: 400, cy: 400, radius: 270, R: 45, r: 11, d: 13, rotation: 0.9, samplesPerTurn: 240 }),
];

const NETWORKS = ["Base", "Arbitrum", "Ethereum", "Solana"];

export default async function Home() {
  const [merchant, price] = await Promise.all([currentMerchant(), liveZecPrice()]);
  const priceTime = price
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(price.at)
    : null;

  return (
    <>
      <SiteHeader signedIn={!!merchant} />
      <main>
        <section className="hero2">
          <div className="grid-lines" aria-hidden="true" />
          <svg className="hero2-ghost" viewBox="0 0 800 800" aria-hidden="true">
            {ghost.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </svg>
          <div className="wrap hero2-grid">
            <div className="hero2-copy">
              {price && (
                <p className="live-price">
                  <span className="live-dot" aria-hidden="true" />
                  ZEC is ${price.usd.toFixed(2)} on NEAR Intents at {priceTime} UTC
                </p>
              )}
              <h1 className="display">Accept shielded Zcash. Settle in USDC.</h1>
              <p className="lede">
                Checkout for merchants whose customers want privacy. They pay from a shielded Zcash wallet. You receive the
                exact invoice amount in dollars, on the chain you already use.
              </p>
              <div className="hero-actions">
                <Link href="/signup" className="btn btn-primary btn-lg">Create a merchant account</Link>
                <Link href="#how" className="btn btn-secondary btn-lg">See how it works</Link>
              </div>
              <p className="disclosure">
                Lona is payment software, not a bank or exchange. Conversions are carried out by NEAR Intents. Lona never
                holds your funds.
              </p>
            </div>
            <HeroScene />
          </div>
        </section>

        <section className="networks" aria-label="Where you can be paid">
          <div className="wrap networks-row">
            <p className="small soft">Get paid on</p>
            <ul>
              {NETWORKS.map((n) => (
                <li key={n}>
                  <Coin seed={`net:${n}`} size={40} metal="blue" />
                  <span>{n}</span>
                </li>
              ))}
              <li className="networks-via">
                <Coin seed="net:NEAR Intents" size={40} metal="steel" />
                <span>Converted by NEAR Intents</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="section2" id="how">
          <div className="wrap">
            <div className="section-head">
              <h2 className="h1">From invoice to payout in four steps</h2>
              <p>Your customer never touches a bridge, and you never touch ZEC.</p>
            </div>
            <Walkthrough />
          </div>
        </section>

        <section className="night">
          <div className="grid-lines grid-lines-night" aria-hidden="true" />
          <div className="wrap">
            <div className="section-head">
              <h2 className="h1">What a chain observer sees</h2>
              <p>
                Privacy claims in payments are easy to overstate. This is exactly what is public and what is not for one
                Lona payment, so you can tell your customers the truth.
              </p>
            </div>
            <Observer />
          </div>
        </section>

        <section className="section2">
          <div className="wrap">
            <div className="section-head">
              <h2 className="h1">Everything a checkout needs, nothing it does not</h2>
              <p>Invoices, links, QR, payouts and webhooks. No balance to manage, no ZEC on your books.</p>
            </div>
            <Features />
          </div>
        </section>

        <section className="section2 dev2" id="developers">
          <div className="wrap dev2-grid">
            <div>
              <h2 className="h1">Integrate in an afternoon</h2>
              <p className="lede" style={{ marginTop: 16 }}>
                Create an invoice, send the customer to its hosted page, fulfil on the webhook. The same three steps in test
                mode and live.
              </p>
              <dl className="dev-facts">
                <div>
                  <dt>Prices</dt>
                  <dd>In US dollars. The ZEC amount is set at checkout.</dd>
                </div>
                <div>
                  <dt>Keys</dt>
                  <dd>Separate test and live secret keys, stored hashed.</dd>
                </div>
                <div>
                  <dt>Events</dt>
                  <dd>Received, paid out, underpaid, refunded, failed, expired.</dd>
                </div>
              </dl>
              <p style={{ marginTop: 24 }}>
                <Link href="/docs" className="btn btn-secondary">Read the API reference</Link>
              </p>
            </div>
            <CodeTabs />
          </div>
        </section>

        <section className="section2" id="pricing">
          <div className="wrap pricing2">
            <div className="price-card">
              <p className="h3">Pricing</p>
              <p className="price-big">
                {SITE.feePercent}%<span> per payment</span>
              </p>
              <p className="soft">
                Added to your customer&apos;s quote. You receive the full invoice amount, with nothing to reconcile.
              </p>
              <dl>
                <div>
                  <dt>Monthly fee</dt>
                  <dd>None</dd>
                </div>
                <div>
                  <dt>Expired, refunded or failed payments</dt>
                  <dd>No fee</dd>
                </div>
                <div>
                  <dt>Test mode</dt>
                  <dd>Free</dd>
                </div>
              </dl>
              <Link href="/signup" className="btn btn-primary btn-lg btn-block">Create a merchant account</Link>
            </div>
            <div>
              <h2 className="h1" style={{ marginBottom: 24 }}>Questions merchants ask</h2>
              <Faq />
            </div>
          </div>
        </section>

        <section className="night closing2">
          <div className="grid-lines grid-lines-night" aria-hidden="true" />
          <div className="wrap closing2-grid">
            <div>
              <h2 className="display" style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.6rem)" }}>
                Your first private payment is a few minutes away.
              </h2>
              <p className="lede" style={{ marginTop: 20 }}>
                Start in test mode. Go live when your payout wallet is set.
              </p>
              <div className="hero-actions">
                <Link href="/signup" className="btn btn-primary btn-lg">Create a merchant account</Link>
                <Link href="/docs" className="btn btn-ghost-night btn-lg">Read the docs</Link>
              </div>
            </div>
            <div className="closing2-seal" aria-hidden="true">
              <SealFrame id="inv_lona_closing_seal" stage={4} tone="amber" size={340} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
