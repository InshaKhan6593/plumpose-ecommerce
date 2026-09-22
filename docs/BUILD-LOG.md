# plumpose — Build Log

**Project:** [`plumpose/`](../plumpose) — Next.js + Payload CMS store
**Phase reached:** Data model, admin panel and commerce engine. A purchase runs end to end against the Stripe sandbox. Storefront not started; SkipCash pending credentials.
**Last updated:** 22 Sep 2026

This is the running record of what has actually been built, tested and
verified. The requirements and scope document is kept outside this repository.

---

## 1. Current state at a glance

| | |
|---|---|
| Commits | 9 |
| Source files written | 249 |
| Collections | 18 (13 visible to the client, 5 hidden) |
| Type errors | **0** |
| Admin config audit | **No problems** |
| Integration tests | **81 passing** |
| End-to-end tests | **22 passing** |
| Storefront | **Not started** |
| Payments | Stripe sandbox working end to end; SkipCash blocked on credentials |

Running locally at `http://localhost:3000/admin`.

---

## 2. Stack as built

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3.3 (App Router), React 19.2.6 |
| CMS / backend | Payload **3.90.1**, installed into the same app |
| Database | PostgreSQL 16 in Docker (`plumpose-pg`, port **5433**) |
| Commerce | `@payloadcms/plugin-ecommerce` |
| Also | `plugin-form-builder`, `plugin-seo` |
| Styling | TailwindCSS 4 + shadcn/ui |
| Language | TypeScript 6 throughout |
| Images | `sharp`, 7 responsive sizes per upload |
| Currency | **QAR** base, stored in minor units |

### Two things that cost time, recorded so they are not repeated

**Build from the release tag, not `main`.** The `main` branch template imports
APIs that are not in the published packages and fails to compile
(`TableFeature was not found in @payloadcms/richtext-lexical`). Check out tag
`v3.90.1` and pin every `@payloadcms/*` dependency to match. The monorepo
templates also use `workspace:*` versions that must be rewritten to a concrete
version when cloning directly.

**The template ships MongoDB.** Swapped to `@payloadcms/db-postgres` before any
data existed. Doing this later means migrating.

---

## 3. Data model

### Client-managed content
`Projects` (Made for You) · `FAQs` · `Press` · `Spotted` · `Reviews` · `Subscribers`

### Shop configuration, ported out of the old hardcoded `.mjs` files
| Collection | Ported from |
|---|---|
| `PersonalisationOptions` | `netlify/lib/personalisation.mjs` |
| `ShippingZones`, `ShippingCities` | `netlify/lib/shipping.mjs` |
| `Countries` | `netlify/lib/countries.mjs` |
| `Currencies` | `netlify/lib/pricing.mjs` |
| `DiscountCodes`, `SpinSegments` | new |
| `SiteSettings` (global) | new — contact email, WhatsApp, free-shipping threshold, personalisation fee |

### From the ecommerce plugin
`Products` · `Variants` · `VariantTypes` · `VariantOptions` · `Orders` · `Transactions` · `Carts` · `Addresses`

---

## 4. Seeded data — the client's real content

`pnpm seed` — idempotent, safe to re-run.

```
Product     Al Shaheen Nights — Silk Pyjama Set   QAR 1,399.00   published
Variants    S (4 in stock) · M (6) · L (4)
Media       7 photographs → 42 files after responsive resizing
Countries   204, of which 22 carry a blocked reason
Currencies  163
Shipping    11 Qatar cities (Doha 20 / outside 50) · 10 zones (UAE 150 → world 300)
Personalisation  16 — 4 placements, 3 styles, 4 symbols, 5 thread colours
Reward wheel     4 segments — 10% off · QAR 100 · free delivery · roll again
FAQs        6, written from her own returns and care copy
```

The product photography was **extracted from the base64 embedded in her old
`index.html`** (`seed-assets/`), so the admin demo shows her real product rather
than placeholders.

---

## 5. Admin panel

### Sidebar as the client sees it

```
EVERYDAY        Products · Orders · Site settings
SHOP            Discount codes · Reward wheel · Sizes & stock · Products · Orders
CONTENT         Made for You · FAQs · Press · Spotted · Reviews · Subscribers
                Pages · Collections · Media · Enquiries
SHOP SETTINGS   Personalisation · Shipping zones · Qatar delivery
                Countries · Currencies · Sizes & colours
USERS           Users
```

**Hidden** (still work, still reachable by URL, just not in the nav):
`Carts` · `Transactions` · `Forms` · `Variant types` · `Addresses`

The "Everyday" block exists because Payload orders each group by config array
order and the plugin appends its collections after ours — which buried Products
and Orders below the discount codes. Pinning them via `beforeNavLinks` was
simpler than fighting that ordering.

