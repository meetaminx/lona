import Link from "next/link";
import { liveReadiness } from "@/app/actions/dashboard";
import { IconCheck } from "@/components/icons";
import { requireMerchant } from "@/lib/auth";
import { PasswordForm, ProfileForm, ResendVerify } from "./forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ golive?: string }> }) {
  const m = await requireMerchant();
  const { golive } = await searchParams;
  const ready = await liveReadiness(m.id, !!m.emailVerifiedAt);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="h1">Settings</h1>
          <p>Your business details, account security and live payments.</p>
        </div>
      </div>

      <section className={`panel ${golive && !ready.ok ? "panel-attention" : ""}`} id="go-live" aria-labelledby="golive-h">
        <div className="panel-head">
          <h2 id="golive-h" className="h3">Live payments</h2>
          <span className={`chip ${ready.ok ? "chip-green" : "chip-amber"}`}>{ready.ok ? "Ready" : "Not ready yet"}</span>
        </div>
        {golive && !ready.ok && (
          <p className="notice" style={{ margin: "16px 18px 0" }}>Finish these steps to switch to live mode. Test mode stays available.</p>
        )}
        <ul className="checklist">
          <li className={ready.emailVerified ? "done" : ""}>
            <span className="tick">{ready.emailVerified && <IconCheck />}</span>
            <div className="grow">
              <p style={{ fontWeight: 500 }}>Confirm your email</p>
              <p className="small soft">{ready.emailVerified ? `${m.email} is confirmed.` : `We sent a link to ${m.email}.`}</p>
            </div>
            {!ready.emailVerified && <ResendVerify />}
          </li>
          <li className={ready.settlement ? "done" : ""}>
            <span className="tick">{ready.settlement && <IconCheck />}</span>
            <div className="grow">
              <p style={{ fontWeight: 500 }}>Set your payout wallet</p>
              <p className="small soft">Where converted payments are sent.</p>
            </div>
            {!ready.settlement && <Link href="/dashboard/settlement" className="btn btn-secondary" style={{ height: 32 }}>Set wallet</Link>}
          </li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="profile-h">
        <div className="panel-head"><h2 id="profile-h" className="h3">Business profile</h2></div>
        <div className="panel-body">
          <ProfileForm
            initial={{
              businessName: m.businessName,
              supportEmail: m.supportEmail ?? "",
              defaultSuccessUrl: m.defaultSuccessUrl ?? "",
              sendReceipts: m.sendReceipts,
            }}
          />
        </div>
      </section>

      <section className="panel" aria-labelledby="pw-h">
        <div className="panel-head">
          <h2 id="pw-h" className="h3">Password</h2>
          <span className="small soft">{m.email}</span>
        </div>
        <div className="panel-body">
          <PasswordForm />
        </div>
      </section>
    </div>
  );
}
