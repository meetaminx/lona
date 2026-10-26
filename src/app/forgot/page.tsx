import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./form";

export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <AuthShell quote="Your funds never sit with Lona. Your account keys do, so keep them safe.">
      <ForgotForm />
    </AuthShell>
  );
}
