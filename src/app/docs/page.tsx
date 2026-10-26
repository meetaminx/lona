import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { EVENT_TYPES } from "@/lib/webhooks";
import { DocCode, Endpoint } from "@/components/doc-code";
import { ratePerMin } from "@/lib/api";

export const metadata = { title: "API reference" };

const TOC = [
  ["overview", "Overview"],
  ["auth", "Authentication"],
  ["idempotency", "Safe retries"],
  ["rate-limits", "Rate limits"],
  ["invoices", "Invoices"],
  ["statuses", "Invoice statuses"],
  ["links", "Payment links"],
  ["webhooks", "Webhooks"],
  ["test-mode", "Test mode"],
  ["errors", "Errors"],
];

const STATUSES: [string, string][] = [
  ["open", "Created. The customer has not opened checkout, or the price they were shown expired."],
  ["awaiting_payment", "The customer has a ZEC price and deposit address, held for 20 minutes."],
  ["payment_received", "The deposit has been seen on the Zcash network."],
  ["converting", "The swap network is converting ZEC to your stablecoin."],
  ["paid_out", "The full amount reached your payout wallet. Fulfil the order."],
  ["underpaid", "Less ZEC than quoted arrived. The network returns it to the refund address."],
  ["refunded", "The ZEC went back to the refund address. Nothing was paid out."],
  ["failed", "The conversion did not complete. Contact support with the invoice ID."],
  ["expired", "Nobody paid before the invoice's expiry time."],
  ["canceled", "You canceled it before any payment arrived."],
];