### Branding
Fraunces + Jost, her `#f6f4f0` / `#1b1815` palette, squared corners, warmed
neutral ramp, letterspaced uppercase labels, UK date format, light theme only.

> The admin never loaded the fonts at first: the `(payload)` layout is generated
> by Payload and carries a "do not modify" header, so the `next/font` setup in
> the storefront layout never reached it. They are imported in `custom.scss`,
> which survives regeneration.

### Custom cells
| Cell | Fixes |
|---|---|
| `PriceCell` | Money is in minor units, so prices rendered as `139900`. Now `QAR 1,399.00` |
| `SwatchCell` | Thread colours rendered as `#BD9540`. Now a colour swatch |
| `BooleanCell` | Checkboxes rendered the literal string `true`. Now a tick or dash |

### Behaviour
- `orderable: true` on 8 collections — drag rows instead of typing sort numbers
- `trash: true` on Projects, Press, Spotted, Reviews, FAQs — soft delete
- `defaultSort` — logs newest-first, reference tables alphabetically
- Custom dashboard: orders today, revenue, fulfilment queue, low stock, pending approvals

### Plain English
The client is not technical, so developer vocabulary was removed:

| Before | Now |
|---|---|
| Slug | Web address |
| Content / Product Details / SEO tabs | Description & photos / Price & sizes / Google & sharing |
| Gallery → Gallery 01 | Photos → Photo 01 |
| Variant option | Only show for |
| Layout | Extra page sections |
| Categories | Collections |
| Enable variants | This piece comes in different sizes |
| Variant types | Options offered |
| Related products | You may also like |
| Variants | Sizes & stock |

`src/fields/autoKey.ts` derives machine identifiers from the name and hides
them — she types "Al Khor & Al Dhakhira", the key writes itself. It generates
**only on create**, because renaming a zone must not silently change the
identifier that seeded data and lookups depend on.

---

## 6. Security decisions

| Decision | Reason |
|---|---|
| `discountCodes` admin-only read | A public list of valid codes would hand them to anyone who asked. **Verified: 403** |
| `spinSegments.weight` restricted at field level | The wheel's odds must never reach the browser. **Verified hidden** |
| Order `amount`, `currency`, `status`, `transactions` locked | The gateway is the source of truth; a hand-edited total silently breaks reconciliation against SkipCash |
| Order deletion disabled | Financial records are archived, not deleted |
| `subscribers` admin-only read | It is a list of customer email addresses. **Verified: 403** |
| Blocked countries read-only | Sanctions and carrier suspensions — not a checkbox to tick by accident |
| Published/approved filters on public read | Drafts and unmoderated UGC never leak |

---

## 7. Bugs found and fixed

### Mine
- **Fraunces given both `axes` and `weight`** — Next rejects the combination and it 500'd *every* route. The admin still looked fine, so it was easy to miss.
- **`--base-body-size` override broke Payload's line-height maths** — produced `line-height: 207px` and a 200px-tall login button.
- **`priceFieldOverride` does not exist** — guessed a plugin option; applied the Cell by mapping product fields instead.
- **Variant overrides nest under `products`**, not at the top level.
- **Screenshot automation created a stray empty draft product**, found while gathering stats for this document and deleted.

### Inherited from the template
- **`sharp` was never passed into the config**, silently disabling all image resizing.
- **`generatePreviewPath` imported from `(frontend)`** when the route group is `(app)`, and mapped a `posts` collection that does not exist — live preview was broken.
- **Every storefront component hardcoded `priceInUSD`** — 12 files updated.
- **Cart and checkout callbacks had lost their contextual type** and were silently `any`.
- **A live `/next/seed` route** that downloads t-shirt images from GitHub and fills the store with samples. Route and button both removed.
- **The currency symbol ran through the price.** The plugin positions it at `left: 10px` and pads the input 22.75px — fine for `$`, but `QAR` is 28px wide, giving `QA|399.00`. Measured and padded to 48px.

---

## 8. Tooling added

| Command | Purpose |
|---|---|
| `pnpm seed` | Seed the client's real data. Idempotent |
| `pnpm audit:admin` | Boot Payload and print every collection's resolved admin config, flagging missing groups, missing `useAsTitle`, absent columns and columns pointing at fields that do not exist |
| `pnpm shoot:admin` | Log in as the dev fixture and screenshot all 16 admin screens |
| `npx tsx scripts/shoot-one.ts <url> [tab] [name]` | Screenshot one screen, optionally after clicking a tab |
| `npx tsx scripts/inspect-one.ts <url> [tab]` | Dump computed styles for a selector — measure a layout bug instead of guessing |
| `node scripts/extract-legacy-tables.mjs` | Re-extract countries and currencies from the old site |

