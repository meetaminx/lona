"use client";

import Link from "next/link";
import { useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { EMAIL_RE, Field, PasswordInput, useAuthAction } from "@/components/auth-fields";

export function LoginForm() {
  const [state, action, pending] = useAuthAction(loginAction);
  const [password, setPassword] = useState("");
  const [local, setLocal] = useState<{ email?: string; password?: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    const found: { email?: string; password?: string } = {};
    if (!EMAIL_RE.test(email)) found.email = "Enter the email you signed up with.";
    if (!password) found.password = "Enter your password.";
    if (found.email || found.password) {
      e.preventDefault();
      setLocal(found);
      return;
    }
    setLocal(null);
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      <h1 className="h1">Log in</h1>
      {(local ? "Check the highlighted fields." : state?.error) && (
        <p className="notice notice-error" role="alert">{local ? "Check the highlighted fields." : state?.error}</p>
      )}
      <Field id="email" label="Email" error={local?.email}>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          inputMode="email"
          defaultValue={state?.values?.email}
          autoComplete="email"
          aria-invalid={local?.email ? true : undefined}
          aria-describedby={local?.email ? "email-error" : undefined}
        />
      </Field>
      <Field id="password" label="Password" error={local?.password}>
        <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword} error={local?.password} />
      </Field>
      <button className="btn btn-primary btn-lg btn-block" disabled={pending}>
        {pending ? "Logging in" : "Log in"}
      </button>
      <p className="small soft">
        New to Lona? <Link href="/signup">Create an account</Link>. <Link href="/forgot">Forgot your password?</Link>
      </p>
    </form>
  );
}
