# Lona UI audit, v1 against top-tier product sites

Reviewed on 26 October 2026. References studied live: arbitrum.io, stripe.com, mercury.com, phantom.com, plus Arbitrum's published design tokens and a Mercury design breakdown. Severity: **P0** stops it reading as a top-tier product, **P1** clearly below the bar, **P2** polish.

## What the best sites do that v1 does not

| Pattern | Who does it | What it means for Lona |
|---|---|---|
| **The product is the illustration.** Every section shows real, detailed UI (a checkout in a browser frame, a card terminal, a usage meter) that animates inside its frame. | Stripe, Mercury | v1 shows no product at all on the landing page. A merchant cannot see what their customer will see. |
| **A self-playing walkthrough with a pause control.** A pinned section where a list of features drives a product demo that clicks through itself. | Mercury | v1 explains the flow with four static seals. The flow is Lona's whole story and should be shown moving. |
| **One brand shape used as a system.** Arbitrum's hexagon is the nav bullet, the ecosystem node, the connector. Visible column grid lines run through every section. | Arbitrum | v1's guilloche art is good but decorative. It appears in two places and does not structure anything. |
| **Real data, no invented numbers.** A live counter in Stripe's hero; balances with superscript cents. | Stripe, Mercury | v1 has no live element. Lona can show the live ZEC price from the swap network, which is real and useful. |
| **Rhythm through contrast.** Light marketing, then a dark cinematic product section, then light again. | Mercury, Stripe | Every v1 section is the same paper colour with the same heading-then-content layout. It reads flat after the hero. |
| **Plain disclosure near the top.** "Not a bank", risk notices, who provides the service. | Mercury, Phantom | v1 is honest about privacy but says nothing near the top about who moves the money. |

## Landing page

- **P0 · No product in the hero.** The hero art is abstract. Replace with a composed, self-playing scene: the real checkout moving from price to paid, the customer's wallet sending, and the merchant's payout notification arriving. Include a pause control.
- **P0 · Display type lacks authority.** Gloock is elegant but reads editorial, not infrastructure. Top payments brands use engineered sans display (Arbitrum's condensed caps, Stripe's Söhne). Move to Archivo, using its width axis: expanded for display (it echoes the lettering on banknotes and bank cheques) and normal for text. One family, real contrast.
- **P0 · Flow section is static.** Replace the four seal cards with a self-advancing walkthrough: steps on the left with progress bars, a product vignette on the right for each step (invoice form, wallet send, conversion route, payout and webhook). Steps can be clicked and the sequence paused. It advances on a timer, not on scroll, to keep the no-scroll-animation rule.
- **P1 · Privacy section is a list.** It is the most important trust content and the least visual. Make it a dark section that shows exactly what a chain observer sees on Zcash (shielded: hidden) versus the deposit address and the payout chain (visible), drawn as explorer rows.
- **P1 · No live data.** Add the live ZEC price from the swap network's token list, labelled with its source and time, hidden if unavailable.
- **P1 · Feature coverage is thin.** Payment links, QR, webhooks, test mode and settlement choice each deserve a vignette. Use a grid of product cards, each with a small real UI moment.
- **P1 · Chains shown as a table.** Give each settlement network its own generated medallion instead of a plain table row, and never use other companies' logos.
- **P1 · No FAQ.** Merchants will ask about custody, refunds, volatility and supported wallets. Add an FAQ.
- **P2 · Header is static.** Make it sticky with a translucent backdrop once the page scrolls.
- **P2 · Footer is minimal.** Add product, developer and company columns, plus the service disclosure.
- **P2 · Code sample is hand-tokenised and clips.** Build a proper code panel with language tabs.

## Illustration and motion

- **P0 · The illustration system is two pieces.** Extend it into a family: seal rosettes, microprint text rings (the tiny repeated lettering on banknotes), guilloche bands, chain medallions and a fine background grid. All generated, all from one set of functions.
- **P1 · Motion is a single hero loop.** Define a motion system: one easing family, three durations, staggered entrance for product scenes, state transitions that show what changed. Keep the restraint rules: no scroll-jacking, no cursor effects.
- **P1 · Seal is pale at small sizes.** The unfilled rings overpower the drawn ones. Raise contrast of drawn rings and lower the guide rings.

## Checkout

- **P0 · The seal is beside the payment, not part of it.** Make it the frame: the seal surrounds the QR code and draws itself as the payment moves. This becomes the signature moment of the product.
- **P1 · No wallet hand-off on mobile.** Add "Open in wallet" with the `zcash:` link, which is how most mobile customers will pay.
- **P1 · Countdown is text only.** Add a thin progress bar for the price hold.
- **P1 · Single column on desktop.** Use an order summary pane and a payment pane side by side on wide screens.
- **P2 · Paid state has no receipt.** Show a receipt block with amount, network, time and transaction references.

## Dashboard

- **P0 · No visual of money over time.** Add a payouts chart for the last 30 days from real invoice data.
- **P1 · Rows have no identity.** Show each invoice's seal as a small thumbnail in tables; it makes invoices recognisable at a glance and carries the brand into the product.
- **P1 · Invoice detail is a key-value dump.** Lead with a timeline of what happened and when, then details.
- **P1 · Amounts lack typographic care.** Use superscript cents for headline amounts.
- **P2 · Mode switch and rail need polish:** clearer live state, account block, consistent icon weight.

## Docs

- **P2 ·** Add a code panel component with copy buttons, and an endpoint badge style for methods.

## Carried-over constraints (unchanged)

No purple, no gradients as decoration, no pill buttons, no emoji, no fake metrics or logos, no em dashes, no scroll-triggered entrance animations, respect reduced motion.

## Status after the v2 rebuild

Done: every P0 and P1 item above. Product-led hero scene with pause, Archivo type system, timed walkthrough, night observer section, live ZEC price (hidden when the network is unreachable), feature vignettes, network medallions, FAQ, sticky header, full footer with disclosure, code tabs, illustration family (seal, guilloche ring, microprint, medallions, bands, grid lines), motion system, seal-framed QR checkout with wallet hand-off, hold bar and receipt, two-pane checkout, payouts chart, seal thumbnails, invoice timeline, superscript amounts.

The two P2 items (docs code panels with copy buttons, dashboard rail polish) were completed in the following build, along with settings, account security, webhook tooling, API safety, invoice search and export, and customer receipts.
