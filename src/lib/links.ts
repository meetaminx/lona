import { and, desc, eq } from "drizzle-orm";
import type { DB } from "@/db";
import { paymentLinks, type PaymentLink } from "@/db/schema";
import { newId, newSlug } from "@/lib/ids";
import { appUrl, createInvoice, InvoiceError } from "@/lib/invoices";
import { formatAmount } from "@/lib/money";

export function linkUrl(slug: string): string {
  return `${appUrl()}/l/${slug}`;
}

export async function createPaymentLink(
  d: DB,
  merchantId: string,
  livemode: boolean,
  input: { title: string; description?: string | null; amountCents: number },
): Promise<PaymentLink> {
  const [link] = await d
    .insert(paymentLinks)
    .values({
      id: newId("lnk"),
      merchantId,
      livemode,
      slug: newSlug(),
      title: input.title.trim().slice(0, 120),
      description: input.description?.trim().slice(0, 300) || null,
      amountCents: input.amountCents,
    })
    .returning();
  return link;
}

export async function listPaymentLinks(d: DB, merchantId: string, livemode: boolean) {
  return d
    .select()
    .from(paymentLinks)
    .where(and(eq(paymentLinks.merchantId, merchantId), eq(paymentLinks.livemode, livemode)))
    .orderBy(desc(paymentLinks.createdAt));
}

/** Each visit to a payment link opens a fresh invoice, so payments never collide. */
export async function openPaymentLink(d: DB, slug: string): Promise<string> {
  const [link] = await d.select().from(paymentLinks).where(eq(paymentLinks.slug, slug));
  if (!link || !link.active) throw new InvoiceError("This payment link is no longer active.", 404, "link_inactive");
  const inv = await createInvoice(d, link.merchantId, link.livemode, {
    amountCents: link.amountCents,
    description: link.title,
    paymentLinkId: link.id,
    expiresInMinutes: 60 * 6,
  });
  return inv.id;
}

export function serializeLink(link: PaymentLink) {
  return {
    id: link.id,
    object: "payment_link",
    livemode: link.livemode,
    url: linkUrl(link.slug),
    title: link.title,
    description: link.description,
    amount: formatAmount(link.amountCents),
    currency: "USD",
    active: link.active,
    created_at: link.createdAt.toISOString(),
  };
}
