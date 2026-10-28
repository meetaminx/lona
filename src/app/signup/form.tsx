"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { signupAction } from "@/app/actions/auth";
import { EMAIL_RE, Field, PasswordInput, useAuthAction } from "@/components/auth-fields";

type Errors = Partial<Record<"businessName" | "email" | "password", string>>;

function check(form: FormData, password: string): Errors {
  const e: Errors = {};
  const name = String(form.get("businessName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  if (!name) e.businessName = "Enter your business name. Customers see it at checkout.";
  if (!email) e.email = "Enter your email address.";
  else if (!EMAIL_RE.test(email)) e.email = "Enter a valid email address, like you@business.com.";
  if (password.length < 10) e.password = "Use a password of at least 10 characters.";
  return e;
}

export function SignupForm() {
  const [state, action, pending] = useAuthAction(signupAction);
  const [password, setPassword] = useState("");
  const [local, setLocal] = useState<Errors | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Errors from this browser's own check win until the next submit; otherwise show the server's.
  const errors: Errors = local ?? (state?.fields as Errors) ?? {};
  const summary = local && Object.keys(local).length ? "Check the highlighted fields." : state?.error;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const found = check(new FormData(e.currentTarget), password);
    if (Object.keys(found).length) {
      e.preventDefault();
      setLocal(found);
      const first = (["businessName", "email", "password"] as const).find((k) => found[k]);
      if (first) formRef.current?.querySelector<HTMLInputElement>(`#${first}`)?.focus();
      return;
    }
    setLocal(null);
  }

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} noValidate>
      <div>
        <h1 className="h1">Create your account</h1>
        <p className="soft" style={{ marginTop: 8 }}>You start in test mode. No funds move until you switch to live.</p>
      </div>
      {summary && <p className="notice notice-error" role="alert">{summary}</p>}
      <Field id="businessName" label="Business name" error={errors.businessName} hint="Shown to customers on every checkout.">
        <input
          className="input"
          id="businessName"
          name="businessName"
          defaultValue={state?.values?.businessName}
          autoComplete="organization"
          aria-invalid={errors.businessName ? true : undefined}
          aria-describedby={errors.businessName ? "businessName-error" : "businessName-hint"}
          onChange={() => local?.businessName && setLocal({ ...local, businessName: undefined })}
        />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          inputMode="email"
          defaultValue={state?.values?.email}
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          onChange={() => local?.email && setLocal({ ...local, email: undefined })}
        />
      </Field>
      <Field id="password" label="Password" error={errors.password} hint="At least 10 characters.">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            if (local?.password && v.length >= 10) setLocal({ ...local, password: undefined });
          }}
          error={errors.password}
          hint="At least 10 characters."
        />
      </Field>
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
