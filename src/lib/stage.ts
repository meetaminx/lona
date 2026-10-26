import type { InvoiceStatus } from "@/db/schema";
import type { SealTone } from "@/components/seal";

/** How far the invoice seal is drawn for each status (DESIGN.md section 6). */
export function sealStage(status: InvoiceStatus): { stage: number; tone: SealTone } {
  switch (status) {
    case "open":
      return { stage: 0, tone: "amber" };
    case "awaiting_payment":
      return { stage: 1, tone: "amber" };
    case "payment_received":
      return { stage: 2, tone: "amber" };
    case "converting":
      return { stage: 3, tone: "amber" };
    case "paid_out":
      return { stage: 4, tone: "blue" };
    case "underpaid":
    case "refunded":
    case "failed":
      return { stage: 2, tone: "red" };
    case "expired":
    case "canceled":
      return { stage: 1, tone: "muted" };
  }
}
