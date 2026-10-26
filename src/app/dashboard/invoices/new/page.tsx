import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settlementSettings } from "@/db/schema";
import { assetLabel, getSettlementAsset } from "@/lib/assets";
import { requireMerchant } from "@/lib/auth";
import { NewInvoiceForm } from "./form";

export const metadata = { title: "Create invoice" };

export default async function NewInvoicePage() {
  const m = await requireMerchant();
  const d = await db();
  const [settings] = await d.select().from(settlementSettings).where(eq(settlementSettings.merchantId, m.id));
  const asset = settings ? getSettlementAsset(settings.assetKey) : undefined;
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="h1">Create invoice</h1>
          <p>You get a checkout link to share. The ZEC price is set when the customer opens it.</p>
        </div>
      </div>
      <section className="panel panel-body">
        <NewInvoiceForm payoutLabel={asset ? assetLabel(asset) : null} />
      </section>
    </div>
  );
}
