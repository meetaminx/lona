"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";

export const NETWORK_ERROR = "We could not reach Lona. Check your connection and try again.";

/**
 * useActionState with a network guard: if the request never reaches the server, the form shows a
 * clear message instead of failing silently. Passwords are never echoed back into form state.
 */
export function useAuthAction(action: (prev: FormState, form: FormData) => Promise<FormState>) {
  return useActionState(async (prev: FormState, form: FormData): Promise<FormState> => {
    try {
      return await action(prev, form);
    } catch (err) {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (err instanceof TypeError || offline) {
        const values: Record<string, string> = {};
        for (const [k, v] of form.entries()) if (typeof v === "string" && !/password|token/i.test(k)) values[k] = v;
        return { error: NETWORK_ERROR, values };
      }
      throw err;
    }
  }, undefined);
}

/** A labelled input with its own error line, wired for screen readers. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span className="error-text" id={`${id}-error`}>{error}</span>
      ) : hint ? (
        <span className="hint" id={`${id}-hint`}>{hint}</span>
      ) : null}
    </div>
  );
}

/** Password input with a show/hide toggle. Controlled, so a failed submit does not wipe it. */
export function PasswordInput({
  id,
  name = id,
  autoComplete,
  error,
  hint,
  value,
  onChange,
}: {
  id: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="pw">
      <input
        className="input pw-input"
        id={id}
        name={name}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        spellCheck={false}
        autoCapitalize="none"
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-controls={id}
        aria-label={shown ? "Hide password" : "Show password"}
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
