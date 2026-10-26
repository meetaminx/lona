# Lona

Private cross-chain checkout. Customers pay from a shielded Zcash wallet; merchants receive USDC (or USDT) on Base, Arbitrum, Ethereum or Solana. Lona never holds funds: each payment is converted by NEAR Intents (1Click API) and sent straight to the merchant's wallet.

Read `DESIGN.md` before changing any UI.

## What's in the MVP

- Merchant accounts with test and live modes
- Invoices priced in USD, with hosted checkout, QR code and live status
- Reusable payment links (each visit opens its own invoice)
- Settlement preferences: payout asset, payout wallet, fallback Zcash refund address
- Payment confirmation through the swap network's status API
- Signed webhooks (`Lona-Signature`, HMAC-SHA256) with retries for about a day
- REST API with secret keys (`/api/v1/invoices`, `/api/v1/payment_links`)
- Test mode simulator, since the swap network has no testnet
- Landing page, API docs, privacy policy and terms
- Accounts: email confirmation, password reset, password change; live mode needs a confirmed email and a payout wallet
- Settings: business profile, support email, default return page, customer receipt emails
- Webhook tooling: private-network guard on save and on every delivery, send test event, roll secret, retry now
- API safety: `Idempotency-Key` on every POST, per-key rate limits with headers, list filters and cursor paging
- Invoices: search, status filters and CSV export for accounting

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # payment lifecycle, webhooks, signatures, network guard, tokens, receipts, idempotency, rate limits
```

No database setup is needed locally: an embedded Postgres (PGlite) is created in `.data/` and migrated on boot.

Try it: create an account, set a payout wallet under Settlement (any valid-looking address works in test mode), create an invoice, open checkout, click "Pay with Zcash", then "Pay in full".

## Deploy (Vercel + Neon)

1. Create a Neon database and set `DATABASE_URL`.
2. Set the variables in `.env.example`, at minimum `APP_URL`, `CRON_SECRET`, `ONECLICK_JWT`, `LONA_FEE_RECIPIENT`, `NEXT_PUBLIC_LEGAL_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`.
3. Deploy. `vercel.json` runs migrations before each build and calls `/api/cron/tick` every minute (per-minute crons need a paid Vercel plan; on Hobby, run the tick from an external scheduler with the `CRON_SECRET` bearer header).

## How a payment works

1. `POST /api/v1/invoices` creates an invoice in USD. No price yet.
2. The customer opens `/pay/:id` and clicks Pay. Lona asks 1Click for an `EXACT_OUTPUT` quote: the merchant receives exactly the invoice amount, and the customer's ZEC amount includes network costs and Lona's fee (`appFees`). The price is held for 20 minutes.
3. The customer sends ZEC to the quote's deposit address from their shielded balance.
4. Lona polls `/v0/status` (on page views and every minute from the scheduler) and moves the invoice through `awaiting_payment`, `payment_received`, `converting` and `paid_out`, emitting a webhook at each meaningful change. Status changes use compare-and-set, so each event fires once.

Code map: `src/lib/invoices.ts` (state machine), `src/lib/providers/` (1Click adapter and sandbox, behind one interface so a second route such as Maya Protocol can be added), `src/lib/webhooks.ts`, `src/app/api/`.

## Known limits, verify before going live

- **Do one real swap first.** There is no testnet. Send a small real payment through a live invoice and confirm the deposit, status flow and payout before onboarding merchants.
- **Zcash deposit addresses are transparent.** NEAR Intents documents Zcash support as transparent-only. A shielded wallet can pay it and the payer's wallet stays private, but the deposit amount is public. The landing page says so; keep it that way.
- **Refunds go to transparent addresses.** The merchant's fallback refund address, or one the customer enters at checkout.
- **Asset IDs** are resolved from 1Click's `/v0/tokens` at runtime, with known IDs as a fallback. Check the Solana USDC mapping against the live token list.
- **Email** needs `RESEND_API_KEY` and a verified sending domain in `MAIL_FROM`. Without it, confirmation, reset and receipt emails are only logged.
- **Rate limits and idempotency** are stored in Postgres, which is fine at launch volume; move them to Redis if traffic grows.
- **One conversion route.** Maya Protocol (which also supports shielded ZEC) can be added behind the same provider interface as a fallback.
- **Legal pages** are plain-language drafts. Have a lawyer review them, and get advice on whether your jurisdiction treats this as a regulated payment service.

## Launch checklist

- [ ] Custom domain connected and `APP_URL` set to it
- [x] Favicon (`src/app/icon.svg`)
- [x] No "Made with" badges
- [x] Privacy policy and terms pages (review with a lawyer)
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL` set to a real inbox
- [ ] `RESEND_API_KEY` and `MAIL_FROM` set, sending domain verified
- [ ] One real end-to-end payment completed
