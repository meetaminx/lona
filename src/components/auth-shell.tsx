import { Logo } from "./logo";
import { rosette } from "@/lib/guilloche";

const art = [
  rosette({ cx: 280, cy: 280, radius: 270, R: 52, r: 11, d: 14, rotation: 0.3 }),
  rosette({ cx: 280, cy: 280, radius: 190, R: 33, r: 8, d: 11, rotation: 1.1 }),
  rosette({ cx: 280, cy: 280, radius: 110, R: 19, r: 7, d: 8, rotation: 0.6 }),
];

export function AuthShell({ quote, children }: { quote: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-art">
        <Logo />
        <svg className="art" viewBox="0 0 560 560" aria-hidden="true">
          {art.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={i === 1 ? "var(--amber)" : "#6FA2E6"} strokeWidth={0.7} opacity={0.75} />
          ))}
        </svg>
        <blockquote>{quote}</blockquote>
      </aside>
      <main className="auth-form">{children}</main>
    </div>
  );
}
