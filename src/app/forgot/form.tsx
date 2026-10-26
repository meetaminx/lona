"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotAction } from "@/app/actions/auth";

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotAction, undefined);
  return (
    <form action={action} noValidate>
      <div>
        <h1 className="h1">Reset your password</h1>
        <p className="soft" style={{ marginTop: 8 }}>We will email you a link to choose a new one.</p>
      </div>
      {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" role="status">{state.ok}</p>}
      {state?.devLink && (
        <p className="notice small" role="status">
          Email is not configured on this machine, so here is the link: <a href={state.devLink}>Open reset link</a>
        </p>
      )}
      <div className="field">
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} required />
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={pending}>{pending ? "Sending link" : "Send reset link"}</button>
      <p className="small soft">
        Remembered it? <Link href="/login">Log in</Link>.
      </p>
    </form>
  );
}
