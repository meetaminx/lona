import Link from "next/link";
import type { Invoice } from "@/db/schema";
import { formatUsd } from "@/lib/money";
import { StatusChip } from "./status-chip";
import { Seal } from "./seal";
import { sealStage } from "@/lib/stage";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function InvoiceTable({ rows }: { rows: Invoice[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col">Status</th>
            <th scope="col">Reference</th>
            <th scope="col">Created</th>
            <th scope="col" className="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => (
            <tr key={inv.id}>
              <td>
                <span className="inv-cell">
                  <Seal id={inv.id} stage={sealStage(inv.status).stage || 1} tone={sealStage(inv.status).tone} size={30} />
                  <Link className="rowlink" href={`/dashboard/invoices/${inv.id}`}>{inv.description}</Link>
                </span>
              </td>
              <td><StatusChip status={inv.status} /></td>
              <td className="soft">{inv.reference ?? ""}</td>
              <td className="soft num">{dateFmt.format(inv.createdAt)}</td>
              <td className="right num">{formatUsd(inv.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
