import { CopyButton } from "./copy-button";

/** Code block for the docs: dark panel, optional label, copy button. */
export function DocCode({ children, label }: { children: string; label?: string }) {
  return (
    <div className="doc-code">
      <div className="doc-code-bar">
        <span>{label ?? ""}</span>
        <CopyButton value={children} className="btn btn-quiet" />
      </div>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function Endpoint({ method, path }: { method: "GET" | "POST"; path: string }) {
  return (
    <p className="endpoint">
      <span className={`method method-${method.toLowerCase()}`}>{method}</span>
      <code>{path}</code>
    </p>
  );
}
