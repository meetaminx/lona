import { Logo } from "@/components/logo";
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
            <button name="mode" value="live" aria-pressed={live} className="live">Live</button>
          </form>
          <div style={{ display: "grid", gap: 2 }}>
            <span className="small" style={{ fontWeight: 500 }}>{merchant.businessName}</span>
            <form action={logoutAction}>
              <button className="btn btn-quiet" style={{ padding: 0, height: "auto" }}>Log out</button>
            </form>
          </div>
        </div>
      </aside>
      <div>
        {!live && (
          <div className="test-banner">
            Test mode. Payments are simulated and no funds move. Switch to Live when your payout wallet is set.
          </div>
        )}
        <div className="main">{children}</div>
      </div>
    </div>
  );
}
