import Link from "next/link";
import { Logo } from "./logo";
import { SITE } from "@/lib/site";
import { HeaderShell } from "./header-shell";

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <HeaderShell>
      <div className="wrap header-row">
        <Logo />
        <nav className="site-nav" aria-label="Main">
          <Link href="/#how" className="hide-sm">How it works</Link>
          <Link href="/#developers" className="hide-sm">Developers</Link>
          <Link href="/#pricing" className="hide-sm">Pricing</Link>
          <Link href="/docs" className="hide-sm">Docs</Link>
        </nav>
        <div className="header-actions">
          {signedIn ? (
            <Link href="/dashboard" className="btn btn-primary">Open dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-quiet header-login">Log in</Link>
              <Link href="/signup" className="btn btn-primary">Create account</Link>
            </>
          )}
        </div>
      </div>
    </HeaderShell>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer2">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <Logo />
            <p className="small soft">Shielded Zcash checkout with stablecoin payouts.</p>
          </div>
          <nav aria-label="Product">
            <p className="footer-h">Product</p>
            <Link href="/#how">How it works</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/signup">Create account</Link>
            <Link href="/login">Log in</Link>
          </nav>
          <nav aria-label="Developers">
            <p className="footer-h">Developers</p>
            <Link href="/docs">API reference</Link>
            <Link href="/docs#webhooks">Webhooks</Link>
            <Link href="/docs#test-mode">Test mode</Link>
          </nav>
          <nav aria-label="Company">
            <p className="footer-h">Company</p>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms</Link>
            <a href={`mailto:${SITE.contactEmail}`}>Contact</a>
          </nav>
        </div>
        <p className="footer-legal small soft">
          {SITE.legalName} provides payment software. It is not a bank or exchange and never takes custody
          of funds. Conversions are performed by NEAR Intents under its own terms. Digital asset prices move; quotes are held
          for a limited time.
        </p>
      </div>
    </footer>
  );
}
