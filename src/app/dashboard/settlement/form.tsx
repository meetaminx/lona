"use client";

import { useActionState, useState } from "react";
import { saveSettlementAction } from "@/app/actions/dashboard";
import type { SettlementAsset } from "@/lib/assets";

export function SettlementForm({
  assets,
  initial,
}: {
  assets: SettlementAsset[];
  initial: { assetKey: string; payoutAddress: string; refundAddress: string } | null;
}) {
  const [state, action, pending] = useActionState(saveSettlementAction, undefined);
  const v = state?.values ?? initial ?? { assetKey: "usdc-base", payoutAddress: "", refundAddress: "" };
  const [assetKey, setAssetKey] = useState(v.assetKey);
  const asset = assets.find((a) => a.key === assetKey);
  return (
    <form action={action} className="form-grid" noValidate>
      {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" role="status">{state.ok}</p>}
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 6 }}>Get paid in</legend>
        <select className="select" name="assetKey" value={assetKey} onChange={(e) => setAssetKey(e.target.value)}>
          {assets.map((a) => (
            <option key={a.key} value={a.key}>
              {a.symbol} on {a.chainName}
            </option>
          ))}
        </select>
      </fieldset>
      <div className="field">
        <label className="label" htmlFor="payoutAddress">Your {asset?.chainName ?? ""} wallet address</label>
        <input className="input addr" id="payoutAddress" name="payoutAddress" defaultValue={v.payoutAddress} placeholder={asset?.family === "solana" ? "7EcDhSYGx..." : "0x..."} autoComplete="off" spellCheck={false} required />
        <span className="hint">
          Payouts are sent here directly. Use a wallet you control on {asset?.chainName}, not an exchange deposit address.
        </span>
      </div>
      <div className="field">
        <label className="label" htmlFor="refundAddress">Zcash refund address</label>
        <input className="input addr" id="refundAddress" name="refundAddress" defaultValue={v.refundAddress} placeholder="t1..." autoComplete="off" spellCheck={false} required />
        <span className="hint">
          If a conversion cannot complete, the ZEC goes back here unless the customer gave their own refund address at
          checkout. It must be a transparent address starting with t1 or t3.
        </span>
      </div>
      <div>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving" : "Save payout settings"}</button>
      </div>
    </form>
  );
}
