import Link from "next/link";
import { Logo } from "@/components/logo";
import { Medallion } from "@/components/medallion";
import { logoutAction } from "@/app/actions/auth";
import { setModeAction } from "@/app/actions/dashboard";
import { isLivemode, requireMerchant } from "@/lib/auth";
import { DashNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const merchant = await requireMerchant();
  const live = await isLivemode();
  return (
    <div className="dash">
      <aside className="rail">
        <Logo href="/dashboard" />
        <DashNav />
        <div className="rail-foot">
          <form action={setModeAction} className="mode-switch" aria-label="Mode">
            <button name="mode" value="test" aria-pressed={!live}>Test</button>
            <button name="mode" value="live" aria-pressed={live} className="live">
              {live && <span className="live-dot" aria-hidden="true" />} Live
            </button>
          </form>
          <div className="rail-account">
            <Medallion seed={merchant.businessName} size={32} />
            <div style={{ minWidth: 0 }}>
              <p className="small rail-name">{merchant.businessName}</p>
              <form action={logoutAction}>
                <button className="rail-logout">Log out</button>
              </form>
            </div>
          </div>
        </div>
      </aside>
      <div>
        {!merchant.emailVerifiedAt && (
          <div className="verify-banner">
            Confirm your email to unlock live payments. <Link href="/dashboard/settings#go-live">Send the link again</Link>
          </div>
        )}
        {!live && (
          <div className="test-banner">
            Test mode. Payments are simulated and no funds move. Switch to Live once your email is confirmed and your payout wallet is set.
          </div>
        )}
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
