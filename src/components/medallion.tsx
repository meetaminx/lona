import { medallion } from "@/lib/guilloche";

/** Generated guilloche medallion: an identity mark for a merchant or network without using logos. */
export function Medallion({ seed, size = 40, tone = "ink" }: { seed: string; size?: number; tone?: "ink" | "amber" | "blue" }) {
  const [outer, inner] = medallion(seed, 48);
  const stroke = tone === "amber" ? "var(--amber)" : tone === "blue" ? "var(--blue)" : "var(--ink)";
  return (
    <svg className="medallion" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23.5" fill="var(--paper-raised)" stroke="var(--rule)" />
      <path d={outer} fill="none" stroke={stroke} strokeWidth={0.6} opacity={0.75} />
      <path d={inner} fill="none" stroke={stroke} strokeWidth={0.8} />
    </svg>
  );
}
