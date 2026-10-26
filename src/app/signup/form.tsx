"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, undefined);
  return (
    <form action={action} noValidate>
      <div>
        <h1 className="h1">Create your account</h1>
        <p className="soft" style={{ marginTop: 8 }}>You start in test mode. No funds move until you switch to live.</p>
      </div>
      {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      <div className="field">
        <label className="label" htmlFor="businessName">Business name</label>
        <input className="input" id="businessName" name="businessName" defaultValue={state?.values?.businessName} autoComplete="organization" required />
        <span className="hint">Shown to customers on every checkout.</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" defaultValue={state?.values?.email} autoComplete="email" required />
      </div>
      <div className="field">
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" minLength={10} autoComplete="new-password" required />
        <span className="hint">At least 10 characters.</span>
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={pending}>
        {pending ? "Creating account" : "Create account"}
      </button>
      <p className="small soft">
        Already have an account? <Link href="/login">Log in</Link>. By creating an account you agree to the{" "}
        <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.
      </p>
    </form>
  );
}
