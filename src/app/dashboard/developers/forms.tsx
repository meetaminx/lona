"use client";

import { useActionState } from "react";
import { addEndpointAction, createKeyAction, rollSecretAction, testEndpointAction } from "@/app/actions/dashboard";
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

export function EndpointActions({ id }: { id: string }) {
  const [test, testAction, testing] = useActionState(testEndpointAction, undefined);
  const [roll, rollAction, rolling] = useActionState(rollSecretAction, undefined);
  return (
    <div className="ep-actions">
      <div className="ep-buttons">
        <form action={testAction}>
          <input type="hidden" name="id" value={id} />
          <button className="btn btn-secondary" style={{ height: 32 }} disabled={testing}>{testing ? "Sending" : "Send test event"}</button>
        </form>
        <form action={rollAction}>
          <input type="hidden" name="id" value={id} />
          <button className="btn btn-quiet" disabled={rolling}>{rolling ? "Rolling" : "Roll secret"}</button>
        </form>
      </div>
      {test?.ok && <p className="small ok-text" role="status">{test.ok}</p>}
      {test?.error && <p className="small error-text" role="alert">{test.error}</p>}
      {roll?.secret && <SecretBox message={roll.ok ?? ""} secret={roll.secret} />}
    </div>
  );
}
