/**
 * Guilloche line art, the pattern family used on banknotes and cheques.
 * Pure functions that return SVG path data, usable on server and client.
 */

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * Hypotrochoid rosette centred on (cx, cy), scaled so its outer edge sits at `radius`.
 * R and r are integers; the pattern closes after r / gcd(R, r) turns.
 */
export function rosette(opts: {
  cx: number;
  cy: number;
  radius: number;
  R: number;
  r: number;
  d: number;
  rotation?: number;
  samplesPerTurn?: number;
}): string {
  const { cx, cy, radius, R, r, d, rotation = 0, samplesPerTurn = 360 } = opts;
  const turns = r / gcd(R, r);
  const steps = Math.ceil(turns * samplesPerTurn);
  const scale = radius / (R - r + d);
  const k = (R - r) / r;
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  let out = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * Math.PI * 2;
    const x = ((R - r) * Math.cos(t) + d * Math.cos(k * t)) * scale;
    const y = ((R - r) * Math.sin(t) - d * Math.sin(k * t)) * scale;
    const px = cx + x * cosR - y * sinR;
    const py = cy + x * sinR + y * cosR;
    out += `${i === 0 ? "M" : "L"}${f(px)} ${f(py)}`;
  }
  return out + "Z";
}

/** A horizontal band of interlaced waves, like the security strip on a note. */
export function waveBand(opts: {
  x0: number;
  x1: number;
  yCenter: number;
  lines: number;
  amplitude: number;
  wavelength: number;
  spread: number;
  step?: number;
}): string[] {
  const { x0, x1, yCenter, lines, amplitude, wavelength, spread, step = 4 } = opts;
  const paths: string[] = [];
  for (let i = 0; i < lines; i++) {
    const phase = (i / lines) * Math.PI * 1.25;
    const offset = (i / (lines - 1) - 0.5) * spread;
    let p = "";
    for (let x = x0; x <= x1 + 0.01; x += step) {
      const u = (x - x0) / wavelength;
      // Envelope pinches the band at both ends so it reads as a closed strip.
      const env = Math.sin(((x - x0) / (x1 - x0)) * Math.PI);
      const y =
        yCenter +
        offset * (0.35 + 0.65 * env) +
        amplitude * env * Math.sin(u * Math.PI * 2 + phase) +
        amplitude * 0.18 * env * Math.sin(u * Math.PI * 6 + phase * 3);
      p += `${x === x0 ? "M" : "L"}${f(x)} ${f(y)}`;
    }
    paths.push(p);
  }
  return paths;
}

/** Small, stable string hash (FNV-1a). Same result in Node and the browser. */
export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seeded(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

export type SealRing = { d: string; width: number; opacity: number };

/**
 * Four concentric rings derived from an ID. No two invoices share a seal.
 * Ring order is outer to inner; the checkout draws them one per payment stage.
 */
export function sealRings(id: string, size = 200): SealRing[] {
  const rand = seeded(hashString(id));
  const c = size / 2;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const rot = () => rand() * Math.PI * 2;

  const outerR = pick([36, 40, 42, 44, 48]);
  const outerr = pick([5, 7, 11]);
  const midR = pick([25, 27, 28, 30, 33]);
  const midr = pick([4, 6, 8]);
  const innerR = pick([14, 15, 16, 18]);
  const innerr = pick([5, 7]);
  const coreR = pick([9, 10, 12]);
  const corer = pick([4, 5]);

  return [
    { d: rosette({ cx: c, cy: c, radius: size * 0.48, R: outerR, r: outerr, d: outerr * (0.9 + rand() * 0.6), rotation: rot() }), width: 0.7, opacity: 0.85 },
    { d: rosette({ cx: c, cy: c, radius: size * 0.37, R: midR, r: midr, d: midr * (1.2 + rand() * 0.8), rotation: rot() }), width: 0.7, opacity: 0.8 },
    { d: rosette({ cx: c, cy: c, radius: size * 0.25, R: innerR, r: innerr, d: innerr * (0.8 + rand() * 0.7), rotation: rot() }), width: 0.8, opacity: 0.85 },
    { d: rosette({ cx: c, cy: c, radius: size * 0.13, R: coreR, r: corer, d: corer * (1 + rand() * 0.5), rotation: rot() }), width: 0.9, opacity: 0.95 },
  ];
}
