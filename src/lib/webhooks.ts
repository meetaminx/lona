import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, lte, inArray, desc } from "drizzle-orm";
import type { DB } from "@/db";
import { webhookDeliveries, webhookEndpoints, webhookEvents } from "@/db/schema";
import { newId, randomToken } from "@/lib/ids";
import { checkWebhookUrl } from "@/lib/net-guard";

export const EVENT_TYPES = [
  "invoice.payment_received",
  "invoice.paid_out",
  "invoice.underpaid",
  "invoice.refunded",
  "invoice.failed",
  "invoice.expired",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Minutes to wait after each failed attempt. After the last one the delivery is marked failed. */
const RETRY_SCHEDULE_MIN = [1, 5, 30, 120, 360, 720];

export function newWebhookSecret(): string {
  return `whsec_${randomToken(32)}`;
}

export function signPayload(secret: string, timestamp: number, body: string): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

/** Verify a Lona-Signature header. Merchants can copy this function into their server. */
export function verifySignature(secret: string, header: string, body: string, toleranceSec = 300): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = signPayload(secret, t, body).split("v1=")[1];
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parts.v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function emitEvent(
  d: DB,
  args: { merchantId: string; livemode: boolean; type: EventType; invoiceId: string; object: Record<string, unknown> },
): Promise<string[]> {
  const eventId = newId("evt");
  const payload = {
    id: eventId,
    type: args.type,
    created: Math.floor(Date.now() / 1000),
    livemode: args.livemode,
    data: { object: args.object },
  };
  await d.insert(webhookEvents).values({
    id: eventId,
    merchantId: args.merchantId,
    livemode: args.livemode,
    type: args.type,
    invoiceId: args.invoiceId,
    payload,
  });
  const endpoints = await d
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.merchantId, args.merchantId),
        eq(webhookEndpoints.livemode, args.livemode),
        eq(webhookEndpoints.enabled, true),
      ),
    );
  if (!endpoints.length) return [];
  const rows = endpoints.map((ep) => ({
    id: newId("dlv"),
    eventId,
    endpointId: ep.id,
    status: "pending" as const,
    nextAttemptAt: new Date(),
  }));
  await d.insert(webhookDeliveries).values(rows);
  return rows.map((r) => r.id);
}

export async function deliver(d: DB, deliveryId: string): Promise<void> {
  const [row] = await d
    .select({ delivery: webhookDeliveries, endpoint: webhookEndpoints, event: webhookEvents })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .innerJoin(webhookEvents, eq(webhookEvents.id, webhookDeliveries.eventId))
    .where(eq(webhookDeliveries.id, deliveryId));
  if (!row || row.delivery.status !== "pending") return;

  const blocked = await checkWebhookUrl(row.endpoint.url, row.endpoint.livemode);
  if (blocked) {
    await d
      .update(webhookDeliveries)
      .set({ status: "failed", attempts: row.delivery.attempts + 1, lastError: blocked, nextAttemptAt: null })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }
  const body = JSON.stringify(row.event.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  let code: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(row.endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Lona-Webhooks/1.0",
        "Lona-Signature": signPayload(row.endpoint.secret, timestamp, body),
        "Lona-Event-Id": row.event.id,
      },
      body,
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    code = res.status;
    if (res.status < 200 || res.status >= 300) error = `Your server responded with ${res.status}`;
  } catch (err) {
    error = err instanceof Error && err.name === "TimeoutError" ? "Your server took longer than 10 seconds" : "Could not reach your server";
  }

  const attempts = row.delivery.attempts + 1;
  if (!error) {
    await d
      .update(webhookDeliveries)
      .set({ status: "succeeded", attempts, lastResponseCode: code, lastError: null, deliveredAt: new Date(), nextAttemptAt: null })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }
  const waitMin = RETRY_SCHEDULE_MIN[attempts - 1];
  await d
    .update(webhookDeliveries)
    .set({
      status: waitMin === undefined ? "failed" : "pending",
      attempts,
      lastResponseCode: code,
      lastError: error,
      nextAttemptAt: waitMin === undefined ? null : new Date(Date.now() + waitMin * 60_000),
    })
    .where(eq(webhookDeliveries.id, deliveryId));
}

export async function deliverMany(d: DB, ids: string[]): Promise<void> {
  await Promise.allSettled(ids.map((id) => deliver(d, id)));
}

export async function deliverDue(d: DB, limit = 50): Promise<number> {
  const due = await d
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.status, "pending"), lte(webhookDeliveries.nextAttemptAt, new Date())))
    .limit(limit);
  await deliverMany(d, due.map((r) => r.id));
  return due.length;
}

export async function recentDeliveries(d: DB, merchantId: string, livemode: boolean, limit = 25) {
  const events = await d
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(and(eq(webhookEvents.merchantId, merchantId), eq(webhookEvents.livemode, livemode)))
    .orderBy(desc(webhookEvents.createdAt))
    .limit(limit);
  if (!events.length) return [];
  return d
    .select({
      id: webhookDeliveries.id,
      status: webhookDeliveries.status,
      attempts: webhookDeliveries.attempts,
      lastResponseCode: webhookDeliveries.lastResponseCode,
      lastError: webhookDeliveries.lastError,
      createdAt: webhookDeliveries.createdAt,
      eventType: webhookEvents.type,
      invoiceId: webhookEvents.invoiceId,
      url: webhookEndpoints.url,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEvents, eq(webhookEvents.id, webhookDeliveries.eventId))
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .where(inArray(webhookDeliveries.eventId, events.map((e) => e.id)))
    .orderBy(desc(webhookDeliveries.createdAt));
}

/** Send a signed test event to one endpoint right now and report what happened. */
export async function sendTestEvent(d: DB, endpointId: string): Promise<{ ok: boolean; message: string }> {
  const [ep] = await d.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, endpointId));
  if (!ep) return { ok: false, message: "Endpoint not found." };
  const eventId = newId("evt");
  const payload = {
    id: eventId,
    type: "test.ping",
    created: Math.floor(Date.now() / 1000),
    livemode: ep.livemode,
    data: { object: { message: "This is a test event from Lona. Respond with any 2xx status." } },
  };
  await d.insert(webhookEvents).values({ id: eventId, merchantId: ep.merchantId, livemode: ep.livemode, type: "test.ping", invoiceId: null, payload });
  const [row] = await d
    .insert(webhookDeliveries)
    .values({ id: newId("dlv"), eventId, endpointId: ep.id, status: "pending", nextAttemptAt: new Date() })
    .returning();
  await deliver(d, row.id);
  const [after] = await d.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, row.id));
  if (after.status === "succeeded") return { ok: true, message: `Delivered. Your server responded ${after.lastResponseCode}.` };
  // A test should not be retried for a day.
  await d.update(webhookDeliveries).set({ status: "failed", nextAttemptAt: null }).where(eq(webhookDeliveries.id, row.id));
  return { ok: false, message: after.lastError ?? "Delivery failed." };
}

/** Put a delivery back in the queue and try it immediately. */
export async function retryDelivery(d: DB, deliveryId: string): Promise<void> {
  await d
    .update(webhookDeliveries)
    .set({ status: "pending", nextAttemptAt: new Date() })
    .where(eq(webhookDeliveries.id, deliveryId));
  await deliver(d, deliveryId);
}
