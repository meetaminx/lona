import { formatUsd } from "@/lib/money";

export type DayTotal = { day: string; cents: number; count: number };

const W = 720;
const H = 180;
const PAD_B = 22;
const PAD_T = 12;

/** Daily payouts, one series. Bars with a hover/focus tooltip and an equivalent table for screen readers. */
export function PayoutChart({ days }: { days: DayTotal[] }) {
  const max = Math.max(...days.map((d) => d.cents), 1);
  const nice = niceMax(max);
  const slot = W / days.length;
  const barW = Math.max(4, slot - 4); // 2px surface gap each side
  const plotH = H - PAD_B - PAD_T;
  const fmtDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <figure className="pchart">
      <svg viewBox={`0 0 ${W} ${H}`} className="pchart-svg" role="img" aria-label="Payouts per day, last 30 days">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={0} x2={W} y1={PAD_T + plotH * (1 - f)} y2={PAD_T + plotH * (1 - f)} className="pchart-grid" />
            {f > 0 && (
              <text x={0} y={PAD_T + plotH * (1 - f) - 4} className="pchart-axis">
                {"$" + Math.round((nice * f) / 100).toLocaleString("en-US")}
              </text>
            )}
          </g>
        ))}
        {days.map((d, i) => {
          const h = d.cents ? Math.max(3, (d.cents / nice) * plotH) : 0;
          const x = i * slot + (slot - barW) / 2;
          const y = PAD_T + plotH - h;
          return (
            <g key={d.day} className="pchart-bar" tabIndex={0} aria-label={`${fmtDay.format(new Date(d.day))}: ${formatUsd(d.cents)}`}>
              <rect x={i * slot} y={PAD_T} width={slot} height={plotH} className="pchart-hit" />
              {h > 0 && <path d={roundedTop(x, y, barW, h, Math.min(4, barW / 2))} className="pchart-mark" />}
              <g className="pchart-tip" transform={`translate(${Math.min(Math.max(x + barW / 2, 70), W - 70)} ${Math.max(y - 10, 40)})`}>
                <rect x={-68} y={-38} width={136} height={34} rx={4} />
                <text x={0} y={-24} textAnchor="middle" className="pchart-tip-d">{fmtDay.format(new Date(d.day))}</text>
                <text x={0} y={-10} textAnchor="middle" className="pchart-tip-v">
                  {formatUsd(d.cents)} ({d.count})
                </text>
              </g>
            </g>
          );
        })}
        <text x={0} y={H - 4} className="pchart-axis">{fmtDay.format(new Date(days[0].day))}</text>
        <text x={W} y={H - 4} textAnchor="end" className="pchart-axis">Today</text>
      </svg>
      <table className="visually-hidden">
        <caption>Payouts per day, last 30 days</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{formatUsd(d.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h);
  return `M${x} ${y + h}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`;
}

function niceMax(v: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}
