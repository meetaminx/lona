"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { merchants } from "@/db/schema";
import { createMerchant, createSession, destroySession, setLivemode, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string; values?: Record<string, string> } | undefined;

export async function signupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const businessName = String(form.get("businessName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const values = { businessName, email };
  if (!businessName) return { error: "Enter your business name. Customers see it at checkout.", values };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address.", values };
  if (password.length < 10) return { error: "Use a password of at least 10 characters.", values };
  const res = await createMerchant({ email, password, businessName });
  if ("error" in res) return { error: res.error, values };
  await createSession(res.merchant.id);
  await setLivemode(false);
  redirect("/dashboard");
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
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
