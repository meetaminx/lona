import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { merchants, paymentLinks } from "@/db/schema";
import { Mark } from "@/components/logo";
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
      {!link.livemode && <p className="chip chip-amber" role="note">Test checkout. No real funds move.</p>}
      <article className="ticket">
        <header className="ticket-top">
          <p className="ticket-merchant">{m?.name}</p>
          <p className="ticket-desc">{link.title}</p>
          <p className="ticket-amount num">{formatAmount(link.amountCents)}<small>USD</small></p>
        </header>
        <div className="perf" aria-hidden="true" />
        <div className="ticket-body">
          {link.active ? (
            <form action={open} style={{ display: "grid", gap: 14 }}>
              {link.description && <p className="soft">{link.description}</p>}
              <input type="hidden" name="slug" value={slug} />
              <button className="btn btn-primary btn-lg btn-block">Continue to payment</button>
            </form>
          ) : (
            <p className="soft">This payment link has been turned off. Contact {m?.name} for another way to pay.</p>
          )}
        </div>
      </article>
      <p className="checkout-foot"><Mark size={16} /><span>Checkout by <a href="/">Lona</a>.</span></p>
    </main>
  );
}
