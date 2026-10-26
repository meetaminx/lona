"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} noValidate>
      <h1 className="h1">Log in</h1>
      {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      <div className="field">
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" defaultValue={state?.values?.email} autoComplete="email" required />
      </div>
      <div className="field">
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={pending}>
        {pending ? "Logging in" : "Log in"}
      </button>
      <p className="small soft">
        New to Lona? <Link href="/signup">Create an account</Link>. <Link href="/forgot">Forgot your password?</Link>
      </p>
    </form>
  );
}
