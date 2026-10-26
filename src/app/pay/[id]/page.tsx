import { notFound } from "next/navigation";
import { db } from "@/db";
import { attemptsFor, getInvoice, primaryAttempt, syncInvoice } from "@/lib/invoices";
import { publicInvoice } from "@/lib/public-invoice";
import { Checkout } from "./checkout";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await db();
  const inv = await getInvoice(d, id);
  return { title: inv ? `Pay ${inv.description}` : "Checkout", robots: { index: false } };
}

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await db();
  const found = await getInvoice(d, id);
  if (!found) notFound();
  const inv = await syncInvoice(d, found);
  const data = await publicInvoice(d, inv, primaryAttempt(await attemptsFor(d, inv.id)));
  return <Checkout initial={data} />;
}
