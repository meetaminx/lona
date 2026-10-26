"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy", className = "btn btn-secondary" }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      style={className.includes("btn-quiet") ? undefined : { height: 32, padding: "0 12px", fontSize: "0.85rem" }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* Clipboard blocked: the value is visible to select by hand. */
        }
      }}
      aria-live="polite"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
