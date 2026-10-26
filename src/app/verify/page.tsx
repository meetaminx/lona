import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { merchants } from "@/db/schema";
import { AuthShell } from "@/components/auth-shell";
import { consumeToken } from "@/lib/tokens";

export const metadata = { title: "Confirm email" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const d = await db();
  const merchantId = await consumeToken(d, token, "verify");
  if (merchantId) await d.update(merchants).set({ emailVerifiedAt: new Date() }).where(eq(merchants.id, merchantId));
  return (
    <AuthShell quote="Every invoice gets its own seal. It is complete when the money lands.">
      <div style={{ maxWidth: 380, display: "grid", gap: 16 }}>
        <h1 className="h1">{merchantId ? "Email confirmed" : "This link has expired"}</h1>
        <p className="soft">
          {merchantId
            ? "Thanks. You can now switch to live payments once your payout wallet is set."
            : "Confirmation links work for 3 days and only once. Log in to send a new one."}
        </p>
        <Link href="/dashboard" className="btn btn-primary btn-lg">Go to dashboard</Link>
      </div>
    </AuthShell>
  );
}
