import Link from "next/link";
import { Logo } from "./logo";
import { SITE } from "@/lib/site";

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <Logo />
        <nav className="site-nav" aria-label="Main">
          <Link href="/#how" className="hide-sm">How it works</Link>
          <Link href="/docs" className="hide-sm">Developers</Link>
          <Link href="/#pricing" className="hide-sm">Pricing</Link>
          {signedIn ? (
            <Link href="/dashboard" className="btn btn-primary">Open dashboard</Link>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/signup" className="btn btn-primary">Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div style={{ display: "grid", gap: 10 }}>
          <Logo />
          <p className="small soft">Shielded Zcash checkout with stablecoin payouts.</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/docs">API docs</Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms</Link>
          <a href={`mailto:${SITE.contactEmail}`}>Contact</a>
        </nav>
      </div>
    </footer>
  );
}
