"use client";

import { useActionState } from "react";
import { addEndpointAction, createKeyAction } from "@/app/actions/dashboard";
import { CopyButton } from "@/components/copy-button";

function SecretBox({ message, secret }: { message: string; secret: string }) {
  return (
    <div className="secret-box" role="status">
      <p className="small" style={{ fontWeight: 500 }}>{message}</p>
      <div className="copy-row">
        <code className="addr">{secret}</code>
        <CopyButton value={secret} />
      </div>
    </div>
  );
}

export function CreateKeyForm({ live }: { live: boolean }) {
  const [state, action, pending] = useActionState(createKeyAction, undefined);
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      {state?.secret && <SecretBox message={state.ok ?? ""} secret={state.secret} />}
      <div className="copy-row">
        <label htmlFor="key-name" className="visually-hidden">Key name</label>
        <input className="input" id="key-name" name="name" placeholder={live ? "Production server" : "Local development"} maxLength={60} />
        <button className="btn btn-primary" disabled={pending}>{pending ? "Creating" : `Create ${live ? "live" : "test"} key`}</button>
      </div>
    </form>
  );
}

export function AddEndpointForm({ live }: { live: boolean }) {
  const [state, action, pending] = useActionState(addEndpointAction, undefined);
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      {state?.secret && <SecretBox message={state.ok ?? ""} secret={state.secret} />}
      <div className="copy-row">
        <label htmlFor="hook-url" className="visually-hidden">Endpoint URL</label>
        <input className="input" id="hook-url" name="url" type="url" placeholder={live ? "https://shop.example/webhooks/lona" : "https://your-tunnel.example/webhooks/lona"} defaultValue={state?.values?.url} required />
        <button className="btn btn-primary" disabled={pending}>{pending ? "Adding" : "Add endpoint"}</button>
      </div>
    </form>
  );
}
