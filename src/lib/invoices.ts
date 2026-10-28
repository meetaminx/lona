import { and, desc, eq, gt, inArray, lt, notInArray } from "drizzle-orm";
import type { DB } from "@/db";
import {
  merchants,
  invoices,
  paymentAttempts,
  settlementSettings,
  type Invoice,
  type InvoiceStatus,
  type PaymentAttempt,
  type ProviderStatus,
} from "@/db/schema";
import { assetLabel, checkZcashRefundAddress, getSettlementAsset, ZEC } from "@/lib/assets";
import { newId } from "@/lib/ids";
import { centsToBaseUnits, formatAmount } from "@/lib/money";
import { providerByName, providerFor, ProviderError } from "@/lib/providers";
import { sandboxStartState, type SandboxOutcome } from "@/lib/providers/sandbox";
import { emitEvent, deliverMany, type EventType } from "@/lib/webhooks";

export const QUOTE_TTL_MIN = Number(process.env.LONA_QUOTE_TTL_MIN ?? "20");
const LATE_DEPOSIT_GRACE_MS = 2 * 60 * 60_000;
const SYNC_THROTTLE_MS = 4_000;

export const TERMINAL: InvoiceStatus[] = ["paid_out", "refunded", "failed", "expired", "canceled"];
const PROVIDER_TERMINAL: ProviderStatus[] = ["SUCCESS", "REFUNDED", "FAILED"];

export class InvoiceError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "invalid_request") {
    super(message);
  }
}

export { appUrl } from "@/lib/url";
import { appUrl } from "@/lib/url";

export function hostedUrl(invoiceId: string): string {
  return `${appUrl()}/pay/${invoiceId}`;
}

// ---------- Create ----------

export type CreateInvoiceInput = {
  amountCents: number;
  description: string;
  reference?: string | null;
  customerEmail?: string | null;
  successUrl?: string | null;
  metadata?: Record<string, string>;
  expiresInMinutes?: number;
  paymentLinkId?: string | null;
};

export async function createInvoice(d: DB, merchantId: string, livemode: boolean, input: CreateInvoiceInput): Promise<Invoice> {
  const [settings] = await d.select().from(settlementSettings).where(eq(settlementSettings.merchantId, merchantId));
  if (!settings) {
    throw new InvoiceError("Set a payout wallet in Settlement before creating invoices.", 409, "settlement_not_configured");
  }
  const expiresIn = Math.min(Math.max(input.expiresInMinutes ?? 60 * 24, 15), 60 * 24 * 30);
  const [merchant] = await d.select({ defaultSuccessUrl: merchants.defaultSuccessUrl }).from(merchants).where(eq(merchants.id, merchantId));
  const [inv] = await d
    .insert(invoices)
    .values({
      id: newId("inv"),
      merchantId,
      livemode,
      amountCents: input.amountCents,
      description: input.description.trim().slice(0, 200),
      reference: input.reference?.trim().slice(0, 120) || null,
      customerEmail: input.customerEmail?.trim() || null,
      successUrl: input.successUrl || merchant?.defaultSuccessUrl || null,
      metadata: input.metadata ?? {},
      settlementAssetKey: settings.assetKey,
      payoutAddress: settings.payoutAddress,
      refundAddress: settings.refundAddress,
      paymentLinkId: input.paymentLinkId ?? null,
      expiresAt: new Date(Date.now() + expiresIn * 60_000),
    })
    .returning();
  return inv;
}

// ---------- Read ----------

export async function getInvoice(d: DB, id: string): Promise<Invoice | undefined> {
  const [inv] = await d.select().from(invoices).where(eq(invoices.id, id));
  return inv;
}

export async function attemptsFor(d: DB, invoiceId: string): Promise<PaymentAttempt[]> {
  return d.select().from(paymentAttempts).where(eq(paymentAttempts.invoiceId, invoiceId)).orderBy(desc(paymentAttempts.createdAt));
}

/** The attempt that best describes the invoice: the furthest along, else the newest. */
export function primaryAttempt(attempts: PaymentAttempt[]): PaymentAttempt | undefined {
  return attempts.find((a) => a.providerStatus !== "PENDING_DEPOSIT") ?? attempts[0];
}

