"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { merchants } from "@/db/schema";
import { createMerchant, createSession, destroySession, hashPassword, setLivemode, verifyPassword } from "@/lib/auth";
import { sessions } from "@/db/schema";
import { sendResetEmail, sendVerifyEmail } from "@/lib/account-mail";
import { canShowDevLinks } from "@/lib/mailer";
import { consumeToken } from "@/lib/tokens";

export type FormState =
  | { error?: string; ok?: string; devLink?: string; values?: Record<string, string>; fields?: Record<string, string> }
  | undefined;

export async function signupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const businessName = String(form.get("businessName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const values = { businessName, email };
  const fields: Record<string, string> = {};
  if (!businessName) fields.businessName = "Enter your business name. Customers see it at checkout.";
  if (!email) fields.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Enter a valid email address, like you@business.com.";
  if (password.length < 10) fields.password = "Use a password of at least 10 characters.";
  if (Object.keys(fields).length) return { error: "Check the highlighted fields.", fields, values };
  const res = await createMerchant({ email, password, businessName });
  if ("error" in res && res.error) return { error: res.error, fields: { email: res.error }, values };
  if (!("merchant" in res) || !res.merchant) return { error: "Something went wrong. Try again.", values };
  await sendVerifyEmail(await db(), res.merchant);
  await createSession(res.merchant.id);
  await setLivemode(false);
  redirect("/dashboard");
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter your email and password.", values: { email } };
  }
  const d = await db();
  const [m] = await d.select().from(merchants).where(eq(merchants.email, email));
  if (!m || !(await verifyPassword(password, m.passwordHash))) {
    return { error: "That email and password do not match an account.", values: { email } };
  }
  await createSession(m.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function forgotAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter the email you signed up with.", values: { email } };
  const d = await db();
  const [m] = await d.select().from(merchants).where(eq(merchants.email, email));
  let devLink: string | undefined;
  if (m) {
    const sent = await sendResetEmail(d, m);
    if (!sent.delivered && canShowDevLinks()) devLink = sent.link;
  }
  // Same answer whether or not the account exists, so the form cannot be used to find accounts.
  return { ok: "If an account uses that email, a reset link is on its way. It works for 1 hour.", devLink };
}

export async function resetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return { error: "Use a password of at least 10 characters." };
  const d = await db();
  const merchantId = await consumeToken(d, token, "reset");
  if (!merchantId) return { error: "This reset link has expired or was already used. Ask for a new one." };
  await d.update(merchants).set({ passwordHash: await hashPassword(password) }).where(eq(merchants.id, merchantId));
  await d.delete(sessions).where(eq(sessions.merchantId, merchantId)); // sign out everywhere
  await createSession(merchantId);
  redirect("/dashboard?notice=password-reset");
}
