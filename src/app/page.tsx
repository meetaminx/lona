import Link from "next/link";
import { HeroMotion } from "@/components/hero-motion";
import { Seal } from "@/components/seal";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { currentMerchant } from "@/lib/auth";
import { SETTLEMENT_ASSETS } from "@/lib/assets";
import { waveBand } from "@/lib/guilloche";
import { SITE } from "@/lib/site";

const closingBand = waveBand({ x0: 0, x1: 1440, yCenter: 70, lines: 14, amplitude: 26, wavelength: 360, spread: 60, step: 6 });

const STEPS = [
  {
    title: "Create an invoice or link",
    body: "Set an amount in dollars from the dashboard or the API. Share the link, show the QR at the counter or redirect from your cart.",
  },
  {
    title: "Your customer pays in ZEC",
    body: "Checkout shows the exact ZEC amount, held for 20 minutes. They scan and send from their shielded balance.",
  },
  {
    title: "The network converts it",
    body: "The swap network turns the ZEC into your stablecoin. Lona tracks every step and shows it to both of you.",
  },
  {
    title: "Paid out to your wallet",
    body: "The full invoice amount lands in your wallet and your server gets a signed webhook. No balance sits with Lona.",
  },
];

export default async function Home() {
  const merchant = await currentMerchant();
  return (
    <>
      <SiteHeader signedIn={!!merchant} />
      <main>
        <section className="hero">
          <div className="wrap">
            <h1 className="display">Take shielded Zcash. Get paid in USDC.</h1>
            <p className="hero-sub">
              Lona is checkout for merchants whose customers want privacy. They pay from a shielded Zcash wallet. You
              receive dollars on the chain you already use, with no ZEC on your books.
            </p>
            <div className="hero-actions">
              <Link href="/signup" className="btn btn-primary btn-lg">Create a merchant account</Link>
              <Link href="/docs" className="btn btn-secondary btn-lg">Read the API docs</Link>
            </div>
            <HeroMotion />
          </div>
        </section>

        <section className="section" id="how">
          <div className="wrap">
            <div className="section-head">
              <h2 className="h1">How a payment moves</h2>
              <p>
                Every invoice gets its own seal, drawn from its ID like the line work on a banknote. It fills in as the
                payment moves, so your customer can see exactly where their money is.
              </p>
            </div>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="step-num">{i + 1}</span>
                  <Seal id="inv_lona_demo_seal" stage={i + 1} tone={i === 3 ? "blue" : "amber"} size={120} />
                  <h3 className="h3">{s.title}</h3>
                  <p className="small soft">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h2 className="h1">What stays private, and what does not</h2>
              <p>
                Privacy claims in payments are easy to overstate. Here is exactly what a Lona payment reveals, so you can
                tell your customers the truth.
              </p>
            </div>
            <div className="split">
              <div className="ledger ledger-private">
                <h3 className="h3">Private</h3>
                <ul>
                  <li>
                    The customer&apos;s wallet balance
                    <span>Paid from the shielded pool, so their holdings are never shown on chain.</span>
                  </li>
                  <li>
                    The customer&apos;s payment history
                    <span>Other purchases and transfers from the same wallet cannot be linked to this one.</span>
                  </li>
                  <li>
                    The link between deposit and payout
                    <span>Confidential routing on the swap network keeps the ZEC deposit and your USDC payout from being tied together publicly.</span>
                  </li>
                  <li>
                    What was bought
                    <span>Descriptions and order references stay between you and Lona. They are never written on chain.</span>
                  </li>
                </ul>
              </div>
              <div className="ledger ledger-public">
                <h3 className="h3">Public</h3>
                <ul>
                  <li>
                    The ZEC amount sent to the deposit address
                    <span>The network accepts Zcash on transparent deposit addresses today, so the amount and time are visible.</span>
                  </li>
                  <li>
                    Your payout
                    <span>USDC arriving in your wallet is a normal transfer on Base, Arbitrum, Ethereum or Solana.</span>
                  </li>
                  <li>
                    Where your payout came from
                    <span>Anyone looking at your wallet can see the transfer was sent by the swap network.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="developers">
          <div className="wrap dev-grid">
            <div>
              <h2 className="h1">Three calls to integrate</h2>
              <p className="soft" style={{ marginTop: 16 }}>
                Create an invoice, send your customer to its hosted page, and listen for the webhook. Test mode simulates
                the whole lifecycle so you can build before touching real funds.
              </p>
              <ul>
                <li>Invoices and payment links priced in dollars</li>
                <li>Hosted checkout with QR and a live payment status</li>
                <li>Signed webhooks, retried for about a day if your server is down</li>
                <li>Separate test and live keys</li>
              </ul>
              <p style={{ marginTop: 28 }}>
                <Link href="/docs">Read the API reference</Link>
              </p>
            </div>
            <div className="code">
              <div className="code-tab">
                <span>server.ts</span>
              </div>
              <pre>
                <code>
                  <span className="c">{"// 1. Create an invoice"}</span>
                  {"\n"}
                  <span className="k">const</span>
                  {" res = "}
                  <span className="k">await</span>
                  {" fetch("}
                  <span className="s">{"`${LONA_URL}/api/v1/invoices`"}</span>
                  {", {\n  method: "}
                  <span className="s">{'"POST"'}</span>
                  {",\n  headers: { Authorization: "}
                  <span className="s">{"`Bearer ${LONA_KEY}`"}</span>
                  {" },\n  body: JSON.stringify({\n    amount: "}
                  <span className="s">{'"49.00"'}</span>
                  {",\n    description: "}
                  <span className="s">{'"Order 1042"'}</span>
                  {",\n  }),\n});\n"}
                  <span className="k">const</span>
                  {" invoice = "}
                  <span className="k">await</span>
                  {" res.json();\n\n"}
                  <span className="c">{"// 2. Send the customer to checkout"}</span>
                  {"\nredirect(invoice.hosted_url);\n\n"}
                  <span className="c">{"// 3. Fulfil the order when the money lands"}</span>
                  {"\napp.post("}
                  <span className="s">{'"/webhooks/lona"'}</span>
                  {", (req) => {\n  "}
                  <span className="k">if</span>
                  {" (!verifySignature(secret, req.signature, req.rawBody)) "}
                  <span className="k">return</span>
                  {";\n  "}
                  <span className="k">const</span>
                  {" event = req.body;\n  "}
                  <span className="k">if</span>
                  {" (event.type === "}
                  <span className="s">{'"invoice.paid_out"'}</span>
                  {")\n    fulfil(event.data.object.reference);\n});"}
                </code>
              </pre>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h2 className="h1">Where you can be paid</h2>
              <p>Pick one payout wallet. You can change it at any time; new invoices use the new setting.</p>
            </div>
            <div className="panel table-wrap">
              <table className="table assets-table">
                <thead>
                  <tr>
                    <th scope="col">Stablecoin</th>
                    <th scope="col">Network</th>
                    <th scope="col">Your address looks like</th>
                  </tr>
                </thead>
                <tbody>
                  {SETTLEMENT_ASSETS.map((a) => (
                    <tr key={a.key}>
                      <td>{a.symbol}</td>
                      <td>{a.chainName}</td>
                      <td className="soft">{a.family === "evm" ? "0x followed by 40 characters" : "32 to 44 characters, no 0x"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="section" id="pricing">
          <div className="wrap pricing">
            <div>
              <h2 className="h1">{SITE.feePercent}% per payment, added to the customer&apos;s quote</h2>
              <p className="soft measure" style={{ marginTop: 16 }}>
                You receive the full invoice amount. The ZEC price your customer sees already includes network costs and
                Lona&apos;s fee, so there is nothing to reconcile.
              </p>
            </div>
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
                <dd>Free, unlimited</dd>
              </div>
              <div>
                <dt>Custody of your funds</dt>
                <dd>Never</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="closing">
          <svg className="band-art" viewBox="0 0 1440 140" preserveAspectRatio="none" aria-hidden="true">
            {closingBand.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </svg>
          <div className="wrap" style={{ position: "relative" }}>
            <h2 className="h1" style={{ maxWidth: "18ch" }}>Start in test mode today. Go live when your wallet is set.</h2>
            <div className="hero-actions">
              <Link href="/signup" className="btn btn-primary btn-lg">Create a merchant account</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
