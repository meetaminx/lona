import { NextResponse } from "next/server";
import { db } from "@/db";
import { jsonError } from "@/lib/api";
import { syncActive } from "@/lib/invoices";
import { deliverDue } from "@/lib/webhooks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Scheduler: sync payments in flight, expire old invoices, retry webhooks. Run every minute. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError(401, "unauthorized", "Missing or wrong CRON_SECRET.");
  }
  const d = await db();
  const sync = await syncActive(d);
  const delivered = await deliverDue(d);
  return NextResponse.json({ ...sync, webhooksAttempted: delivered });
}
