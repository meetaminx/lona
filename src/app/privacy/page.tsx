import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SITE } from "@/lib/site";

export const metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <article className="prose">
          <h1 className="h1">Privacy policy</h1>
          <p className="soft">Last updated 26 October 2026</p>
          <p>
            This policy explains what {SITE.legalName} (&quot;Lona&quot;, &quot;we&quot;) collects when merchants use the
            dashboard and API, and when customers pay through a Lona checkout page.
          </p>

          <h2 className="h2">Merchants</h2>
          <p>When you create an account we store:</p>
          <ul>
            <li>your business name, email address and a hashed password</li>
            <li>your payout wallet and Zcash refund address</li>
            <li>invoices, payment links, API key hashes and webhook endpoints you create</li>
            <li>basic request logs (IP address, time, page) kept for security for up to 30 days</li>
          </ul>

          <h2 className="h2">Customers paying at checkout</h2>
          <p>
            We do not ask customers to create an account. A checkout page records the payment details needed to complete the
            payment: the quoted ZEC amount, the deposit address, transaction hashes, and a refund address if the customer
            chooses to give one. We do not see or store the customer&apos;s wallet balance or history. Merchants may attach
            their own reference or a customer email to an invoice; that data belongs to the merchant.
          </p>

          <h2 className="h2">What is public on blockchains</h2>
          <p>
            Payments move on public networks. The ZEC amount sent to a deposit address and the stablecoin payout to the
            merchant&apos;s wallet are visible to anyone. We cannot remove or change data recorded on a blockchain.
          </p>

          <h2 className="h2">Who we share data with</h2>
          <ul>
            <li>The swap network (currently NEAR Intents through the 1Click API) receives the payout address, refund address and amounts it needs to complete each payment.</li>
            <li>Our hosting and database providers, who process data on our behalf.</li>
            <li>Authorities, where the law requires us to.</li>
          </ul>
          <p>We do not sell personal data and we do not use advertising trackers.</p>

          <h2 className="h2">Cookies</h2>
          <p>
            We use one cookie to keep you logged in and one to remember whether the dashboard is in test or live mode. Checkout
            pages set no cookies.
          </p>

          <h2 className="h2">Keeping and deleting data</h2>
          <p>
            We keep invoice records while your account is open and for as long as financial record-keeping rules require
            afterwards. You can ask us to export or delete your data by writing to{" "}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>

          <h2 className="h2">Your rights</h2>
          <p>
            Depending on where you live, you can ask to access, correct, delete or move your personal data, or object to how
            we use it. Contact us at the address above and we will reply within 30 days.
          </p>

          <h2 className="h2">Changes</h2>
          <p>If we change this policy in a way that matters, we will tell merchants by email before it takes effect.</p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