// ---------- Start payment (quote) ----------

export async function startPayment(d: DB, invoiceId: string, opts: { refundAddress?: string | null } = {}) {
  let inv = await getInvoice(d, invoiceId);
  if (!inv) throw new InvoiceError("Invoice not found.", 404, "not_found");
  inv = await syncInvoice(d, inv);
  if (inv.status !== "open" && inv.status !== "awaiting_payment") {
    throw new InvoiceError("This invoice is no longer accepting payment.", 409, "invoice_closed");
  }

  const attempts = await attemptsFor(d, inv.id);
  const current = attempts[0];
  const customRefund = opts.refundAddress?.trim();
  if (customRefund) {
    const err = checkZcashRefundAddress(customRefund);
    if (err) throw new InvoiceError(err, 400, "invalid_refund_address");
  }
  const refundTo = customRefund || inv.refundAddress;

  // Reuse a live quote unless the customer asked for a different refund address.
  if (
    current &&
    current.providerStatus === "PENDING_DEPOSIT" &&
    current.quoteDeadline.getTime() - Date.now() > 60_000 &&
    current.refundAddress === refundTo
  ) {
    return { invoice: inv, attempt: current };
  }

  const settlement = getSettlementAsset(inv.settlementAssetKey);
  if (!settlement) throw new InvoiceError("This invoice's payout asset is no longer supported.", 409, "asset_unsupported");

  const provider = providerFor(inv.livemode);
  const deadline = new Date(Math.min(Date.now() + QUOTE_TTL_MIN * 60_000, inv.expiresAt.getTime()));
  let quote;
  try {
    quote = await provider.quote({
      invoiceId: inv.id,
      settlement,
      amountOutBase: centsToBaseUnits(inv.amountCents, settlement.decimals),
      recipient: inv.payoutAddress,
      refundTo,
      deadline,
    });
  } catch (err) {
    if (err instanceof ProviderError) throw new InvoiceError(err.message, 502, "quote_unavailable");
    throw err;
  }

  const [attempt] = await d
    .insert(paymentAttempts)
    .values({
      id: newId("att"),
      invoiceId: inv.id,
      provider: provider.name,
      depositAddress: quote.depositAddress,
      depositMemo: quote.depositMemo,
      amountInBase: quote.amountInBase,
      amountInFormatted: quote.amountInFormatted,
      amountOutBase: quote.amountOutBase,
      refundAddress: refundTo,
      quoteDeadline: quote.deadline,
      raw: quote.raw,
    })
    .returning();

  const [updated] = await d
    .update(invoices)
    .set({ status: "awaiting_payment", updatedAt: new Date() })
    .where(and(eq(invoices.id, inv.id), inArray(invoices.status, ["open", "awaiting_payment"])))
    .returning();
  return { invoice: updated ?? inv, attempt };
}

// ---------- Sync ----------

function runAfterResponse(task: () => Promise<unknown>) {
  import("next/server")
    .then((m) => {
      try {
        m.after(task);
      } catch {
        void task(); // Outside a request (scripts, tests).
      }
    })
    .catch(() => void task());
}

function statusFromAttempt(a: PaymentAttempt | undefined, now = Date.now()): InvoiceStatus | null {
  if (!a) return null;
  switch (a.providerStatus) {
    case "PENDING_DEPOSIT":
      return a.quoteDeadline.getTime() > now ? "awaiting_payment" : "open";
    case "KNOWN_DEPOSIT_TX":
      return "payment_received";
    case "PROCESSING":
      return "converting";
    case "SUCCESS":
      return "paid_out";
    case "INCOMPLETE_DEPOSIT":
      return "underpaid";
    case "REFUNDED":
      return "refunded";
    case "FAILED":
      return "failed";
  }
}

const STAGE: Record<InvoiceStatus, number> = {
  open: 0,
  awaiting_payment: 1,
  expired: 1,
  canceled: 1,
  payment_received: 2,
  converting: 3,
  underpaid: 3,
  paid_out: 4,
  refunded: 4,
  failed: 4,
};

