"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createInvoiceAction } from "@/app/actions/dashboard";

export function NewInvoiceForm({ payoutLabel }: { payoutLabel: string | null }) {
  const [state, action, pending] = useActionState(createInvoiceAction, undefined);
  const v = state?.values ?? {};
  return (
    <form action={action} className="form-grid" noValidate>
      {state?.error && (
        <p className="notice notice-error" role="alert">
          {state.error}{" "}
          {state.error.includes("payout wallet") && <Link href="/dashboard/settlement">Set payout wallet</Link>}
        </p>
      )}
      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="amount">Amount in US dollars</label>
          <input className="input num" id="amount" name="amount" inputMode="decimal" placeholder="49.00" defaultValue={v.amount} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="expires">Customer can pay for</label>
          <select className="select" id="expires" name="expires" defaultValue={v.expires || "1440"}>
            <option value="60">1 hour</option>
            <option value="1440">1 day</option>
            <option value="10080">7 days</option>
            <option value="43200">30 days</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="description">Description</label>
        <input className="input" id="description" name="description" placeholder="Annual membership" defaultValue={v.description} maxLength={200} required />
        <span className="hint">Shown to your customer at checkout.</span>
      </div>
      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="reference">Your reference</label>
          <input className="input" id="reference" name="reference" placeholder="Order 1042" defaultValue={v.reference} maxLength={120} />
          <span className="hint">Optional. Sent back in webhooks.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="customerEmail">Customer email</label>
          <input className="input" id="customerEmail" name="customerEmail" type="email" defaultValue={v.customerEmail} />
          <span className="hint">Optional. For your records.</span>
        </div>
      </div>
      <p className="small soft">
        {payoutLabel ? `Pays out as ${payoutLabel}.` : "No payout wallet set yet."} The customer pays the equivalent in ZEC.
      </p>
      <div>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Creating invoice" : "Create invoice"}</button>
      </div>
    </form>
  );
}
