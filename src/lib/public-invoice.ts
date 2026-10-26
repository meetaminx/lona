import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { merchants, type Invoice, type PaymentAttempt } from "@/db/schema";
import { assetLabel, getSettlementAsset } from "@/lib/assets";
import { formatAmount } from "@/lib/money";

/** What the customer's checkout page is allowed to see. */
export async function publicInvoice(d: DB, inv: Invoice, attempt?: PaymentAttempt) {
  const [m] = await d.select({ name: merchants.businessName }).from(merchants).where(eq(merchants.id, inv.merchantId));
  const asset = getSettlementAsset(inv.settlementAssetKey);
  return {
    id: inv.id,
    livemode: inv.livemode,
    merchantName: m?.name ?? "Merchant",
    description: inv.description,
    reference: inv.reference,
    amount: formatAmount(inv.amountCents),
    currency: inv.currency,
    status: inv.status,
    settlementLabel: asset ? assetLabel(asset) : "",
    expiresAt: inv.expiresAt.toISOString(),
    successUrl: inv.successUrl,
    payment: attempt
      ? {
          zecAmount: attempt.amountInFormatted,
          depositAddress: attempt.depositAddress,
          depositMemo: attempt.depositMemo,
          quoteExpiresAt: attempt.quoteDeadline.toISOString(),
          networkStatus: attempt.providerStatus,
          depositTxs: attempt.originTxs,
          payoutTxs: attempt.destinationTxs,
          customRefund: attempt.refundAddress !== inv.refundAddress,
        }
      : null,
  };
}

export type PublicInvoice = Awaited<ReturnType<typeof publicInvoice>>;