> From Git Bash, prefix commands taking a leading-slash argument with
> `MSYS_NO_PATHCONV=1`, or the path is rewritten into a Windows path.

The audit found **12 problems** on first run and now reports none.

---

## 9. What has NOT been done

### Not tested
- **The storefront has never been rendered.** Not once.
- Cart, checkout and variant selection are untested.
- The Playwright e2e suite has not been run.
- No admin screen has been exercised by a human — only screenshotted.

### Logic that does not exist yet
Data is in place for all of these; none of them compute anything:

- **Shipping calculation** — zones and cities are rows; nothing prices an address
- **Free-shipping threshold** — the field exists, nothing reads it
- **Discount validation engine**
- **Spin wheel** — no weighted pick, no code issuance, no one-per-visitor
- **Blocked-country enforcement** — 22 countries flagged, no check at checkout
- **Currency display** — `rate` is empty; only hand-set prices work
- **Reviews aggregate rating**
- **Gift option** — modelled on orders, not wired into checkout
- **Contact form** — plugin installed, no form configured
- **GA4 and Search Console**

### Known remaining jargon
`AVAILABLE VARIANTS` and its `VARIANT OPTIONS` column are rendered by the
plugin's own component, not a field label. Changing them needs a custom
component or a translation override.

---

## 10. Blocking dependency

**SkipCash sandbox credentials.** `SKIPCASH_CLIENT_ID`, `SKIPCASH_KEY_ID`,
`SKIPCASH_KEY_SECRET`, `SKIPCASH_WEBHOOK_KEY`, plus confirmation of which
environment the live site currently points at. The `.env` slots are waiting and
`payments.paymentMethods` is an empty array with a TODO describing the adapter
mapping.

This has lead time — the client may need to request them from SkipCash. It is
the single most likely cause of a schedule slip.

---

## 11. Local development

```bash
docker start plumpose-pg     # Postgres on 5433
pnpm dev                     # http://localhost:3000
pnpm seed                    # idempotent
```

A development-only admin fixture is seeded (`dev@plumpose.local`) so the
screenshot tooling can log in. It is skipped entirely when `NODE_ENV` is
production.

**Requires Node 24.15+** — the template's `engines` field says so. It runs on
Node 22 with a warning, but the dev machine should be upgraded.

---

## 12. Next

1. Shipping calculation and the free-shipping threshold
2. Discount validation engine
3. Spin wheel — weighted pick, code issuance, one-per-visitor
4. Storefront: shop grid, product page, cart — against real data
5. SkipCash adapter *(blocked)*
6. A genuine end-to-end test pass, including Playwright

---

## 13. Payments — Stripe sandbox as a temporary harness

**Stripe is wired in development only. It is not the gateway, and it is not a
rehearsal of one.**

SkipCash credentials have external lead time (§10), and everything downstream
of "a payment succeeded" is provider-agnostic: order creation, stock decrement,
discount consumption, the confirmation email, the status lifecycle. Stripe
unblocks that work instead of leaving it waiting.

### Switching it on

```bash
PAYMENT_PROVIDER=stripe        # anything else, or empty, disables it
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOKS_SIGNING_SECRET=whsec_...
```

`isStripeSandboxEnabled()` also refuses when `NODE_ENV` is production, so a
stray environment variable cannot put a sandbox gateway in front of a customer.
Verified across all four combinations.

**Webhooks cannot reach localhost.** Forward them with the Stripe CLI:

```bash
stripe login
pnpm stripe-webhooks      # prints a fresh whsec_ each run
```

The same constraint applies to SkipCash later, except the CLI does not exist
there — §7.2 says to test its webhook against a deploy preview, not locally.

### The trap this avoids

The plugin's stock Stripe adapter reads:

```js
const amount = cart.subtotal      // adapters/stripe/initiatePayment.js
```

`cart.subtotal` is goods only. Charging it would take **QAR 1,399** for a bag
that costs **QAR 1,579** once delivery and embroidery are counted — an
undercharge invisible until reconciliation. `src/payments/stripeSandbox.ts`
overrides `initiatePayment` so the amount comes from `priceOrder()`.

**The SkipCash adapter must do the same.** Any adapter that trusts
`cart.subtotal` undercharges.

### What it does and does not prove

| Proves | Does not prove |
|---|---|
| Order creation from a cart | The HMAC signature and its fixed field order (§7.2 — the most brittle part) |
| Stock decrement (the plugin does this: `inventory: { $inc: -qty }`) | SkipCash status codes (`2` = Paid) |
| Discount consumption and the `discountUses` ledger | The webhook payload shape and `webhookLog` |
| Status lifecycle and failed attempts | The redirect return journey |
| Confirmation email firing | QAR settlement at a Qatari gateway |

### The flow shapes differ — build for SkipCash

