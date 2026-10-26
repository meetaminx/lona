import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { merchants, paymentLinks } from "@/db/schema";
import { Mark } from "@/components/logo";
import { Medallion } from "@/components/medallion";
import { Amount } from "@/components/amount";
import { openPaymentLink } from "@/lib/links";
import { formatAmount } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

async function open(form: FormData) {
  "use server";
  const d = await db();
  const id = await openPaymentLink(d, String(form.get("slug")));
  redirect(`/pay/${id}`);
}

/** Landing step for a reusable link. The invoice is only created when the customer chooses to pay. */
export default async function LinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await db();
  const [link] = await d.select().from(paymentLinks).where(eq(paymentLinks.slug, slug));
  if (!link) notFound();
  const [m] = await d.select({ name: merchants.businessName }).from(merchants).where(eq(merchants.id, link.merchantId));
  return (
    <main className="checkout">
      <div className="checkout-card">
        <section className="checkout-summary">
          <div className="merchant">
            <Medallion seed={m?.name ?? "merchant"} size={40} />
            <div>
              <p className="merchant-name">{m?.name}</p>
              {!link.livemode && <p className="chip chip-amber">Test mode</p>}
            </div>
          </div>
          <div className="summary-amount">
            <p className="soft">{link.title}</p>
            <Amount value={formatAmount(link.amountCents)} currency="USD" className="summary-total" />
          </div>
          <p className="checkout-brand small soft">
            <Mark size={14} />
            <span>Checkout by <a href="/">Lona</a></span>
          </p>
        </section>
        <section className="checkout-pay">
          {link.active ? (
            <form action={open} className="start">
              <h2 className="h2">Pay with Zcash</h2>
              {link.description && <p className="soft">{link.description}</p>}
              <p className="soft">
                You pay from a shielded Zcash wallet. {m?.name} receives US dollars as a stablecoin. Your wallet history stays private.
              </p>
              <input type="hidden" name="slug" value={slug} />
              <button className="btn btn-primary btn-lg btn-block">Continue to payment</button>
            </form>
          ) : (
            <div className="start">
              <h2 className="h2">This link is turned off</h2>
              <p className="soft">Contact {m?.name} for another way to pay.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
