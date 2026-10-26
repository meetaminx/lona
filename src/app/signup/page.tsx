import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { currentMerchant } from "@/lib/auth";
import { SignupForm } from "./form";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await currentMerchant()) redirect("/dashboard");
  return (
    <AuthShell quote="Your customers keep their wallets private. You keep dollars.">
      <SignupForm />
    </AuthShell>
  );
}
