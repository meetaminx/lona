"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { circlePath, guillocheRing, sealRings } from "@/lib/guilloche";
import type { SealTone } from "./seal";

const SIZE = 320;
const C = SIZE / 2;
const LINES = 12;
const MICRO = "SHIELDED CHECKOUT  LONA  ".repeat(7);
const MICRO_LEN = Math.round(2 * Math.PI * 151);

/** How many ring lines are drawn at each stage (0 to 4). */
const DRAWN = [0, 3, 6, 9, 12];

/**
 * The checkout's signature element: a guilloche ring that frames the QR code and draws itself
 * line by line as the payment moves. When the payment is paid out, the QR gives way to the
 * invoice's own seal.
 */
export function SealFrame({
  id,
  stage,
  tone,
  size = 300,
  children,
  label,
}: {
  id: string;
  stage: number;
  tone: SealTone;
  size?: number;
  children?: React.ReactNode;
  label?: string;
}) {
  const uid = useId().replace(/:/g, "");
  // Start undrawn so the first stage animates in on load.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);
  stage = mounted ? stage : 0;
  const ring = useMemo(() => guillocheRing({ cx: C, cy: C, radius: 128, width: 26, lines: LINES, waves: 30 }), []);
  const rings = useMemo(() => sealRings(id, 200), [id]);
  const color = { amber: "var(--amber)", blue: "var(--blue)", red: "var(--red)", muted: "var(--ink-faint)" }[tone];
  const complete = stage >= 4;
  const drawn = DRAWN[Math.max(0, Math.min(4, stage))];

  return (
    <div
      className={`seal-frame ${complete ? "is-complete" : ""}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className="seal-frame-svg">
        <defs>
          <path id={`mp-${uid}`} d={circlePath(C, C, 151)} />
        </defs>
        <circle cx={C} cy={C} r={111} fill="none" stroke="var(--rule)" strokeWidth={0.8} />
        <circle cx={C} cy={C} r={145} fill="none" stroke="var(--rule)" strokeWidth={0.8} />
        <text className="seal-micro">
          <textPath href={`#mp-${uid}`} textLength={MICRO_LEN} lengthAdjust="spacing">{MICRO}</textPath>
        </text>
        <g className="seal-frame-ring">
          {ring.map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke="var(--rule)" strokeWidth={0.6} opacity={0.6} />
              <path
                d={d}
                pathLength={1}
                fill="none"
                stroke={color}
                strokeWidth={complete ? 0.55 : 0.75}
                strokeDasharray="1 1"
                strokeDashoffset={i < drawn ? 0 : 1}
                style={{
                  transition: `stroke-dashoffset 1100ms var(--ease-out) ${i < drawn ? (i % 3) * 140 : 0}ms, stroke 500ms ease-out`,
                }}
              />
            </g>
          ))}
        </g>
        <g className="seal-frame-core" style={{ opacity: complete ? 1 : 0 }}>
          <g transform={`translate(${C - 90} ${C - 90}) scale(0.9)`}>
            {rings.map((r, i) => (
              <path
                key={i}
                d={r.d}
                pathLength={1}
                fill="none"
                stroke={color}
                strokeWidth={r.width * 1.1}
                opacity={r.opacity}
                strokeDasharray="1 1"
                strokeDashoffset={complete ? 0 : 1}
                style={{ transition: `stroke-dashoffset 1400ms var(--ease-out) ${complete ? 300 + i * 160 : 0}ms` }}
              />
            ))}
          </g>
        </g>
      </svg>
      <div className="seal-frame-center" style={{ opacity: complete ? 0 : 1 }}>
        {children}
      </div>
    </div>
  );
}
