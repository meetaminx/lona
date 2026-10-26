# Lona design system

Lona is a checkout for merchants who want to accept shielded Zcash and get paid in stablecoins. The design borrows from the one industry that has spent two centuries making money look trustworthy and hard to copy: security printing. Banknotes, cheques and share certificates use guilloche (fine interlaced line patterns), intaglio ink and serial numbers. Lona uses the same vocabulary, drawn in code, to say "this payment is sealed".

Every agent or person building Lona UI reads this file first.

## 1. Principles

1. **Security print, not crypto neon.** No glows, no gradients used as decoration, no glassmorphism, no 3D coins. Line work, paper and ink.
2. **One memorable thing: the seal.** Every invoice has its own guilloche seal, generated from its ID. It draws itself as the payment progresses and is complete when funds settle. Everything around it stays quiet.
3. **Say what is private and what is not.** The customer's wallet and history are shielded. The deposit amount and the merchant's settlement are public. Copy never claims more privacy than the system gives.
4. **Merchant language, not chain language.** "Payment received", "Paid out to your wallet", not "intent executed" or "solver filled". Chain detail lives one click away for those who want it.
5. **Motion explains state.** Animation only shows something changing: a payment moving, a seal completing, a panel opening. One orchestrated sequence per page at most.

## 2. Color

Inks on security paper. Two accent inks map to the two sides of every payment: amber for the customer paying in ZEC, blue for the merchant settling in USDC.

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#EDF0F2` | Page background. Cool, slightly blue-grey, like cheque stock. |
| `--paper-raised` | `#F7F8F9` | Panels, inputs, the checkout ticket. |
| `--ink` | `#16223A` | Primary text and line work. Intaglio navy, not black. |
| `--ink-soft` | `#4A5871` | Secondary text. |
| `--rule` | `#C7CFD8` | Borders, dividers, table rules. |
| `--amber` | `#C98A12` | ZEC side: customer, pay, deposit. Text-safe on paper. |
| `--amber-wash` | `#F3E4C2` | Amber fills behind text. |
| `--blue` | `#1F5FAE` | USDC side: merchant, settle, payout. Also links and primary actions. |
| `--blue-wash` | `#D7E3F2` | Blue fills behind text. |
| `--red` | `#B23A2E` | Errors, failed and refunded states only. |
| `--green` | `#2F7A4F` | Settled state only. |

Dark mode swaps paper and ink: `--paper #0F1626`, `--paper-raised #172034`, `--ink #E6EAF0`, `--ink-soft #A3AEC0`, `--rule #2B3650`, amber `#E2A93A`, blue `#6FA2E6`.

Never: purple, gradients as decoration, pure black `#000`, neon green.

## 3. Type

| Role | Family | Use |
|---|---|---|
| Display | **Gloock** (high-contrast engraved serif) | Page titles, hero, amounts on the checkout ticket, the receipt total. |
| Text and UI | **Schibsted Grotesk** | Everything else: body, labels, buttons, tables. |

Use proportional lining figures. Schibsted Grotesk's tabular figures space out commas, colons and points, so `tabular-nums` is not used. Addresses and hashes use Schibsted Grotesk with `letter-spacing: 0.02em` and middle truncation (`t1Ab4...9xQe`), not a monospace face.

Scale (rem, 1rem = 16px), ratio about 1.25:

| Step | Size | Line height | Family |
|---|---|---|---|
| `display` | 4.25 | 1.02 | Gloock |
| `h1` | 2.75 | 1.08 | Gloock |
| `h2` | 1.75 | 1.2 | Gloock |
| `h3` | 1.125 | 1.35 | Schibsted 600 |
| `body` | 1 | 1.55 | Schibsted 400 |
| `small` | 0.875 | 1.45 | Schibsted 400 |
| `micro` | 0.75 | 1.4 | Schibsted 500 |

Rules: sentence case everywhere. No all-caps labels, no tracked-out eyebrows above headings, no single highlighted word in a headline. Body lines stay under 72 characters.

## 4. Shape and space

- Spacing unit 4px. Common steps: 8, 12, 16, 24, 32, 48, 72, 120.
- Radius by hierarchy, never one radius for everything:
  - inputs and buttons: 6px (rectangular, never pill-shaped)
  - panels and the checkout ticket: 10px
  - status chips: 4px
- Borders do the separating. Shadows only on things that float (menus, the checkout ticket on mobile): `0 1px 0 var(--rule), 0 12px 32px -18px rgba(22,34,58,.35)`.
- Max content width 1120px. Dashboard uses a 232px left rail.

## 5. Illustration

All illustration is generated line art in SVG. No stock photos, no AI images, no emoji, no icon fonts.

- **Guilloche rosette**: hypotrochoid curves, 1px ink strokes, 0.6 to 0.9 opacity. Used for the invoice seal and the logo mark.
- **Guilloche band**: stacked phase-shifted sine waves. Used as the "shielded" zone in the hero and as dividers between major sections.
- **Seal**: rosette parameters (lobes, inner radius, pen offset, rotation) derived from a hash of the invoice ID, so no two invoices share a seal. Amber while waiting for the customer, blue once paid out.
- Icons: 20px, 1.5px stroke, drawn in the same line style, square line caps.

## 6. Motion

| Moment | What moves | Duration | Easing |
|---|---|---|---|
| Hero, once on load | Band lines draw in, a payment note crosses the band (amber in, blue out), the receipt appears | 3.2s total | `cubic-bezier(.2,.7,.2,1)` |
| Checkout seal | Rings of the seal draw as status advances: waiting (1 ring), received (2), converting (3), paid out (all rings, then a slow 40s rotation) | 900ms per stage | same |
| Status change | Chip color crossfade | 200ms | ease-out |
| Panels and menus | Opacity and 4px translate | 160ms | ease-out |

No scroll-triggered entrances, no hover lifts on cards, no cursor effects, no parallax. `prefers-reduced-motion: reduce` shows final states with no movement.

## 7. Components

- **Button primary**: blue fill, paper text, 6px radius, 40px tall, label says the exact action ("Create invoice", "Copy address"). No arrows in labels.
- **Button secondary**: transparent, 1px ink border.
- **Status chip**: 4px radius, wash background, ink text, a 6px dot. Names: Open, Awaiting payment, Payment received, Converting, Paid out, Expired, Underpaid, Refunded, Failed.
- **Checkout ticket**: the hosted payment page is a single ticket. Top: merchant name and description. Middle: ZEC amount in Gloock, QR, deposit address with copy. Bottom: the seal and a plain-language status line. Perforation line (dashed rule with half-circle notches) separates the stub.
- **Tables**: rule lines between rows, no zebra striping, amounts right-aligned with tabular numbers.
- **Code blocks**: `--paper-raised` background, 1px rule border, Schibsted Grotesk is not used here; code uses the system monospace stack because it is code.

## 8. Copy

- Plain verbs, sentence case, no filler, no em dashes.
- Name things by what the merchant does: "Get paid", "Payout wallet", "Notifications to your server".
- No invented numbers. No fake reviews, customer counts, logos or testimonials. Empty states invite the first action.
- Errors say what happened and what to do: "That address is not a Base address. Base addresses start with 0x and are 42 characters long."

## 9. Do not

Purple or gradient washes, pill buttons, emoji, glow effects, glassmorphism, stock or AI photos, fake social proof, vague hero lines ("The future of payments"), scroll animations, cursor trails, "Made with" badges, monospace used as decoration, all-caps eyebrows, arrows appended to buttons.
