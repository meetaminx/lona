/** What someone watching each blockchain can see about one Lona payment. Drawn as explorer rows. */
export function Observer() {
  return (
    <div className="obs">
      <div className="obs-col">
        <div className="obs-head">
          <span className="obs-dot obs-amber" />
          <p className="h3">Zcash shielded pool</p>
        </div>
        <div className="obs-panel">
          <Row k="From" v={<Hidden w={120} />} />
          <Row k="Balance" v={<Hidden w={80} />} />
          <Row k="History" v={<Hidden w={140} />} />
          <Row k="Amount sent" v={<Hidden w={70} />} />
        </div>
        <p className="obs-note">The customer&apos;s wallet, balance and past payments stay encrypted.</p>
      </div>
      <div className="obs-col">
        <div className="obs-head">
          <span className="obs-dot obs-ink" />
          <p className="h3">Deposit address</p>
        </div>
        <div className="obs-panel">
          <Row k="Address" v={<span className="addr">t1Tj9c...MEcmzoB</span>} />
          <Row k="Received" v="3.216 ZEC" visible />
          <Row k="Time" v="12:04:02 UTC" visible />
          <Row k="Sender" v={<span className="obs-shield">Shielded</span>} />
        </div>
        <p className="obs-note">Zcash deposits to the swap network use transparent addresses, so the amount and time are public.</p>
      </div>
      <div className="obs-col">
        <div className="obs-head">
          <span className="obs-dot obs-blue" />
          <p className="h3">Your payout on Base</p>
        </div>
        <div className="obs-panel">
          <Row k="To" v={<span className="addr">0x4b4b...4b4b</span>} visible />
          <Row k="Amount" v="128.00 USDC" visible />
          <Row k="From" v="Swap network" visible />
          <Row k="Linked to deposit" v={<span className="obs-shield">Not publicly</span>} />
        </div>
        <p className="obs-note">A normal stablecoin transfer to your wallet, like any other on Base.</p>
      </div>
    </div>
  );
}

function Row({ k, v, visible }: { k: string; v: React.ReactNode; visible?: boolean }) {
  return (
    <div className={`obs-row ${visible ? "is-visible" : ""}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Hidden({ w }: { w: number }) {
  return <span className="obs-hidden" style={{ width: w }} aria-label="Hidden" />;
}
