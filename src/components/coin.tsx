import { hashString, medallion } from "@/lib/guilloche";

/**
 * A struck metal coin with an engraved guilloche face: the 3D form of the network medallion.
 * Depth comes from a lit rim, a recessed bevel, a domed face, engraved lines with highlight and
 * shadow edges, reeded edge ticks and a soft cast shadow. Generated, not a logo.
 */

type Metal = { rimHi: string; rimLo: string; faceHi: string; faceLo: string; line: string; tick: string };

const METALS: Record<"blue" | "amber" | "steel", Metal> = {
  blue: { rimHi: "#E4ECFA", rimLo: "#3A5C98", faceHi: "#F6F9FE", faceLo: "#A7BDE2", line: "#24477F", tick: "#5B7BB4" },
  amber: { rimHi: "#FCEBC0", rimLo: "#94650F", faceHi: "#FFF8E8", faceLo: "#DDB05A", line: "#6E4A08", tick: "#B88A2C" },
  steel: { rimHi: "#EEF1F5", rimLo: "#4C5768", faceHi: "#F8F9FB", faceLo: "#B6BFCC", line: "#26303F", tick: "#7A8596" },
};

const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return `M${(32 + 28.2 * c).toFixed(2)} ${(32 + 28.2 * s).toFixed(2)}L${(32 + 30.2 * c).toFixed(2)} ${(32 + 30.2 * s).toFixed(2)}`;
}).join("");

export function Coin({ seed, size = 40, metal = "blue", label }: { seed: string; size?: number; metal?: keyof typeof METALS; label?: string }) {
  const m = METALS[metal];
  // Deterministic ids: identical coins share identical defs, so duplicates on a page are harmless.
  const id = `coin-${metal}-${hashString(seed).toString(36)}`;
  const [outer, inner] = medallion(seed, 50);
  const face = `translate(7 7)`;
  return (
    <svg
      className="coin"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-rim`} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor={m.rimHi} />
          <stop offset="0.55" stopColor={m.faceLo} />
          <stop offset="1" stopColor={m.rimLo} />
        </linearGradient>
        <linearGradient id={`${id}-bevel`} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor={m.rimLo} />
          <stop offset="1" stopColor={m.rimHi} />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="0.36" cy="0.32" r="0.78">
          <stop offset="0" stopColor={m.faceHi} />
          <stop offset="0.6" stopColor={m.faceLo} stopOpacity="0.9" />
          <stop offset="1" stopColor={m.rimLo} stopOpacity="0.75" />
        </radialGradient>
        <radialGradient id={`${id}-spec`} cx="0.3" cy="0.24" r="0.42">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="32" cy="32" r="24.6" />
        </clipPath>
      </defs>

      {/* cast shadow */}
      <ellipse cx="33" cy="37" rx="29.5" ry="27" fill="#0B1424" opacity="0.16" />
      {/* coin thickness: the edge seen below the face */}
      <circle cx="32" cy="33.8" r="30.5" fill={m.rimLo} />
      <circle cx="32" cy="33.8" r="30.5" fill="#0B1424" opacity="0.25" />
      {/* rim and reeded edge */}
      <circle cx="32" cy="32" r="30.5" fill={`url(#${id}-rim)`} />
      <path d={TICKS} stroke={m.tick} strokeWidth="0.7" opacity="0.55" />
      <circle cx="32" cy="32" r="30.5" fill="none" stroke={m.rimLo} strokeWidth="0.6" opacity="0.6" />
      {/* recessed bevel between rim and face */}
      <circle cx="32" cy="32" r="26.6" fill={`url(#${id}-bevel)`} />
      {/* domed face */}
      <circle cx="32" cy="32" r="25" fill={`url(#${id}-face)`} />

      {/* engraved line work: shadow edge, highlight edge, then the cut */}
      <g clipPath={`url(#${id}-clip)`} fill="none" strokeLinejoin="round">
        <g transform={`${face} translate(0.45 0.45)`} stroke="#fff" opacity="0.7">
          <path d={outer} strokeWidth="0.75" />
          <path d={inner} strokeWidth="0.9" />
        </g>
        <g transform={`${face} translate(-0.3 -0.3)`} stroke={m.rimLo} opacity="0.55">
          <path d={outer} strokeWidth="0.7" />
          <path d={inner} strokeWidth="0.85" />
        </g>
        <g transform={face} stroke={m.line}>
          <path d={outer} strokeWidth="0.55" opacity="0.85" />
          <path d={inner} strokeWidth="0.7" />
        </g>
        {/* specular light across the face */}
        <circle cx="32" cy="32" r="25" fill={`url(#${id}-spec)`} />
      </g>
      {/* thin highlight on the upper rim edge */}
      <path d="M9.6 24.5A23.9 23.9 0 0 1 39.5 8.9" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}
