# Lona design system (v2)

Lona is checkout for merchants who accept shielded Zcash and get paid in stablecoins. The visual language comes from security printing: guilloche line work, microprint and engraved seals, the craft that has made money look trustworthy for two centuries. v2 raises execution to the level of the best payments brands (see `AUDIT.md` for the research behind it): the product itself is the main illustration, and the guilloche is a structural system, not decoration.

Every agent or person building Lona UI reads this file first.

## 1. Principles

1. **The product is the illustration.** Marketing shows real Lona UI (the checkout panel, the dashboard form, the wallet send, the payout notice) composed into scenes. Abstract art supports; it never replaces the product.
2. **One signature: the seal.** Every invoice has a unique guilloche seal generated from its ID. At checkout a guilloche ring frames the QR and draws itself as the payment moves; when funds land the QR gives way to the invoice's seal. The same seal appears as a thumbnail on every invoice row.
3. **Say exactly what is private.** Customer wallet, balance and history: private. Deposit amount and the merchant payout: public. Copy and illustration never imply more.
4. **Merchant language.** "Payment received", "Paid out to your wallet". Chain detail one click away.
5. **Motion explains state and can be paused.** Self-playing scenes carry a visible pause control. Nothing animates on scroll, nothing follows the cursor.

## 2. Color

| Token | Light | Dark | Role |
|---|---|---|---|
| `--paper` | `#F3F5F7` | `#0B1220` | Page |
| `--paper-raised` | `#FFFFFF` | `#121B2C` | Panels, checkout card |
| `--paper-sunk` | `#E9EDF1` | `#080E19` | Stages behind product scenes, checkout summary pane |
| `--ink` | `#0E1A2E` | `#E8EDF4` | Text, line work |
| `--ink-soft` / `--ink-faint` | `#4B586D` / `#8792A4` | `#A0ACBF` / `#6C7A90` | Secondary / tertiary text |
| `--rule` / `--rule-strong` | `#D5DBE3` / `#B8C1CD` | `#233049` / `#34435F` | Borders |
| `--amber` (`--amber-ink` for text) | `#D69214` (`#8A5D08`) | `#E8AB3C` | The customer's ZEC side |
| `--blue` | `#1B5CD6` | `#6B9CF0` | The merchant's USDC side, primary actions |
| `--green` / `--red` | `#22744A` / `#B8392C` | `#67C493` / `#E4806F` | Paid out / failed states only |
| `--night` | `#0A1322` | `#060B15` | Always-dark sections (observer, closing) |
| `--chart-bar` | `#1B5CD6` | `#5A8DE8` | Payout chart (validated for both surfaces) |

Rhythm: light sections alternate with `.night` sections, which redefine the tokens locally so every component works inside them unchanged.

Never: purple, decorative gradients, pure black.

## 3. Type

One family, **Archivo** (variable, weight 100 to 900, width 62% to 125%). Width is the display device: expanded lettering echoes the denomination lettering on notes and cheques; normal width carries text.

| Role | Width | Weight | Size | Tracking |
|---|---|---|---|---|
| `.display` (hero) | 106 to 125% | 640 | up to 4 to 5.1rem | -0.025 to -0.03em |
| `.h1` | 118% | 620 | up to 3.1rem | -0.02em |
| `.h2` | 112% | 600 | 1.6rem | -0.012em |
| `.h3` | 100% | 600 | 1.08rem | -0.005em |
| Body | 100% | 400 | 1rem / 1.55 | 0 |
| Logo wordmark | 125% | 700 | 1.35rem | -0.03em |

