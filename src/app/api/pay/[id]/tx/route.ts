import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { handleError, jsonError } from "@/lib/api";
import { attemptsFor, getInvoice } from "@/lib/invoices";
import { providerByName } from "@/lib/providers";

const schema = z.object({ tx_hash: z.string().regex(/^[0-9a-fA-F]{64}$/, "Paste the 64-character transaction ID from your wallet") });

/** Optional: the customer pastes their transaction ID so the network spots the deposit sooner. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { tx_hash } = schema.parse(await req.json().catch(() => ({})));
    const d = await db();
    const inv = await getInvoice(d, id);
    if (!inv) return jsonError(404, "not_found", "This invoice does not exist.");
    const [attempt] = await attemptsFor(d, inv.id);
    if (!attempt) return jsonError(409, "no_active_quote", "Start the payment first.");
    const provider = providerByName(attempt.provider);
    if (provider.submitDepositTx) await provider.submitDepositTx(attempt.depositAddress, tx_hash);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
