import { CopyButton } from "@/components/copy-button";

/** The merchant creating an invoice, drawn as the real dashboard form. */
export function InvoiceComposer({ created, usd }: { created: boolean; usd: string }) {
  return (
    <div className="mini-app" aria-hidden="true">
      <div className="mini-bar">
        <span />
        <span />
        <span />
        <p>Create invoice</p>
      </div>
      <div className="mini-body">
        <div className="mini-field">
          <label>Amount in US dollars</label>
          <div className="mini-input num">{usd}</div>
        </div>
        <div className="mini-field">
          <label>Description</label>
          <div className="mini-input">Ethiopia Guji, 1kg x 4</div>
        </div>
        <div className="mini-field">
          <label>Your reference</label>
          <div className="mini-input">Order 1042</div>
        </div>
        <p className="micro soft">Pays out as USDC on Base. The customer pays the equivalent in ZEC.</p>
        {created ? (
          <div className="mini-created">
            <p className="micro" style={{ fontWeight: 600 }}>Checkout link ready</p>
            <div className="copy-row">
              <code className="addr small">/pay/inv_7kq2m9</code>
              <CopyButton value="https:///pay/inv_7kq2m9" className="btn btn-quiet" />
            </div>
          </div>
        ) : (
          <div className="btn btn-primary" style={{ width: "fit-content" }}>Create invoice</div>
        )}
      </div>
    </div>
  );
}