Headline amounts use `<Amount>`: superscript cents in the soft ink, currency as a small suffix. Proportional figures (Archivo's tabular figures add uneven gaps around punctuation). Code uses the system monospace stack, only for code.

Sentence case. No all-caps labels or tracked eyebrows (microprint is illustration, not a label). No single highlighted word in a headline.

## 4. Shape, depth, space

- Radius by hierarchy: controls 6px, panels 12px, frames and scenes 16px, chips 4px. Never pill-shaped.
- Shadows: `--shadow-1` (resting card), `--shadow-float` (cards inside scenes), `--shadow-stage` (the hero checkout, checkout page, code panel).
- Structural column rules (`.grid-lines`) run behind hero and night sections at one sixth of the max width, faded at the ends.
- Max width 1200px. Section padding 120px (80px mobile).

## 5. Illustration system

All generated in code from `src/lib/guilloche.ts`. No stock images, AI images, emoji, icon fonts or third-party logos.

| Piece | Function | Used for |
|---|---|---|
| Seal | `sealRings(id)` four hypotrochoid rings | Invoice identity: checkout centre when paid, row thumbnails, detail page |
| Guilloche ring | `guillocheRing()` twelve interlaced wavy circles | The frame around the checkout QR, drawn in stages |
| Microprint | `circlePath()` + SVG `textPath` fitted with `textLength` | Ring of tiny repeated lettering around the frame |
| Medallion | `medallion(key)` two small rosettes | Identity for merchants and networks instead of logos |
| Wave band | `waveBand()` | The swap network in the route animation |
| Ghost rosette | `rosette()` at large scale, faint | Hero background |

Product vignettes live in `src/components/scenes/`: wallet phone, payout card, webhook card, invoice composer, route, observer, feature cards, code tabs.

## 6. Motion

| Moment | Behaviour | Timing |
|---|---|---|
| Hero scene | Self-playing 13s loop: wallet sends, frame draws (amber), received, converting, payout card arrives, seal completes (blue). Pause control. Reduced motion shows the final frame. | Ring lines 1100ms each, staggered 140ms |
| Walkthrough | Four steps auto-advance every 5.2s with a progress bar; click to jump; pause control | Scene swap 420ms |
| Checkout frame | Draws from empty on load; three more lines per stage; seal draws in on payout, then turns once a minute | 1100 to 1400ms, `--ease-out` |
| Route | ZEC enters the band, vanishes, USDC leaves | 3.6s loop |
| UI changes | Payout card drop-in, flow bars, FAQ chevron, chip colour | 160 to 520ms |

Easing: `--ease-out: cubic-bezier(.16,1,.3,1)`. Durations: `--t-fast` 160ms, `--t-base` 280ms, `--t-slow` 640ms. No scroll-triggered entrances, no hover lifts, no cursor effects. `prefers-reduced-motion` respected everywhere.

## 7. Components

- **Buttons**: primary (blue), secondary (ink border), quiet, danger; 40px or 48px; labels state the action. No arrows in labels.
- **PayPanel** (`components/pay-panel.tsx`): the payment state machine view, shared by the real checkout and the hero scene.
- **SealFrame**: ring + microprint + QR or seal.
- **Status chip**: 4px radius, wash fill, dot. Open, Awaiting payment, Payment received, Converting, Paid out, Expired, Underpaid, Refunded, Failed, Canceled.
- **Checkout card**: summary pane (merchant medallion, amount, route of three dots) and pay pane side by side; stacked on mobile with an "Open in Zcash wallet" link.
- **Payout chart**: one series, rounded bar tops, 2px gaps, tooltip on hover and focus, hidden table for screen readers.
- **Timeline**: invoice detail history with real timestamps from events.

## 8. Copy

Plain verbs, sentence case, no em dashes, no filler. No invented metrics, reviews, customer counts or logos. Example data in scenes uses a fictional merchant (Kiln Coffee). Disclose near the top that Lona is software, not a bank or exchange, and who performs conversions.

## 9. Do not

Purple, decorative gradients, pill buttons, emoji, glows, glassmorphism (the header's backdrop blur is the one exception), stock or AI imagery, fake social proof, vague hero lines, scroll animations, cursor effects, "Made with" badges, monospace outside code, all-caps eyebrows, arrows in buttons, other companies' logos.
