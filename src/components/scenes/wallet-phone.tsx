import { Mark } from "@/components/logo";

export type WalletState = "review" | "pressing" | "sent";

/** A generic shielded Zcash wallet, drawn as product UI (not any specific wallet's design). */
export function WalletPhone({ state, amount, address }: { state: WalletState; amount: string; address: string }) {
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone-notch" />
      <div className="phone-screen">
        <div className="phone-top">
          <span className="phone-time">9:41</span>
          <span className="phone-pill">Shielded</span>
        </div>
        {state !== "sent" ? (
          <div className="phone-body">
            <p className="phone-label">Send ZEC</p>
            <div className="phone-amount">
              {amount}
              <span>ZEC</span>
            </div>
            <div className="phone-field">
              <span>To</span>
              <span className="addr">{address.slice(0, 8)}...{address.slice(-6)}</span>
            </div>
            <div className="phone-field">
              <span>From</span>
              <span>Shielded balance</span>
            </div>
            <div className="phone-field">
              <span>Network fee</span>
              <span>0.0001 ZEC</span>
            </div>
            <div className={`phone-send ${state === "pressing" ? "is-pressed" : ""}`}>Send privately</div>
          </div>
        ) : (
          <div className="phone-body phone-done">
            <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
              <circle cx="28" cy="28" r="26" fill="none" stroke="var(--amber)" strokeWidth="1.5" className="phone-check-ring" pathLength={1} />
              <path d="M18 29l7 7 13-15" fill="none" stroke="var(--amber)" strokeWidth="2.2" className="phone-check" pathLength={1} />
            </svg>
            <p className="phone-label" style={{ color: "#fff" }}>Sent privately</p>
            <p className="phone-sub">{amount} ZEC from your shielded balance</p>
          </div>
        )}
        <div className="phone-foot">
          <Mark size={12} /> <span>Paying via Lona</span>
        </div>
      </div>
    </div>
  );
}
