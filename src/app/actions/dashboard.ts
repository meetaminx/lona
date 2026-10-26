"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, invoices, paymentLinks, settlementSettings, webhookEndpoints } from "@/db/schema";
import { checkPayoutAddress, checkZcashRefundAddress, getSettlementAsset } from "@/lib/assets";
import { createApiKey, isLivemode, requireMerchant, setLivemode } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { cancelInvoice, createInvoice, getInvoice, InvoiceError } from "@/lib/invoices";
import { createPaymentLink } from "@/lib/links";
import { parseAmountToCents } from "@/lib/money";
import { newWebhookSecret } from "@/lib/webhooks";

export type ActionState = { error?: string; ok?: string; secret?: string; values?: Record<string, string> } | undefined;

const s = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function setModeAction(form: FormData) {
  await requireMerchant();
  await setLivemode(s(form, "mode") === "live");
  revalidatePath("/dashboard", "layout");
}

export async function saveSettlementAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const m = await requireMerchant();
  const assetKey = s(form, "assetKey");
  const payoutAddress = s(form, "payoutAddress");
  const refundAddress = s(form, "refundAddress");
  const values = { assetKey, payoutAddress, refundAddress };
  const asset = getSettlementAsset(assetKey);
  if (!asset) return { error: "Choose where you want to be paid.", values };
  const payoutErr = checkPayoutAddress(asset, payoutAddress);
  if (payoutErr) return { error: payoutErr, values };
  const refundErr = checkZcashRefundAddress(refundAddress);
  if (refundErr) return { error: refundErr, values };

  const d = await db();
  await d
    .insert(settlementSettings)
    .values({ merchantId: m.id, assetKey, payoutAddress, refundAddress })
    .onConflictDoUpdate({
      target: settlementSettings.merchantId,
      set: { assetKey, payoutAddress, refundAddress, updatedAt: new Date() },
    });
  revalidatePath("/dashboard", "layout");
  return { ok: "Saved. New invoices pay out to this wallet.", values };
}

export async function createInvoiceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const m = await requireMerchant();
  const live = await isLivemode();
  const values = {
    amount: s(form, "amount"),
    description: s(form, "description"),
    reference: s(form, "reference"),
    customerEmail: s(form, "customerEmail"),
    expires: s(form, "expires"),
  };
  const cents = parseAmountToCents(values.amount);
  if (cents === null) return { error: "Enter an amount between 1.00 and 100,000.00 dollars.", values };
  if (!values.description) return { error: "Add a description. Your customer sees it at checkout.", values };
  if (values.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.customerEmail)) {
    return { error: "That customer email does not look right.", values };
  }
  const d = await db();
  let id: string;
  try {
    const inv = await createInvoice(d, m.id, live, {
      amountCents: cents,
      description: values.description,
      reference: values.reference || null,
      customerEmail: values.customerEmail || null,
      expiresInMinutes: Number(values.expires) || 60 * 24,
    });
    id = inv.id;
  } catch (err) {
    if (err instanceof InvoiceError) return { error: err.message, values };
    throw err;
  }
  redirect(`/dashboard/invoices/${id}`);
}

export async function cancelInvoiceAction(form: FormData) {
  const m = await requireMerchant();
  const d = await db();
  const inv = await getInvoice(d, s(form, "id"));
  if (!inv || inv.merchantId !== m.id) return;
  try {
    await cancelInvoice(d, inv);
  } catch {
    /* Already paid or moving: the page shows the current status. */
  }
  revalidatePath(`/dashboard/invoices/${inv.id}`);
}

export async function createLinkAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const m = await requireMerchant();
  const live = await isLivemode();
  const values = { title: s(form, "title"), amount: s(form, "amount"), description: s(form, "description") };
  const cents = parseAmountToCents(values.amount);
  if (!values.title) return { error: "Name what the customer is paying for.", values };
  if (cents === null) return { error: "Enter an amount between 1.00 and 100,000.00 dollars.", values };
  const d = await db();
  const [settings] = await d.select().from(settlementSettings).where(eq(settlementSettings.merchantId, m.id));
  if (!settings) return { error: "Set a payout wallet in Settlement before creating payment links.", values };
  await createPaymentLink(d, m.id, live, { title: values.title, description: values.description, amountCents: cents });
  revalidatePath("/dashboard/links");
  return { ok: "Payment link created." };
}

export async function toggleLinkAction(form: FormData) {
  const m = await requireMerchant();
  const d = await db();
  await d
    .update(paymentLinks)
    .set({ active: s(form, "active") === "true" })
    .where(and(eq(paymentLinks.id, s(form, "id")), eq(paymentLinks.merchantId, m.id)));
  revalidatePath("/dashboard/links");
}

export async function createKeyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const m = await requireMerchant();
  const live = await isLivemode();
  const name = s(form, "name") || (live ? "Live key" : "Test key");
  const { secret } = await createApiKey(m.id, live, name.slice(0, 60));
  revalidatePath("/dashboard/developers");
  return { ok: "Key created. Copy it now: it will not be shown again.", secret };
}

export async function revokeKeyAction(form: FormData) {
  const m = await requireMerchant();
  const d = await db();
  await d
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, s(form, "id")), eq(apiKeys.merchantId, m.id)));
  revalidatePath("/dashboard/developers");
}

export async function addEndpointAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const m = await requireMerchant();
  const live = await isLivemode();
  const url = s(form, "url");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "Enter the full URL, starting with https://", values: { url } };
  }
  if (live && parsed.protocol !== "https:") return { error: "Live webhooks must use https.", values: { url } };
  if (!["https:", "http:"].includes(parsed.protocol)) return { error: "Use an http or https URL.", values: { url } };
  const d = await db();
  const secret = newWebhookSecret();
  await d.insert(webhookEndpoints).values({ id: newId("whe"), merchantId: m.id, livemode: live, url, secret });
  revalidatePath("/dashboard/developers");
  return { ok: "Endpoint added. Use this signing secret to verify events.", secret };
}

export async function removeEndpointAction(form: FormData) {
  const m = await requireMerchant();
  const d = await db();
  await d.delete(webhookEndpoints).where(and(eq(webhookEndpoints.id, s(form, "id")), eq(webhookEndpoints.merchantId, m.id)));
  revalidatePath("/dashboard/developers");
}

/** Used by the overview to know which setup steps are done. */
export async function setupState(merchantId: string, live: boolean) {
  const d = await db();
  const [settings] = await d.select().from(settlementSettings).where(eq(settlementSettings.merchantId, merchantId));
  const [inv] = await d.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.merchantId, merchantId), eq(invoices.livemode, live))).limit(1);
  const [key] = await d.select({ id: apiKeys.id }).from(apiKeys).where(and(eq(apiKeys.merchantId, merchantId), eq(apiKeys.livemode, live))).limit(1);
  const [hook] = await d.select({ id: webhookEndpoints.id }).from(webhookEndpoints).where(and(eq(webhookEndpoints.merchantId, merchantId), eq(webhookEndpoints.livemode, live))).limit(1);
  return { settlement: !!settings, invoice: !!inv, key: !!key, webhook: !!hook };
}
