import { rosette, waveBand } from "@/lib/guilloche";

const W = 1120;
const H = 400;
const CY = 200;
const LEFT = 170;
const RIGHT = W - 170;

// Computed once at module load; the shapes never change.
const amberRings = [
  rosette({ cx: LEFT, cy: CY, radius: 138, R: 42, r: 11, d: 13, rotation: 0.2 }),
  rosette({ cx: LEFT, cy: CY, radius: 92, R: 30, r: 7, d: 10, rotation: 0.7 }),
  rosette({ cx: LEFT, cy: CY, radius: 44, R: 16, r: 5, d: 5, rotation: 0.1 }),
];
const blueRings = [
  rosette({ cx: RIGHT, cy: CY, radius: 138, R: 44, r: 7, d: 9, rotation: 0.4 }),
  rosette({ cx: RIGHT, cy: CY, radius: 92, R: 27, r: 8, d: 11, rotation: 0.9 }),
  rosette({ cx: RIGHT, cy: CY, radius: 44, R: 15, r: 7, d: 6, rotation: 0.3 }),
];
const band = waveBand({ x0: LEFT + 60, x1: RIGHT - 60, yCenter: CY, lines: 22, amplitude: 34, wavelength: 260, spread: 86 });

/**
 * Hero illustration: a payment leaves the customer's shielded wallet (amber), passes through
 * the swap network where the deposit and payout are not linked (the band), and lands in the
 * merchant's wallet as a stablecoin (blue).
 */
export function HeroMotion() {
  return (
    <figure className="hero-motion">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="hero-motion-title">
        <title id="hero-motion-title">
          A payment moves from a shielded Zcash wallet, through the swap network, to the merchant&apos;s wallet as USDC.
        </title>
        <g className="hm-band">
          {band.map((d, i) => (
            <path key={i} d={d} pathLength={1} style={{ animationDelay: `${300 + i * 35}ms` }} />
          ))}
        </g>
        <g className="hm-rose hm-amber">
          {amberRings.map((d, i) => (
            <path key={i} d={d} pathLength={1} style={{ animationDelay: `${i * 180}ms` }} />
          ))}
        </g>
        <g className="hm-rose hm-blue">
          {blueRings.map((d, i) => (
            <path key={i} d={d} pathLength={1} style={{ animationDelay: `${700 + i * 180}ms` }} />
          ))}
        </g>

        {/* The payment: amber on the way in, hidden inside the band, blue on the way out. */}
        <g className="hm-note-in">
          <rect x={-22} y={-14} width={44} height={28} rx={4} />
          <text x={0} y={5} textAnchor="middle">ZEC</text>
        </g>
        <g className="hm-note-out">
          <rect x={-26} y={-14} width={52} height={28} rx={4} />
          <text x={0} y={5} textAnchor="middle">USDC</text>
        </g>
      </svg>

      <figcaption className="hm-legend">
        <div>
          <span className="hm-key hm-key-amber" aria-hidden="true" />
          <p className="h3">Your customer</p>
          <p className="small soft">Scans a QR code and pays from a shielded Zcash wallet. Their balance and history stay private.</p>
        </div>
        <div>
          <span className="hm-key hm-key-ink" aria-hidden="true" />
          <p className="h3">The swap network</p>
          <p className="small soft">Converts the ZEC at a price locked when the customer opened checkout. Lona never holds the funds.</p>
        </div>
        <div>
          <span className="hm-key hm-key-blue" aria-hidden="true" />
          <p className="h3">Your wallet</p>
          <p className="small soft">Receives the exact invoice amount in USDC on Base, Arbitrum, Ethereum or Solana.</p>
        </div>
      </figcaption>
    </figure>
  );
}
