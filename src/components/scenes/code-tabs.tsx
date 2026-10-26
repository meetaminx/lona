"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";

const SAMPLES: Record<string, string> = {
  cURL: `curl https://your-lona-domain/api/v1/invoices \\
  -H "Authorization: Bearer $LONA_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "128.00",
    "description": "Order 1042",
    "reference": "order_1042"
  }'`,
  Node: `const res = await fetch(\`\${LONA_URL}/api/v1/invoices\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.LONA_SECRET_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: "128.00",
    description: "Order 1042",
    reference: "order_1042",
  }),
});
const invoice = await res.json();
redirect(invoice.hosted_url);`,
  Python: `import os, requests

invoice = requests.post(
    f"{LONA_URL}/api/v1/invoices",
    headers={"Authorization": f"Bearer {os.environ['LONA_SECRET_KEY']}"},
    json={
        "amount": "128.00",
        "description": "Order 1042",
        "reference": "order_1042",
    },
).json()

return redirect(invoice["hosted_url"])`,
  Webhook: `app.post("/webhooks/lona", express.raw({ type: "*/*" }), (req, res) => {
  const ok = verifySignature(
    process.env.LONA_WEBHOOK_SECRET,
    req.get("Lona-Signature"),
    req.body.toString(),
  );
  if (!ok) return res.sendStatus(400);

  const event = JSON.parse(req.body);
  if (event.type === "invoice.paid_out") {
    fulfil(event.data.object.reference);
  }
  res.sendStatus(200);
});`,
};

export function CodeTabs() {
  const tabs = Object.keys(SAMPLES);
  const [tab, setTab] = useState(tabs[1]);
  return (
    <div className="code-panel">
      <div className="code-tabs" role="tablist" aria-label="Code samples">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? "is-on" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        <span className="code-copy">
          <CopyButton value={SAMPLES[tab]} className="btn btn-quiet" />
        </span>
      </div>
      <pre role="tabpanel" aria-label={`${tab} sample`}>
        <code>{SAMPLES[tab]}</code>
      </pre>
    </div>
  );
}
