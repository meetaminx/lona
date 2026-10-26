"use client";

import { useMemo } from "react";
import { sealRings } from "@/lib/guilloche";

export type SealTone = "amber" | "blue" | "red" | "muted";

/**
 * The invoice seal. Rings draw in as the payment advances (stage 0 to 4) and the
 * finished seal turns slowly. Patterns are derived from the invoice ID.
 */
export function Seal({
  id,
  stage,
  tone = "amber",
  size = 200,
  label,
}: {
  id: string;
  stage: number;
  tone?: SealTone;
  size?: number;
  label?: string;
}) {
  const rings = useMemo(() => sealRings(id, 200), [id]);
  // Fine lines vanish at thumbnail sizes; thicken them as the seal shrinks.
  const k = size < 80 ? 200 / size / 2.2 : 1;
  const color = { amber: "var(--amber)", blue: "var(--blue)", red: "var(--red)", muted: "var(--ink-soft)" }[tone];
  return (
    <svg
      className={`seal ${stage >= 4 ? "seal-complete" : ""}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g className="seal-spin">
        {rings.map((ring, i) => {
          // Outer ring shows at stage 1, the core at stage 4.
          const drawn = stage >= i + 1;
          return (
            <g key={i}>
              <path d={ring.d} fill="none" stroke="var(--rule)" strokeWidth={ring.width * k} opacity={size < 80 ? 0.35 : 0.55} />
              <path
                d={ring.d}
                pathLength={1}
                fill="none"
                stroke={color}
                strokeWidth={ring.width * k}
                opacity={ring.opacity}
                strokeDasharray="1 1"
                strokeDashoffset={drawn ? 0 : 1}
                style={{ transition: `stroke-dashoffset 900ms var(--ease) ${drawn ? i * 120 : 0}ms, stroke 400ms ease-out` }}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