| | Stripe | SkipCash |
|---|---|---|
| `initiatePayment` returns | `clientSecret` | `payUrl` |
| Customer pays | on our page, in Stripe Elements | on SkipCash's page, after a redirect |
| Returns via | client-side confirmation | redirect + webhook |

**Build the checkout as a redirect flow regardless.** An inline card form built
around Stripe Elements is thrown away the day SkipCash arrives.

### Webhook behaviour, verified end to end

With the Stripe CLI forwarding (`pnpm stripe-webhooks`), three cases were
tested against the live endpoint:

| Request | Result |
|---|---|
| No `stripe-signature` header | **200**, event ignored — no handler runs |
| Invalid signature | **400**, rejected |
| Genuine Stripe event | **200**, signature verifies |

The first row is worth understanding rather than panicking about. The plugin
wraps verification in `if (stripeSignature)`, so an unsigned request skips the
whole block and falls through to the default `200 {received:true}`. It is
**not** an authentication bypass — `event` stays undefined, so no handler is
reached and nothing is marked paid — but it is a fail-open *shape*: a prober
gets "received" for a forged payload.

**The SkipCash adapter must not copy this.** P4 makes the webhook the source of
truth, and the legacy `skipcash-webhook.mjs` already does the right thing —
HMAC-SHA256 over a fixed field order with `timingSafeEqual`, rejecting outright
when it fails. Keep that, and log every callback to `webhookLog` including the
failures: a run of `signatureValid: false` is what a forgery attempt looks like.

### Still missing: no event handlers are registered

`stripeAdapter()` is called without a `webhooks` map, so even a correctly
signed event does nothing:

```js
if (typeof webhooks === 'object' && event) { ... }   // webhooks is undefined
```

Confirmation currently depends entirely on the client calling
`/payments/stripe/confirm-order`. Wiring `payment_intent.succeeded` to the
order lifecycle is part of the order-creation work, not done yet.

### Stripe sandbox account, confirmed working

`acct_1T4eerLZgN3GGjME` (US, default USD). **QAR is accepted** — a
QAR 1,579.00 PaymentIntent was created and cancelled successfully, so the
QAR-only `currenciesConfig` does not fight the adapter. This was the open
question when Stripe was proposed; Stripe accounts cannot be *based* in Qatar,
but a non-Qatari test account can charge in it.

### Order creation, working end to end

A full purchase now runs: bag → priced → paid → order. Five e2e tests drive it
against the Stripe sandbox with a real test card (`tests/e2e/checkout.e2e.spec.ts`).

What the order carries afterwards: `amount` plus the full breakdown
(`subtotalQar`, `personalisationTotalQar`, `shippingQar`, `discountTotalQar`,
`shippingLabel`, `shippingZone`), the embroidery instructions on each line, and
a `discountUses` ledger row. Stock decrements by the quantity ordered — the
plugin does that part itself via `inventory: { $inc: -qty }`.

**Four seam bugs the end-to-end test found**, none of which unit tests could:

1. **The adapter receives a trimmed cart.** The plugin loads it with
   `select: { id, currency, customerEmail, items, subtotal }`, so
   `shippingCityKey` and `discountCode` were missing — every Qatar address was
   refused with "Please choose a delivery city" and every discount ignored. The
   adapter re-reads the cart in full.
2. **Custom item fields break settlement validation.** Cart items go into
   Stripe metadata with `...customProperties`, so `personalisation` went with
   them — but the transactions collection has no such field, so it was dropped
   on the way into the database. `validateSettlement` compares the two and
   threw "Stripe cart items do not match the transaction items" on every
   confirmation. Personalisation is now stripped before delegating and read
   back from the cart instead.
3. **The order carried raw cart personalisation.** `placement: "pocket"` with
   `placementName: null` and no fee — the atelier would get a placement with no
   name and nothing to reconcile. The snapshot now carries the engine's own
   priced lines, with resolved names and the fee charged.
4. **A write without `req` cannot see uncommitted rows.** `redeemDiscount` used
   `payload.create` with no `req`, so it ran outside the endpoint's transaction
   and failed with
   `violates foreign key constraint discount_uses_order_id_orders_id_fk` — the
   order it referenced had not committed yet. **Any write inside an endpoint
   must thread `req` through.**

### A note on cleaning up test data

A discount code that was actually redeemed cannot be deleted: `discountUses`
references it and that ledger is undeletable by design, being a financial
record. E2E cleanup is therefore best-effort, and prefixes (`E2EONLY-`,
`E2EPAID-`, `TESTONLY-`) are what mark leftovers as disposable.

### Carried on the cart

Two fields were added to `carts` because the pricing engine needs what an
address cannot supply: `shippingCityKey` (the address `city` is free text, the
rate table is keyed) and `discountCode`. Both are re-validated server-side at
payment; neither is trusted from the bag.
