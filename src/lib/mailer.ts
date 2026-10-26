/**
 * Transactional email. Sends through Resend when RESEND_API_KEY is set; otherwise logs the
 * message so local development works without an email account.
 */
export type Mail = { to: string; subject: string; html: string; text: string };
export type MailResult = { delivered: boolean; error?: string };

export async function sendMail(mail: Mail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? "Lona <no-reply@example.com>";
  if (!key) {
    console.info(`[mail:not-sent] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    return { delivered: false, error: "Email is not configured (RESEND_API_KEY is not set)." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 500);
      console.error(`[mail:failed] status=${res.status} from="${from}" to=${mail.to} detail=${detail}`);
      return { delivered: false, error: `Email provider responded ${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    console.error(`[mail:failed] to=${mail.to} error=${String(err)}`);
    return { delivered: false, error: String(err) };
  }
}

/** True only in local development, where links may be shown on screen when email is not configured. */
export function canShowDevLinks(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Minimal branded layout that renders in every mail client: one column, inline styles. */
export function layout(opts: { heading: string; body: string[]; action?: { label: string; url: string }; footer?: string }) {
  const paras = opts.body.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#4B586D">${esc(p)}</p>`).join("");
  const button = opts.action
    ? `<p style="margin:24px 0"><a href="${esc(opts.action.url)}" style="display:inline-block;background:#1B5CD6;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:6px">${esc(opts.action.label)}</a></p>
       <p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#8792A4">Or paste this link into your browser:<br><span style="color:#4B586D;word-break:break-all">${esc(opts.action.url)}</span></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#F3F5F7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F7;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<p style="margin:0 0 24px;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#0E1A2E">Lona</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#0E1A2E">${esc(opts.heading)}</h1>
${paras}${button}
${opts.footer ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #D5DBE3;font-size:12px;line-height:1.5;color:#8792A4">${esc(opts.footer)}</p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
  const text = [opts.heading, "", ...opts.body, ...(opts.action ? ["", `${opts.action.label}: ${opts.action.url}`] : []), ...(opts.footer ? ["", opts.footer] : [])].join("\n");
  return { html, text };
}