export default function Docs() {
  return (
    <>
      <SiteHeader />
      <div className="wrap docs-layout">
        <nav className="docs-toc" aria-label="On this page">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`}>{label}</a>
          ))}
        </nav>
        <article className="prose">
          <h1 className="h1" id="overview">API reference</h1>
          <p className="soft">
            The Lona API is JSON over HTTPS. You create an invoice in US dollars, send the customer to its{" "}
            <code>hosted_url</code>, and wait for the <code>invoice.paid_out</code> webhook. Lona never holds funds: the
            customer pays a deposit address on the swap network, which pays your wallet directly.
          </p>

          <h2 className="h2" id="auth">Authentication</h2>
          <p>
            Create a secret key under Developers in the dashboard. Test keys start with <code>lona_sk_test_</code> and live
            keys with <code>lona_sk_live_</code>. The key decides the mode of everything you create with it.
          </p>
          <DocCode>{`Authorization: Bearer lona_sk_test_...`}</DocCode>

          <h3 className="h3" id="idempotency">Safe retries</h3>
          <p>
            Send an <code>Idempotency-Key</code> header with any POST. If the network drops and you retry with the same key
            and body, you get the original response back (marked <code>Idempotent-Replayed: true</code>) instead of a
            second invoice. Keys are kept for 24 hours. Reusing a key with a different body returns <code>422</code>.
          </p>
          <DocCode>{`curl -X POST https://<your-domain>/api/v1/invoices \\
  -H "Authorization: Bearer $LONA_SECRET_KEY" \\
  -H "Idempotency-Key: order_1042" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":"49.00","description":"Order 1042"}'`}</DocCode>

          <h3 className="h3" id="rate-limits">Rate limits</h3>
          <p>
            Each key can make {ratePerMin()} requests a minute. Every response carries <code>X-RateLimit-Limit</code>,{" "}
            <code>X-RateLimit-Remaining</code> and <code>X-RateLimit-Reset</code> (seconds). Over the limit you get{" "}
            <code>429</code> with <code>Retry-After</code>.
          </p>

          <h2 className="h2" id="invoices">Invoices</h2>
          <h3 className="h3">Create an invoice</h3>
          <Endpoint method="POST" path="/api/v1/invoices" />
          <DocCode label="Request body">{`{
  "amount": "49.00",                 // US dollars, 1.00 to 100,000.00
  "description": "Order 1042",       // shown at checkout
  "reference": "order_1042",         // optional, returned in webhooks
  "customer_email": "a@example.com", // optional
  "success_url": "https://shop.example/thanks", // optional
  "metadata": { "cart": "c_88" },    // optional, string values
  "expires_in_minutes": 1440         // optional, 15 to 43200, default 1440
}`}</DocCode>
          <p>Returns the invoice with status <code>201</code>:</p>
          <DocCode>{`{
  "id": "inv_8h2k...",
  "object": "invoice",
  "livemode": false,
  "status": "open",
  "amount": "49.00",
  "currency": "USD",
  "description": "Order 1042",
  "reference": "order_1042",
  "hosted_url": "https://<your-domain>/pay/inv_8h2k...",
  "settlement": { "asset": "USDC", "chain": "Base", "address": "0x..." },
  "payment": null,
  "expires_at": "2026-10-27T12:00:00.000Z",
  "paid_out_at": null,
  "created_at": "2026-10-26T12:00:00.000Z"
}`}</DocCode>
          <p>
            Once the customer opens checkout, <code>payment</code> holds the ZEC amount, deposit address, how long the price is
            held, the network status and transaction hashes.
          </p>
          <h3 className="h3">Retrieve an invoice</h3>
          <Endpoint method="GET" path="/api/v1/invoices/:id" />
          <p>Fetching an invoice also refreshes its payment status from the network.</p>
          <h3 className="h3">List invoices</h3>
          <Endpoint method="GET" path="/api/v1/invoices" />
          <p>
            Newest first. Query parameters: <code>limit</code> (1 to 100, default 25), <code>status</code>,{" "}
            <code>reference</code>, and <code>starting_after</code> (an invoice ID) to get the next page. The response has{" "}
            <code>has_more</code> when another page exists.
          </p>
          <DocCode>{`GET /api/v1/invoices?status=paid_out&limit=50
GET /api/v1/invoices?starting_after=inv_8h2k...`}</DocCode>
          <h3 className="h3">Cancel an invoice</h3>
          <Endpoint method="POST" path="/api/v1/invoices/:id/cancel" />
          <p>Only invoices with no payment on the way can be canceled.</p>

          <h2 className="h2" id="statuses">Invoice statuses</h2>
          <table className="table">
            <tbody>
              {STATUSES.map(([s, d]) => (
                <tr key={s}><td><code>{s}</code></td><td>{d}</td></tr>
              ))}
            </tbody>
          </table>

          <h2 className="h2" id="links">Payment links</h2>
          <p>A reusable link with a fixed amount. Each customer who continues to payment gets a new invoice.</p>
          <Endpoint method="POST" path="/api/v1/payment_links" />
          <DocCode>{`{ "title": "Workshop ticket", "amount": "25.00", "description": "Optional" }`}</DocCode>
          <Endpoint method="GET" path="/api/v1/payment_links" />

          <h2 className="h2" id="webhooks">Webhooks</h2>
          <p>Add an endpoint under Developers. Lona sends a <code>POST</code> with this body for each event:</p>
          <DocCode>{`{
  "id": "evt_...",
  "type": "invoice.paid_out",
  "created": 1793016000,
  "livemode": true,
  "data": { "object": { /* the invoice */ } }
}`}</DocCode>
          <p>
            Use <strong>Send test event</strong> under Developers to deliver a signed <code>test.ping</code> to your endpoint
            and see the response. <strong>Roll secret</strong> replaces the signing secret immediately. Webhook URLs must be
            public addresses; for local development use a tunnel.
          </p>
          <p>Event types:</p>
          <ul>
            {EVENT_TYPES.map((t) => (
              <li key={t}><code>{t}</code></li>
            ))}
          </ul>
          <p>
            Respond with any 2xx status within 10 seconds. Otherwise Lona retries after 1, 5, 30, 120, 360 and 720 minutes.
            Events can arrive more than once; use the event <code>id</code> to ignore repeats.
          </p>
          <h3 className="h3">Verify the signature</h3>
          <p>
            Each request carries a <code>Lona-Signature</code> header of the form <code>t=timestamp,v1=hex</code>. The
            signature is an HMAC-SHA256 of <code>timestamp + &quot;.&quot; + raw body</code> with your endpoint&apos;s signing
            secret.
          </p>
          <DocCode>{`import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySignature(secret, header, rawBody, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest();
  const given = Buffer.from(parts.v1 ?? "", "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}`}</DocCode>

          <h2 className="h2" id="test-mode">Test mode</h2>
          <p>
            The swap network has no test network, so Lona simulates it. Test invoices get a fixed test price and a made-up
            deposit address. On the test checkout page, choose how the payment ends: paid in full, underpaid, refunded or
            failed. The same statuses and webhooks fire as in live mode.
          </p>

          <h2 className="h2" id="errors">Errors</h2>
          <p>Errors use standard HTTP status codes and this body:</p>
          <DocCode>{`{ "error": { "code": "settlement_not_configured", "message": "Set a payout wallet in Settlement before creating invoices." } }`}</DocCode>
        </article>
      </div>
      <SiteFooter />
    </>
  );
}