function eventsForTransition(from: InvoiceStatus, to: InvoiceStatus): EventType[] {
  const out: EventType[] = [];
  if (STAGE[from] < 2 && STAGE[to] >= 2 && to !== "underpaid") out.push("invoice.payment_received");
  if (to === "paid_out") out.push("invoice.paid_out");
  if (to === "underpaid") out.push("invoice.underpaid");
  if (to === "refunded") out.push("invoice.refunded");
  if (to === "failed") out.push("invoice.failed");
  if (to === "expired") out.push("invoice.expired");
  return out;
}

/**
 * Refresh an invoice from its payment attempts. Safe to call often: provider calls are
 * throttled per attempt, and status changes use a compare-and-set so each webhook event
 * is emitted once even when several requests sync at the same time.
 */
export async function syncInvoice(d: DB, inv: Invoice, opts: { force?: boolean } = {}): Promise<Invoice> {
  if (TERMINAL.includes(inv.status)) return inv;
  const now = Date.now();
  const attempts = await attemptsFor(d, inv.id);

  for (const a of attempts) {
    if (PROVIDER_TERMINAL.includes(a.providerStatus)) continue;
    if (a.quoteDeadline.getTime() + LATE_DEPOSIT_GRACE_MS < now && a.providerStatus === "PENDING_DEPOSIT") continue;
    if (!opts.force && a.lastSyncedAt && now - a.lastSyncedAt.getTime() < SYNC_THROTTLE_MS) continue;
    try {
      const res = await providerByName(a.provider).status(a);
      const [fresh] = await d
        .update(paymentAttempts)
        .set({
          providerStatus: res.status,
          originTxs: res.originTxs,
          destinationTxs: res.destinationTxs,
          raw: a.provider === "sandbox" ? a.raw : { ...a.raw, lastStatus: res.raw },
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentAttempts.id, a.id))
        .returning();
      Object.assign(a, fresh);
    } catch {
      // Provider hiccup: keep the last known state and try again on the next sync.
    }
  }

  let next = statusFromAttempt(primaryAttempt(attempts), now) ?? "open";
  if ((next === "open" || next === "awaiting_payment") && inv.expiresAt.getTime() < now) next = "expired";
  return transition(d, inv, next, attempts);
}

async function transition(d: DB, inv: Invoice, to: InvoiceStatus, attempts?: PaymentAttempt[]): Promise<Invoice> {
  if (to === inv.status) return inv;
  const [updated] = await d
    .update(invoices)
    .set({ status: to, updatedAt: new Date(), paidOutAt: to === "paid_out" ? new Date() : inv.paidOutAt })
    .where(and(eq(invoices.id, inv.id), eq(invoices.status, inv.status)))
    .returning();
  if (!updated) {
    // Another request moved it first; it emitted the events.
    return (await getInvoice(d, inv.id)) ?? inv;
  }
  const types = eventsForTransition(inv.status, to);
  if (types.length) {
    const object = serializeInvoice(updated, primaryAttempt(attempts ?? (await attemptsFor(d, inv.id))));
    const ids: string[] = [];
    for (const type of types) {
      ids.push(...(await emitEvent(d, { merchantId: inv.merchantId, livemode: inv.livemode, type, invoiceId: inv.id, object })));
    }
    // First attempt right after the response is sent; the scheduler retries failures.
    runAfterResponse(() => deliverMany(d, ids));
  }
  if (to === "paid_out" && updated.customerEmail) {
    runAfterResponse(() => import("@/lib/receipts").then((r) => r.sendReceipt(d, updated.id)));
  }
  return updated;
}

/** Sync every invoice with a payment in flight. Called by the scheduler. */
export async function syncActive(d: DB): Promise<{ synced: number; expired: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const active = await d
    .selectDistinct({ invoiceId: paymentAttempts.invoiceId })
    .from(paymentAttempts)
    .where(and(notInArray(paymentAttempts.providerStatus, PROVIDER_TERMINAL), gt(paymentAttempts.createdAt, since)));
  let synced = 0;
  for (const { invoiceId } of active) {
    const inv = await getInvoice(d, invoiceId);
    if (inv) {
      await syncInvoice(d, inv);
      synced++;
    }
  }
  const overdue = await d
    .select()
    .from(invoices)
    .where(and(inArray(invoices.status, ["open", "awaiting_payment"]), lt(invoices.expiresAt, new Date())))
    .limit(200);
  for (const inv of overdue) await syncInvoice(d, inv);
  return { synced, expired: overdue.length };
}

