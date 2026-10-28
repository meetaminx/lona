import { Coin } from "@/components/coin";
import { waveBand } from "@/lib/guilloche";

const band = waveBand({ x0: 70, x1: 410, yCenter: 90, lines: 16, amplitude: 22, wavelength: 170, spread: 46 });

/** ZEC enters the swap network (the band), the link between deposit and payout is not public, USDC leaves. */
export function RouteVignette({ active = true, zec, usd }: { active?: boolean; zec: string; usd: string }) {
  return (
    <div className={`route-vig ${active ? "is-active" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 480 180" className="rv-svg">
        <g className="rv-band">
          {band.map((d, i) => (
            <path key={i} d={d} pathLength={1} style={{ animationDelay: `${i * 40}ms` }} />
          ))}
        </g>
        <g className="rv-in">
          <rect x={-24} y={-13} width={48} height={26} rx={4} />
          <text x={0} y={4.5} textAnchor="middle">ZEC</text>
        </g>
        <g className="rv-out">
          <rect x={-28} y={-13} width={56} height={26} rx={4} />
          <text x={0} y={4.5} textAnchor="middle">USDC</text>
        </g>
      </svg>
      <div className="rv-ends">
        <div>
          <Coin seed="net:Zcash" metal="amber" size={56} />
          <p className="small" style={{ fontWeight: 600 }}>{zec} ZEC in</p>
          <p className="micro soft">Customer&apos;s deposit</p>
        </div>
        <div className="rv-mid">
          <p className="small" style={{ fontWeight: 600 }}>NEAR Intents</p>
          <p className="micro soft">Market makers compete on the price</p>
        </div>
        <div>
          <Coin seed="net:Base" metal="blue" size={56} />
          <p className="small" style={{ fontWeight: 600 }}>{usd} USDC out</p>
          <p className="micro soft">Your wallet on Base</p>
        </div>
      </div>
    </div>
  );
}
