import { toggleLinkAction } from "@/app/actions/dashboard";
import { db } from "@/db";
import { CopyButton } from "@/components/copy-button";
import { isLivemode, requireMerchant } from "@/lib/auth";
import { linkUrl, listPaymentLinks } from "@/lib/links";
import { formatUsd } from "@/lib/money";
import { NewLinkForm } from "./form";

export const metadata = { title: "Payment links" };

export default async function LinksPage() {
  const m = await requireMerchant();
  const live = await isLivemode();
  const d = await db();
  const links = await listPaymentLinks(d, m.id, live);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="h1">Payment links</h1>
          <p className="measure">One link you can share many times. Each visit opens a new invoice, so payments never collide.</p>
        </div>
      </div>
      <section className="panel panel-body">
        <NewLinkForm />
      </section>
      <section className="panel">
        {links.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Link</th>
                  <th scope="col" className="right">Amount</th>
                  <th scope="col" className="right">Status</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const url = linkUrl(l.slug);
                  return (
                    <tr key={l.id}>
                      <td>{l.title}</td>
                      <td>
                        <div className="copy-row">
                          <a href={url} target="_blank" rel="noreferrer" className="addr small">{url.replace(/^https?:\/\//, "")}</a>
                          <CopyButton value={url} className="btn btn-quiet" />
                        </div>
                      </td>
                      <td className="right num">{formatUsd(l.amountCents)}</td>
                      <td className="right">
                        <form action={toggleLinkAction}>
                          <input type="hidden" name="id" value={l.id} />
                          <input type="hidden" name="active" value={String(!l.active)} />
                          <button className="btn btn-quiet">{l.active ? "Turn off" : "Turn on"}</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <p>Create a link for something you sell often, like a ticket or a donation, and put it on your site or in a post.</p>
          </div>
        )}
      </section>
    </div>
  );
}