/**
 * Refresh one merchant's payments in flight, so their dashboard is current even between scheduled
 * runs. Bounded: at most `limit` invoices, checked in parallel, each with a time budget.
 */
export async function syncMerchantActive(d: DB, merchantId: string, livemode: boolean, limit = 10): Promise<number> {
  const rows = await d
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.merchantId, merchantId),
        eq(invoices.livemode, livemode),
        inArray(invoices.status, ["awaiting_payment", "payment_received", "converting"]),
      ),
    )
    .orderBy(desc(invoices.updatedAt))
    .limit(limit);
  const budget = (p: Promise<unknown>) => Promise.race([p, new Promise((r) => setTimeout(r, 4000))]);
  await Promise.all(rows.map((inv) => budget(syncInvoice(d, inv).catch(() => undefined))));
  return rows.length;
}

export async function cancelInvoice(d: DB, inv: Invoice): Promise<Invoice> {
  if (inv.status !== "open" && inv.status !== "awaiting_payment") {
    throw new InvoiceError("Only invoices that have not received a payment can be canceled.", 409, "invoice_not_cancelable");
  }
  const attempts = await attemptsFor(d, inv.id);
  if (attempts.some((a) => a.providerStatus !== "PENDING_DEPOSIT")) {
    throw new InvoiceError("A payment is already on its way for this invoice.", 409, "invoice_not_cancelable");
  }
  return transition(d, inv, "canceled");
}

/** Test mode only: pretend the customer paid, and choose how it ends. */
export async function simulatePayment(d: DB, inv: Invoice, outcome: SandboxOutcome): Promise<Invoice> {
  if (inv.livemode) throw new InvoiceError("Simulation is only available in test mode.", 403, "livemode");
  const [attempt] = await attemptsFor(d, inv.id);
  if (!attempt || attempt.providerStatus !== "PENDING_DEPOSIT") {
    throw new InvoiceError("Start the payment before simulating it.", 409, "no_active_quote");
  }
  await d
    .update(paymentAttempts)
    .set({ raw: { ...attempt.raw, sim: sandboxStartState(outcome) }, lastSyncedAt: null })
    .where(eq(paymentAttempts.id, attempt.id));
  return syncInvoice(d, inv, { force: true });
}

// ---------- Serialize ----------

export function serializeInvoice(inv: Invoice, attempt?: PaymentAttempt) {
  const asset = getSettlementAsset(inv.settlementAssetKey);
  return {
    id: inv.id,
    object: "invoice",
    livemode: inv.livemode,
    status: inv.status,
    amount: formatAmount(inv.amountCents),
    currency: inv.currency,
    description: inv.description,
    reference: inv.reference,
    customer_email: inv.customerEmail,
    metadata: inv.metadata,
    hosted_url: hostedUrl(inv.id),
    settlement: {
      asset: asset?.symbol ?? null,
      chain: asset?.chainName ?? null,
      label: asset ? assetLabel(asset) : null,
      address: inv.payoutAddress,
    },
    payment: attempt
      ? {
          pay_currency: ZEC.symbol,
          pay_amount: attempt.amountInFormatted,
          deposit_address: attempt.depositAddress,
          deposit_memo: attempt.depositMemo,
          quote_expires_at: attempt.quoteDeadline.toISOString(),
          network_status: attempt.providerStatus,
          deposit_txs: attempt.originTxs,
          payout_txs: attempt.destinationTxs,
        }
      : null,
    payment_link: inv.paymentLinkId,
    expires_at: inv.expiresAt.toISOString(),
    paid_out_at: inv.paidOutAt?.toISOString() ?? null,
    created_at: inv.createdAt.toISOString(),
  };
}

export type InvoiceJson = ReturnType<typeof serializeInvoice>;
