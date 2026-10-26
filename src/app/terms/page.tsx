import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SITE } from "@/lib/site";

export const metadata = { title: "Terms" };

export default function Terms() {
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <article className="prose">
          <h1 className="h1">Terms of service</h1>
          <p className="soft">Last updated 26 October 2026</p>
          <p>
            These terms are an agreement between you and {SITE.legalName} (&quot;Lona&quot;) for use of the Lona dashboard,
            API and checkout pages. By creating an account you accept them.
          </p>

          <h2 className="h2">What Lona does</h2>
          <p>
            Lona provides software that creates invoices and payment pages, requests conversion quotes from third-party swap
            networks, and tracks payments. Lona does not take custody of funds. Customers pay a deposit address controlled
            by the swap network, which sends the converted funds directly to the payout wallet you set.
          </p>

          <h2 className="h2">Your responsibilities</h2>
          <ul>
            <li>Give accurate account details and keep your password and API keys secret.</li>
            <li>Make sure your payout and refund addresses are correct and under your control. Payments sent to a wrong address cannot be recovered.</li>
            <li>Comply with the laws that apply to your business, including tax, consumer protection, sanctions and anti-money-laundering rules.</li>
            <li>Do not use Lona to sell anything illegal where you or your customer are, or to move funds for others.</li>
          </ul>

          <h2 className="h2">Third-party swap networks</h2>
          <p>
            Conversions are carried out by third parties, currently NEAR Intents through the 1Click API, under their own
            terms. Prices are quotes that expire. Networks may delay, refund or decline payments, including under their own
            risk and compliance checks. Lona is not responsible for their actions, but will help you trace any payment.
          </p>

          <h2 className="h2">Fees</h2>
          <p>
            Lona&apos;s fee is {SITE.feePercent}% of each payment that reaches your payout wallet, included in the quote shown
            to the customer. Network fees are also included in the quote. We will give 30 days&apos; notice before changing
            fees.
          </p>

          <h2 className="h2">Refunds and disputes</h2>
          <p>
            Payments that arrive in your wallet are final on the blockchain. Refunds to customers after payout are your
            decision and your responsibility. Failed or underpaid conversions are returned by the swap network to the refund
            address on the invoice.
          </p>

          <h2 className="h2">Suspension</h2>
          <p>
            We may suspend accounts that break these terms or that we reasonably believe are being used for fraud or other
            illegal activity. We will tell you why unless the law prevents us.
          </p>

          <h2 className="h2">Liability</h2>
          <p>
            Lona is provided as is. To the extent the law allows, our total liability to you for any claim is limited to the
            fees you paid us in the 3 months before the claim. We are not liable for losses caused by blockchain networks,
            swap networks, wallet software or incorrect addresses.
          </p>

          <h2 className="h2">Ending the agreement</h2>
          <p>You can close your account at any time. Invoices already paid out are unaffected.</p>

          <h2 className="h2">Contact</h2>
          <p>
            Questions about these terms: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
