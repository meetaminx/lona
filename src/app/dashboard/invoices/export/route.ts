import { db } from "@/db";
import { attemptsFor, primaryAttempt } from "@/lib/invoices";
import { currentMerchant, isLivemode } from "@/lib/auth";
import { queryInvoices } from "@/lib/invoice-query";
import { assetLabel, getSettlementAsset } from "@/lib/assets";
import { formatAmount } from "@/lib/money";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything and neutralise spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV of invoices for accounting, honouring the dashboard's current filter and search. */
export async function GET(req: Request) {
  const m = await currentMerchant();
  if (!m) return new Response("Log in to export invoices.", { status: 401 });
  const live = await isLivemode();
  const q = new URL(req.url).searchParams;
  const d = await db();
  const rows = await queryInvoices(d, m.id, live, { filter: q.get("filter") ?? "all", q: q.get("q") ?? "", limit: 5000 });
  const header = ["invoice_id", "created_at", "status", "amount_usd", "description", "reference", "customer_email", "payout_asset", "payout_address", "zec_paid", "deposit_tx", "payout_tx", "paid_out_at", "livemode"];
  const lines = [header.map(cell).join(",")];
  for (const inv of rows) {
    const a = primaryAttempt(await attemptsFor(d, inv.id));
    const asset = getSettlementAsset(inv.settlementAssetKey);
    lines.push(
      [
        inv.id,
        inv.createdAt.toISOString(),
        inv.status,
        formatAmount(inv.amountCents).replace(/,/g, ""),
        inv.description,
        inv.reference,
        inv.customerEmail,
        asset ? assetLabel(asset) : inv.settlementAssetKey,
        inv.payoutAddress,
        a && a.providerStatus !== "PENDING_DEPOSIT" ? a.amountInFormatted : "",
        a?.originTxs[0]?.hash,
        a?.destinationTxs[0]?.hash,
        inv.paidOutAt?.toISOString(),
        inv.livemode,
      ]
        .map(cell)
        .join(","),
    );
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lona-invoices-${live ? "live" : "test"}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
