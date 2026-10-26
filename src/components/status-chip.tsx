import type { InvoiceStatus } from "@/db/schema";

const MAP: Record<InvoiceStatus, { label: string; tone: string }> = {
  open: { label: "Open", tone: "" },
  awaiting_payment: { label: "Awaiting payment", tone: "chip-amber" },
  payment_received: { label: "Payment received", tone: "chip-amber" },
  converting: { label: "Converting", tone: "chip-blue" },
  paid_out: { label: "Paid out", tone: "chip-green" },
  underpaid: { label: "Underpaid", tone: "chip-red" },
  refunded: { label: "Refunded", tone: "chip-red" },
  failed: { label: "Failed", tone: "chip-red" },
  expired: { label: "Expired", tone: "" },
  canceled: { label: "Canceled", tone: "" },
};

export function statusLabel(status: InvoiceStatus): string {
  return MAP[status]?.label ?? status;
}

export function StatusChip({ status }: { status: InvoiceStatus }) {
  const m = MAP[status] ?? { label: status, tone: "" };
  return <span className={`chip ${m.tone}`}>{m.label}</span>;
}
