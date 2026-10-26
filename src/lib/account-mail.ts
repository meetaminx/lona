import type { DB } from "@/db";
import type { Merchant } from "@/db/schema";
import { appUrl } from "@/lib/invoices";
import { layout, sendMail, type MailResult } from "@/lib/mailer";
import { issueToken } from "@/lib/tokens";

export async function sendVerifyEmail(d: DB, m: Merchant): Promise<MailResult & { link: string }> {
  const link = `${appUrl()}/verify?token=${await issueToken(d, m.id, "verify")}`;
  const { html, text } = layout({
    heading: "Confirm your email",
    body: [`Confirm this address to finish setting up ${m.businessName} on Lona. You need a confirmed email before switching to live payments.`],
    action: { label: "Confirm email", url: link },
    footer: "This link works for 3 days. If you did not create a Lona account, ignore this email.",
  });
  return { ...(await sendMail({ to: m.email, subject: "Confirm your email for Lona", html, text })), link };
}

export async function sendResetEmail(d: DB, m: Merchant): Promise<MailResult & { link: string }> {
  const link = `${appUrl()}/reset?token=${await issueToken(d, m.id, "reset")}`;
  const { html, text } = layout({
    heading: "Reset your password",
    body: ["Someone asked to reset the password for this Lona account. If it was you, choose a new password below."],
    action: { label: "Choose a new password", url: link },
    footer: "This link works for 1 hour and only once. If you did not ask for this, ignore this email; your password has not changed.",
  });
  return { ...(await sendMail({ to: m.email, subject: "Reset your Lona password", html, text })), link };
}
