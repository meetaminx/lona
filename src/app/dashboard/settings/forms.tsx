"use client";

import { useActionState } from "react";
import { changePasswordAction, resendVerifyAction, saveProfileAction } from "@/app/actions/dashboard";

export function ProfileForm({ initial }: { initial: { businessName: string; supportEmail: string; defaultSuccessUrl: string; sendReceipts: boolean } }) {
  const [state, action, pending] = useActionState(saveProfileAction, undefined);
  const v = state?.values ?? initial;
  return (
    <form action={action} className="form-grid" noValidate>
      {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" role="status">{state.ok}</p>}
      <div className="field">
        <label className="label" htmlFor="businessName">Business name</label>
        <input className="input" id="businessName" name="businessName" defaultValue={v.businessName} maxLength={80} required />
        <span className="hint">Shown on every checkout and receipt.</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="supportEmail">Support email</label>
        <input className="input" id="supportEmail" name="supportEmail" type="email" defaultValue={v.supportEmail} placeholder="help@yourshop.com" />
        <span className="hint">Customers can reply to receipts here. Optional.</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="defaultSuccessUrl">Return page after payment</label>
        <input className="input" id="defaultSuccessUrl" name="defaultSuccessUrl" type="url" defaultValue={v.defaultSuccessUrl} placeholder="https://yourshop.com/thanks" />
        <span className="hint">Used when an invoice does not set its own. Optional.</span>
      </div>
      <label className="check">
        <input type="checkbox" name="sendReceipts" defaultChecked={initial.sendReceipts} />
        <span>
          <strong>Email receipts to customers</strong>
          <span className="hint">When an invoice has a customer email, send a receipt once it is paid out.</span>
        </span>
      </label>
      <div>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving" : "Save profile"}</button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="form-grid" noValidate>
      {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" role="status">{state.ok}</p>}
      <div className="form-row">
        <div className="field">
          <label className="label" htmlFor="current">Current password</label>
          <input className="input" id="current" name="current" type="password" autoComplete="current-password" required />
        </div>
        <div className="field">
          <label className="label" htmlFor="next">New password</label>
          <input className="input" id="next" name="next" type="password" minLength={10} autoComplete="new-password" required />
        </div>
      </div>
      <div>
        <button className="btn btn-secondary" disabled={pending}>{pending ? "Changing" : "Change password"}</button>
      </div>
    </form>
  );
}

export function ResendVerify() {
  const [state, action, pending] = useActionState(resendVerifyAction, undefined);
  return (
    <form action={action} style={{ display: "grid", gap: 8 }}>
      <button className="btn btn-secondary" style={{ height: 32 }} disabled={pending}>{pending ? "Sending" : "Send confirmation email"}</button>
      {state?.ok && <p className="small soft" role="status">{state.ok} {state.secret && <a href={state.secret}>Open confirmation link</a>}</p>}
      {state?.error && <p className="small error-text" role="alert">{state.error}</p>}
    </form>
  );
}
