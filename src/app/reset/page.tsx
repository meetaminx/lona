import Link from "next/link";
import { db } from "@/db";
import { AuthShell } from "@/components/auth-shell";
import { peekToken } from "@/lib/tokens";
import { ResetForm } from "./form";

export const metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = await peekToken(await db(), token, "reset");
  return (
    <AuthShell quote="Your funds never sit with Lona. Your account keys do, so keep them safe.">
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <div style={{ maxWidth: 380, display: "grid", gap: 16 }}>
          <h1 className="h1">This link has expired</h1>
          <p className="soft">Reset links work for 1 hour and only once.</p>
          <Link href="/forgot" className="btn btn-primary btn-lg">Send a new link</Link>
        </div>
      )}
    </AuthShell>
  );
}
