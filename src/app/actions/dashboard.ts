"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, invoices, merchants, paymentLinks, sessions, settlementSettings, webhookDeliveries, webhookEndpoints } from "@/db/schema";
import { cookies } from "next/headers";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { sendVerifyEmail } from "@/lib/account-mail";
import { canShowDevLinks } from "@/lib/mailer";
import { sha256 } from "@/lib/ids";
import { checkPayoutAddress, checkZcashRefundAddress, getSettlementAsset } from "@/lib/assets";
import { createApiKey, isLivemode, requireMerchant, setLivemode } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { cancelInvoice, createInvoice, getInvoice, InvoiceError } from "@/lib/invoices";
import { createPaymentLink } from "@/lib/links";
import { parseAmountToCents } from "@/lib/money";
import { newWebhookSecret, retryDelivery, sendTestEvent } from "@/lib/webhooks";
import { checkWebhookUrl } from "@/lib/net-guard";

export type ActionState = { error?: string; ok?: string; secret?: string; values?: Record<string, string> } | undefined;

const s = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function setModeAction(form: FormData) {
  const m = await requireMerchant();
  const wantLive = s(form, "mode") === "live";
  if (wantLive) {
    const ready = await liveReadiness(m.id, !!m.emailVerifiedAt);
    if (!ready.ok) redirect("/dashboard/settings?golive=1#go-live");
  }
  await setLivemode(wantLive);
  revalidatePath("/dashboard", "layout");
}

/** Live payments need a confirmed email and a payout wallet. */
export async function liveReadiness(merchantId: string, emailVerified: boolean) {
  const d = await db();
  const [settings] = await d.select().from(settlementSettings).where(eq(settlementSettings.merchantId, merchantId));
  return { ok: emailVerified && !!settings, emailVerified, settlement: !!settings };
}

export async function saveProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const m = await requireMerchant();
  const values = {
    businessName: s(form, "businessName"),
    supportEmail: s(form, "supportEmail"),
    defaultSuccessUrl: s(form, "defaultSuccessUrl"),
  };
  if (!values.businessName) return { error: "Enter your business name. Customers see it at checkout.", values };
  if (values.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.supportEmail)) {
    return { error: "That support email does not look right.", values };
  }
  if (values.defaultSuccessUrl) {
    try {
      const u = new URL(values.defaultSuccessUrl);
      if (!["https:", "http:"].includes(u.protocol)) throw new Error();
    } catch {
      return { error: "The return page must be a full URL starting with https://", values };
    }
  }
  const d = await db();
  await d
    .update(merchants)
    .set({
      businessName: values.businessName.slice(0, 80),
      supportEmail: values.supportEmail || null,
      defaultSuccessUrl: values.defaultSuccessUrl || null,
      sendReceipts: form.get("sendReceipts") === "on",
    })
    .where(eq(merchants.id, m.id));
  revalidatePath("/dashboard", "layout");
  return { ok: "Saved.", values };
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const m = await requireMerchant();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (!(await verifyPassword(current, m.passwordHash))) return { error: "Your current password is not right." };
  if (next.length < 10) return { error: "Use a new password of at least 10 characters." };
  const d = await db();
  await d.update(merchants).set({ passwordHash: await hashPassword(next) }).where(eq(merchants.id, m.id));
  // Keep this session, end every other one.
  const jar = await cookies();
  const token = jar.get("lona_session")?.value ?? "";
  await d.delete(sessions).where(and(eq(sessions.merchantId, m.id), ne(sessions.id, sha256(token))));
  return { ok: "Password changed. Other devices have been logged out." };
}

export async function resendVerifyAction(_prev: ActionState): Promise<ActionState> {
  const m = await requireMerchant();
  if (m.emailVerifiedAt) return { ok: "Your email is already confirmed." };
  const sent = await sendVerifyEmail(await db(), m);
  if (!sent.delivered && canShowDevLinks()) return { ok: "Email is not configured on this machine.", secret: sent.link };
  return sent.delivered ? { ok: `Sent to ${m.email}.` } : { error: "We could not send the email. Try again in a few minutes." };
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
  const problem = await checkWebhookUrl(url, live);
  if (problem) return { error: problem, values: { url } };
  const d = await db();
  const secret = newWebhookSecret();
  await d.insert(webhookEndpoints).values({ id: newId("whe"), merchantId: m.id, livemode: live, url, secret });
  revalidatePath("/dashboard/developers");
  return { ok: "Endpoint added. Use this signing secret to verify events.", secret };
}

async function ownEndpoint(merchantId: string, id: string) {
  const d = await db();
  const [ep] = await d.select().from(webhookEndpoints).where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.merchantId, merchantId)));
  return ep;
}

export async function testEndpointAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const m = await requireMerchant();
  const ep = await ownEndpoint(m.id, s(form, "id"));
  if (!ep) return { error: "Endpoint not found." };
  const res = await sendTestEvent(await db(), ep.id);
  revalidatePath("/dashboard/developers");
  return res.ok ? { ok: res.message } : { error: res.message };
}

export async function rollSecretAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const m = await requireMerchant();
  const ep = await ownEndpoint(m.id, s(form, "id"));
  if (!ep) return { error: "Endpoint not found." };
  const secret = newWebhookSecret();
  await (await db()).update(webhookEndpoints).set({ secret }).where(eq(webhookEndpoints.id, ep.id));
  revalidatePath("/dashboard/developers");
  return { ok: "New signing secret. The old one stopped working just now, so update your server.", secret };
}

export async function retryDeliveryAction(form: FormData) {
  const m = await requireMerchant();
  const d = await db();
  const id = s(form, "id");
  const [row] = await d
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .where(and(eq(webhookDeliveries.id, id), eq(webhookEndpoints.merchantId, m.id)));
  if (row) await retryDelivery(d, row.id);
  revalidatePath("/dashboard/developers");
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
