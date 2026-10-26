import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { currentMerchant } from "@/lib/auth";
import { LoginForm } from "./form";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await currentMerchant()) redirect("/dashboard");
  return (
    <AuthShell quote="Every invoice gets its own seal. It is complete when the money lands.">
      <LoginForm />
    </AuthShell>
  );
}
