import Link from "next/link";
import { MARK_PATH } from "./mark-path";

export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d={MARK_PATH} fill="none" stroke="var(--amber)" strokeWidth={2.2} strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="Lona home">
      <Mark />
      <span>Lona</span>
    </Link>
  );
}
