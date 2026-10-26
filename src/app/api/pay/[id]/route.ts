import { NextResponse } from "next/server";
import { db } from "@/db";
import { handleError, jsonError } from "@/lib/api";
import { attemptsFor, getInvoice, primaryAttempt, syncInvoice } from "@/lib/invoices";
import { publicInvoice } from "@/lib/public-invoice";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const d = await db();
    const found = await getInvoice(d, id);
    if (!found) return jsonError(404, "not_found", "This invoice does not exist.");
    const inv = await syncInvoice(d, found);
    return NextResponse.json(await publicInvoice(d, inv, primaryAttempt(await attemptsFor(d, inv.id))));
  } catch (err) {
    return handleError(err);
  }
}
