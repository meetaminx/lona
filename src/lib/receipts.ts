import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import { invoices, merchants } from "@/db/schema";
import { assetLabel, getSettlementAsset } from "@/lib/assets";
import { attemptsFor, hostedUrl, primaryAttempt } from "@/lib/invoices";
import { layout, sendMail } from "@/lib/mailer";
import { formatAmount } from "@/lib/money";

/**
 * Email the customer a receipt once an invoice is paid out, if the merchant has receipts on and
 * the invoice has a customer email. Claims the invoice first so a receipt is never sent twice.
 */
export async function sendReceipt(d: DB, invoiceId: string): Promise<boolean> {
  const [row] = await d
    .select({ inv: invoices, m: merchants })
    .from(invoices)
    .innerJoin(merchants, eq(merchants.id, invoices.merchantId))
    .where(eq(invoices.id, invoiceId));
  if (!row || row.inv.status !== "paid_out" || !row.inv.customerEmail || !row.m.sendReceipts) return false;

  const [claimed] = await d
    .update(invoices)
    .set({ receiptSentAt: new Date() })
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.receiptSentAt)))
    .returning({ id: invoices.id });
  if (!claimed) return false;

  const { inv, m } = row;
  const attempt = primaryAttempt(await attemptsFor(d, inv.id));
  const asset = getSettlementAsset(inv.settlementAssetKey);
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(inv.paidOutAt ?? new Date());
  const { html, text } = layout({
    heading: `Receipt from ${m.businessName}`,
    body: [
      `${inv.description}${inv.reference ? ` (${inv.reference})` : ""}`,
      `Amount: ${formatAmount(inv.amountCents)} USD`,
      attempt ? `You paid: ${attempt.amountInFormatted} ZEC from a shielded wallet` : "",
      `${m.businessName} received ${asset ? assetLabel(asset) : "the payment"} on ${when} UTC.`,
      m.supportEmail ? `Questions about this order? Reply to ${m.supportEmail}.` : "",
    ].filter(Boolean),
    action: { label: "View payment", url: hostedUrl(inv.id) },
    footer: `Invoice ${inv.id}. Checkout by Lona, which never holds customer funds.`,
  });
  const res = await sendMail({ to: inv.customerEmail!, subject: `Your receipt from ${m.businessName}`, html, text });
  if (!res.delivered && process.env.RESEND_API_KEY) {
    // Delivery failed with email configured: release the claim so the next sync can retry.
    await d.update(invoices).set({ receiptSentAt: null }).where(eq(invoices.id, invoiceId));
    return false;
  }
  return res.delivered;
}
