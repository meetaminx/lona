"use client";

import type { InvoiceStatus } from "@/db/schema";
import { sealStage } from "@/lib/stage";
import { CopyButton } from "./copy-button";
import { Qr } from "./qr";
import { SealFrame } from "./seal-frame";

export type PayPanelPayment = {
  zecAmount: string;
  zecUsd?: string | null;
  depositAddress: string;
  depositTxs?: { hash: string; explorerUrl?: string }[];
  payoutTxs?: { hash: string; explorerUrl?: string }[];
};

const FLOW: InvoiceStatus[] = ["awaiting_payment", "payment_received", "converting", "paid_out"];

const TITLES: Record<InvoiceStatus, string> = {
  open: "Pay with Zcash",
  awaiting_payment: "Send your payment",
  payment_received: "Payment received",
  converting: "Converting",
  paid_out: "Paid",
  underpaid: "Less than the full amount arrived",
  refunded: "Refunded",
  failed: "Payment failed",
  expired: "This invoice has expired",
  canceled: "This invoice was canceled",
};

function bodyFor(status: InvoiceStatus, merchant: string, settle: string, amount: string): string {
  switch (status) {
    case "payment_received":
      return `Your ZEC has arrived. Converting it to ${settle} now.`;
    case "converting":
      return `Sending ${amount} ${settle} to ${merchant}.`;
    case "paid_out":
      return `${merchant} received ${amount} ${settle}. You can close this page.`;
    case "underpaid":
      return "The payment cannot complete. Your ZEC is being returned to the refund address.";
    case "refunded":
      return "The payment could not complete, so your ZEC went back to the refund address.";
    case "failed":
      return `The conversion did not complete. Contact ${merchant} with this page's link.`;
    case "expired":
      return `Ask ${merchant} for a new invoice.`;
    case "canceled":
      return `Contact ${merchant} if you still want to pay.`;
    default:
      return "";
  }
}

export function PayPanel({
  id,
  status,
  merchantName,
  settleSymbol,
  amount,
  payment,
  timer,
  startSlot,
  sandboxSlot,
  errorSlot,
  footerSlot,
  frameSize = 280,
}: {
  id: string;
  status: InvoiceStatus;
  merchantName: string;
  settleSymbol: string;
  amount: string;
  payment: PayPanelPayment | null;
  timer?: { label: string; fraction: number } | null;
  startSlot?: React.ReactNode;
  sandboxSlot?: React.ReactNode;
  errorSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  frameSize?: number;
}) {
  const { stage, tone } = sealStage(status);
  const flowIndex = FLOW.indexOf(status);
  const zcashUri = payment ? `zcash:${payment.depositAddress}?amount=${payment.zecAmount}` : "";
  const showFrame = status !== "open";

  return (
    <div className="pay-panel">
      <div className="pay-head" aria-live="polite">
        <h2 className="h2">{TITLES[status]}</h2>
        {status !== "open" && status !== "awaiting_payment" && (
          <p className="soft">{bodyFor(status, merchantName, settleSymbol, amount)}</p>
        )}
      </div>

      {errorSlot}

      {status === "open" && startSlot}

      {showFrame && (
        <div className="pay-frame">
          <SealFrame id={id} stage={stage} tone={tone} size={frameSize} label={`Payment seal: ${TITLES[status]}`}>
            {payment && <Qr value={zcashUri} label={`QR code to pay ${payment.zecAmount} ZEC`} />}
          </SealFrame>
        </div>
      )}

      {flowIndex >= 0 && (
        <ol className="flow-steps" aria-label="Payment progress">
          {["Payment", "Received", "Converting", "Paid out"].map((label, i) => {
            const state = status === "paid_out" || i < flowIndex ? "done" : i === flowIndex ? "now" : "todo";
            return (
              <li key={label} className={`flow-step is-${state}`}>
                <span className="flow-bar" />
                <span className="flow-label">{label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {status === "awaiting_payment" && payment && (
        <div className="pay-details">
          <div className="pay-row">
            <div>
              <p className="small soft">Send exactly</p>
              <p className="pay-zec">
                {payment.zecAmount} <span>ZEC</span>
              </p>
              {payment.zecUsd ? (
                <p className="micro soft pay-usd">
                  About ${payment.zecUsd} at the quoted rate. Covers the ${amount} invoice plus conversion and fees.
                </p>
              ) : null}
            </div>
            <CopyButton value={payment.zecAmount} label="Copy amount" />
          </div>
          <div className="copy-field">
            <span className="addr">{payment.depositAddress}</span>
            <CopyButton value={payment.depositAddress} label="Copy address" />
          </div>
          <a className="btn btn-primary btn-lg btn-block wallet-btn" href={zcashUri}>
            Open in Zcash wallet
          </a>
          {timer && (
            <div className="hold">
              <div className="hold-bar" aria-hidden="true">
                <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, timer.fraction))})` }} />
              </div>
              <p className="small soft">
                Price held for <strong className="num">{timer.label}</strong>. Send from your shielded balance in one transaction.
              </p>
            </div>
          )}
          {sandboxSlot}
        </div>
      )}

      {status === "paid_out" && payment && (
        <dl className="receipt">
          <div>
            <dt>You paid</dt>
            <dd>{payment.zecAmount} ZEC</dd>
          </div>
          <div>
            <dt>{merchantName} received</dt>
            <dd>
              {amount} {settleSymbol}
            </dd>
          </div>
          {payment.payoutTxs?.[0] && (
            <div>
              <dt>Payout transaction</dt>
              <dd className="addr">
                {payment.payoutTxs[0].explorerUrl ? (
                  <a href={payment.payoutTxs[0].explorerUrl} target="_blank" rel="noreferrer">
                    {payment.payoutTxs[0].hash.slice(0, 10)}...{payment.payoutTxs[0].hash.slice(-6)}
                  </a>
                ) : (
                  `${payment.payoutTxs[0].hash.slice(0, 10)}...${payment.payoutTxs[0].hash.slice(-6)}`
                )}
              </dd>
            </div>
          )}
        </dl>
      )}

      {footerSlot}
    </div>
  );
}
