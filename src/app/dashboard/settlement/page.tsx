import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settlementSettings } from "@/db/schema";
import { SETTLEMENT_ASSETS } from "@/lib/assets";
import { requireMerchant } from "@/lib/auth";
import { SettlementForm } from "./form";

export const metadata = { title: "Settlement" };

export default async function SettlementPage() {
  const m = await requireMerchant();
  const d = await db();
  const [s] = await d.select().from(settlementSettings).where(eq(settlementSettings.merchantId, m.id));
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="h1">Settlement</h1>
          <p className="measure">Where your money goes. Changes apply to new invoices; invoices already created keep the wallet they were made with.</p>
        </div>
      </div>
      <section className="panel panel-body">
        <SettlementForm
          assets={SETTLEMENT_ASSETS}
          initial={s ? { assetKey: s.assetKey, payoutAddress: s.payoutAddress, refundAddress: s.refundAddress } : null}
        />
      </section>
      <p className="small soft measure">
        Lona never holds your funds. Each payment is converted by the swap network and sent straight from it to this
        wallet. Double check the address: payouts to a wrong address cannot be reversed.
      </p>
    </div>
  );
}
