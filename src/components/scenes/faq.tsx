const QA: [string, string][] = [
  [
    "Does Lona hold my money?",
    "No. Each customer pays a deposit address on the NEAR Intents swap network, which sends the converted stablecoin straight to the payout wallet you set. Lona creates the quote, tracks it and tells your server when it lands.",
  ],
  [
    "What happens if the ZEC price moves while the customer pays?",
    "The ZEC amount is fixed when the customer opens checkout and held for 20 minutes. You always receive the exact invoice amount. If the hold expires, the customer gets a fresh price.",
  ],
  [
    "What if the customer sends the wrong amount?",
    "If less than the quoted amount arrives, the conversion does not complete and the ZEC goes back to the refund address. You get an invoice.underpaid webhook, then invoice.refunded.",
  ],
  [
    "Which wallets can customers use?",
    "Any Zcash wallet that can send from a shielded balance to a transparent address. On mobile, checkout opens the wallet directly with the address and amount filled in.",
  ],
  [
    "Is the payment fully private?",
    "The customer's wallet, balance and history are private. The ZEC amount sent to the deposit address and your USDC payout are public, as shown above. We say this plainly so you can tell your customers the truth.",
  ],
  [
    "Can I test without real money?",
    "Yes. Test mode simulates every outcome, including underpayments and refunds, and sends the same webhooks as live mode.",
  ],
];

export function Faq() {
  return (
    <div className="faq">
      {QA.map(([q, a]) => (
        <details key={q}>
          <summary>
            <span>{q}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </summary>
          <p className="soft">{a}</p>
        </details>
      ))}
    </div>
  );
}
