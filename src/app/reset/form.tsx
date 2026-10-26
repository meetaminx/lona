"use client";

import { useActionState } from "react";
import { resetAction } from "@/app/actions/auth";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetAction, undefined);
  return (
    <form action={action} noValidate>
      <h1 className="h1">Choose a new password</h1>
      {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label className="label" htmlFor="password">New password</label>
        <input className="input" id="password" name="password" type="password" minLength={10} autoComplete="new-password" required />
        <span className="hint">At least 10 characters. You will be logged out on other devices.</span>
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={pending}>{pending ? "Saving" : "Save new password"}</button>
    </form>
  );
}
