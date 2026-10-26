"use client";

import { useActionState, useEffect, useRef } from "react";
import { createLinkAction } from "@/app/actions/dashboard";

export function NewLinkForm() {
  const [state, action, pending] = useActionState(createLinkAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="form-grid" style={{ maxWidth: "none" }} noValidate>
      {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" role="status">{state.ok}</p>}
      <div className="form-row" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="field">
          <label className="label" htmlFor="title">What the customer pays for</label>
          <input className="input" id="title" name="title" placeholder="Workshop ticket" defaultValue={state?.values?.title} maxLength={120} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="link-amount">Amount in US dollars</label>
          <input className="input num" id="link-amount" name="amount" inputMode="decimal" placeholder="25.00" defaultValue={state?.values?.amount} required />
        </div>
      </div>
      <div>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Creating link" : "Create payment link"}</button>
      </div>
    </form>
  );
}
