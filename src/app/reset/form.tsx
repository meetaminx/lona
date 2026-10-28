"use client";

import { useState } from "react";
import { resetAction } from "@/app/actions/auth";
import { Field, PasswordInput, useAuthAction } from "@/components/auth-fields";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useAuthAction(resetAction);
  const [password, setPassword] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (password.length < 10) {
          e.preventDefault();
          setLocal("Use a password of at least 10 characters.");
        } else setLocal(null);
      }}
      noValidate
    >
      <h1 className="h1">Choose a new password</h1>
      {(local || state?.error) && <p className="notice notice-error" role="alert">{local ?? state?.error}</p>}
      <input type="hidden" name="token" value={token} />
      <Field id="password" label="New password" error={local ?? undefined} hint="At least 10 characters. You will be logged out on other devices.">
        <PasswordInput id="password" autoComplete="new-password" value={password} onChange={setPassword} error={local ?? undefined} hint="At least 10 characters. You will be logged out on other devices." />
      </Field>
      <button className="btn btn-primary btn-lg btn-block" disabled={pending}>{pending ? "Saving" : "Save new password"}</button>
    </form>
  );
}
