# plumpose — Build Log

**Project:** [`plumpose/`](../plumpose) — Next.js + Payload CMS store
**Phase reached:** Backend, email and the core storefront (homepage, shop, product, embroidery, bag) are built. A purchase runs end to end against the Stripe sandbox. Checkout restyle, account and content pages still to do; SkipCash pending credentials.
**Last updated:** 24 Sep 2026

This is the running record of what has actually been built, tested and
verified. The requirements and scope document is kept outside this repository.

---

## 1. Current state at a glance

| | |
|---|---|
| Collections | 18 (13 visible to the client, 5 hidden) |
| Type errors | **0** |
| Admin config audit | **No problems** |
| Integration tests | **107 passing** |
| End-to-end tests | **22 passing** |
| Storefront | **Homepage, shop, product page, embroidery drawer, bag** — built (§15). Checkout, account and content pages still template |
| Email | Built (§14); sending from plumpose.com waits on domain verification |
| Payments | Stripe sandbox working end to end; SkipCash blocked on credentials |

Running locally at `http://localhost:3000` (this machine currently runs it on 3001 via `.claude/launch.json`, because another project holds 3000).

---

## 2. Stack as built

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3.3 (App Router), React 19.2.6 |
| CMS / backend | Payload **3.90.1**, installed into the same app |
| Database | PostgreSQL 16 in Docker (`plumpose-pg`, port **5434**) |
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

> Revised 22 Sep 2026. Shipping, the free-shipping threshold, discounts and
> blocked-country enforcement moved from this list into §13 when the commerce
> engine landed (92a5f2e).

### Not tested
- **No admin screen has been exercised by a human** — only screenshotted.
- **The e2e suite runs on one worker.** It shared a database and a seeded
  product across Playwright's default five, and the specs fought over them:
  the stock assertion saw another worker's purchase, and a `webhookLog` read
  came back 403. Serialising fixed both. A database per worker would be the
  way to get the parallelism back.
- **The storefront suite is skipped, not passing.** `frontend.e2e.spec.ts` is
  `describe.skip` — it asserts the upstream template's storefront (a page
  titled "Payload Ecommerce Template", a "Hoodie" product, `/account`,
  `/orders`, `/find-order`), none of which plumpose has. Replace it when the
  storefront is built; until then it reads as a checklist of what to cover.

  > An earlier note here blamed an ESM loader failure on
  > `revalidatePage.ts`'s extensionless `import ... from 'next/cache'`. That
  > was wrong — the config loads fine. The two real causes, both consequences
  > of this project's own hardening, were found on 22 Sep and fixed:
  >
  > - `admin.e2e.spec.ts` — `seedTestUser()` created a user with no `roles`,
  >   which defaults to `['customer']`. `users.access.admin` is
  >   `checkRole(['admin'])`, so the login succeeded and the panel then said
  >   "Unauthorized, this user does not have access to the admin panel."
  >   Fixed by seeding `roles: ['admin']`.
  > - `frontend.e2e.spec.ts` — `createVariantsAndProducts` POSTs to
  >   `/api/variantTypes` with no auth header. The upstream template left that
  >   collection open; this one answers **403**, so `.doc.id` threw in
  >   `beforeAll`.
- The storefront has been rendered and its cart exercised, but only through the
  API and a handful of pages. There has been no pass over it as a shop.

### Logic that does not exist yet
- **Spin wheel** — no weighted pick, no code issuance, no one-per-visitor.
  `spinSegments` and `spinEntries` exist; nothing drives them.
- **Currency display** — no conversion code. The *data* is ready: all 163
  currencies carry a hand-set `priceOverride`, which is the legacy mechanism
  (the rate is derived from it, deliberately, so a refresh cannot move a market
  price). `rate` being empty is by design, not a gap.
- ~~**Confirmation email**~~ — built 24 Sep 2026, see §14. Sending from
  `@plumpose.com` still waits on the client verifying the domain in Resend.
- **Reviews aggregate rating**
- **Gift option** — modelled on orders, not wired into checkout
- **Contact form** — plugin installed, no form configured
- **GA4 and Search Console**
- **Storage adapter** — uploads write to local disk and will not survive a
  serverless deploy
- **CSV exports** (A6, A17) — `plugin-import-export` was never installed
- **The storefront itself** — still largely the upstream template: Payload logo,
  "Designed in Michigan", placeholder homepage

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
docker start plumpose-pg     # Postgres on 5434
pnpm dev                     # http://localhost:3000
pnpm seed                    # idempotent
```

A development-only admin fixture is seeded (`dev@plumpose.local`) so the
screenshot tooling can log in. It is skipped entirely when `NODE_ENV` is
production.

**Node 20.9+** — `engines` is `^18.20.2 || >=20.9.0`. Verified on Node 22.20.0.
An earlier note here claimed 24.15+; that figure came from the upstream
monorepo, not this `package.json`.

**Port 5434, not 5432 or 5433.** Both `.env` and `.env.example` point at 5434,
and 5433 is a common default that another project's container may already be
holding — pointing plumpose at someone else's database fails in confusing ways.

---

## 12. Next

> Revised 24 Sep 2026. Email and the core storefront moved to §14 and §15.

1. **Checkout** — restyled, as a **redirect** flow (SkipCash returns a `payUrl`),
   with the gift option and the discount code field.
2. **Content pages** the nav already links to — Our Story, FAQ, Shipping &
   Returns, Made for You, Press, Spotted.
3. **Homepage global** — so she can edit the hero, print and step copy.
4. **Spin wheel** and **currency display** (data ready for both).
5. **Account pages** and a customer password-reset page.
6. **SkipCash adapter** *(blocked on credentials)* — price through `priceOrder()`.
7. **A storefront e2e suite**, replacing the skipped `frontend.e2e.spec.ts`.
8. **Before deploying:** storage adapter for media and film (the client's media
   is deliberately not in the public repo), database migrations.

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

### Superseded — no event handlers were registered

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

### The payment webhook (P4) — built

The gateway is now the source of truth. `src/payments/webhook.ts` replaces the
plugin's receiver, which returned `200 {received:true}` to an unsigned request
and logged nothing.

| Behaviour | Before | Now |
|---|---|---|
| No signature | 200, ignored | **400**, logged |
| Bad signature | 400, not logged | **400**, logged |
| Valid event | 200, no handler ran | acted on and logged |
| Repeat of the same event | n/a | **200 `duplicate`**, applied once |
| Failed payment | n/a | transaction marked failed (P11) |

Every callback lands in `webhookLog`, verified or not — a run of
`signatureValid: false` is what a forgery attempt looks like, and discarding
those hides it. Idempotency is on the gateway's own event id, because gateways
retry: applying one twice would decrement stock twice and burn a code twice.

**When the browser never confirms** — the customer pays and closes the tab —
the webhook creates the order itself, through the same public
`/confirm-order` route the browser uses, so both paths build the order
identically. It does not call the plugin's handler directly: `confirmOrderHandler`
is not re-exported, and reaching it would mean a deep import into `dist/`.

#### Known limitation: account holders

The webhook is anonymous, and the plugin refuses to settle a signed-in
customer's transaction from an anonymous caller — `validateSettlement` throws
"Guest transaction belongs to an authenticated customer". That guard is
correct and should not be weakened.

So **webhook recovery covers guest checkout only.** Guest is the default
(C4/S10), and a signed-in customer confirming in their own browser is the
normal path, so the exposure is narrow: a logged-in customer who pays and
closes the tab still gets no order. Closing it properly needs the webhook to
act with authority, which means either a service user or the plugin exposing
its confirm handler.

#### For the SkipCash adapter

Keep this shape — fail closed, log everything, idempotent on the gateway's own
id. Only the signature computation changes: HMAC-SHA256 over a fixed field
order with `timingSafeEqual`, exactly as `skipcash-webhook.mjs` already does.

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

---

## 14. Email — built 24 Sep 2026

Fixes L5 and P3: the customer now hears from the shop. Resend, through
`@payloadcms/email-resend` 3.90.1. Code in `src/email/`.

| Trigger | Email | To |
|---|---|---|
| Order created | Confirmation — pieces, embroidery, breakdown, address, gift note, link to the order | Customer |
| Order created | New-order alert — the same plus phone and a link into the admin | Site settings → *New-order alerts go to*, else the contact email |
| Fulfilment set to **Shipped** | "On its way", with the tracking number if set | Customer |
| **Resend confirmation** button on the order | Confirmation again | Customer |
| Forgot password | Branded reset link | The account |

**Sent after the commit, never inside it.** Orders are created inside the
plugin's `/confirm-order` transaction, which commits only after our hooks
have run. The send is scheduled with Next's `after()` and re-reads the order
*without* `req`, so it can only see committed rows — an order that rolls back
sends nothing.

**Once, on the record.** Each email stamps its own date on the order
(`confirmationEmailSentAt`, `notificationEmailSentAt`, `shippedEmailSentAt`),
so a second trigger is a no-op — the legacy `notifyOnce()`. A failure never
fails the order; it is written to `emailError`, shown in the order sidebar.

**The hook is on the orders collection**, not the Stripe adapter, so SkipCash
orders will email with no further work.

**No per-line prices in the email.** An order line does not record its unit
price, and today's product price may differ; the email shows the breakdown
stored at payment, which is what was charged.

### Environment

`RESEND_API_KEY` turns it on; empty means Payload logs emails to the console.
Off under `NODE_ENV=test`. `EMAIL_FROM` must be on a domain verified in Resend
— until the client verifies plumpose.com, `onboarding@resend.dev`, which only
delivers to the Resend account's own address. `EMAIL_TEST_RECIPIENT` redirects
every email to one inbox for testing.

Reserved test domains (`.local`, `.test`, `example.com`, …) are never sent to,
so the e2e suite's `@plumpose.local` shoppers do not generate mail.

### Verified

- 19 new tests (`tests/int/email.int.spec.ts`) — breakdown adds up, embroidery
  and gift note carried, customer input escaped, subjects, sender parsing,
  test-address filter. Integration suite: **100 passing**.
- `POST /api/orders/:id/resend-confirmation` anonymously → **403**.
- New columns present in Postgres; all three templates rendered and checked
  in a browser.

### Not yet verified

- **A real send through Resend end to end.** Needs a sender Resend accepts —
  see Environment.
- The Resend button and sidebar fields in the admin (needs a signed-in session).

### For the client

A Resend account, DNS access for plumpose.com to verify the domain, the
sending address (e.g. `orders@plumpose.com`), and where new-order alerts
should go.

---

## 15. Storefront — foundations and product page, 24 Sep 2026

Built from the approved GPT Image mockups in `../docs/mockups/`, the motion
plan in `../docs/MOTION-SPEC.md` and the prompts in `../docs/SCREEN-PROMPTS.md`.

### Done

| Piece | Where | Notes |
|---|---|---|
| **Wordmark as vector** | `src/components/brand/Wordmark.tsx`, `public/plumpose-wordmark.svg` | Traced from the outlined letters on page 1 of the brand guideline. The supplied logo is a 512px raster; this is the same drawing, sharp at any size |
| **Page is warm paper** | `globals.css` | `#f6f4f0`, as in the mockups. Panels one step deeper (`#eee9e1`) |
| **Type utilities** | `globals.css` | `caps`, `serif-display` (Fraunces at high-contrast optical size, nearest free face to Negaroa), `serif-italic` |
| **Light only** | `providers/Theme` | The template followed the device's dark mode and turned the site black |
| **Motion layer** | `src/motion/` | GSAP + ScrollTrigger + SplitText, Lenis smooth scroll. `Reveal` (lines rise from a mask, items fade and rise) and `RevealImage` (frame opens upward). Reduced motion: no Lenis, no animation. CSS failsafe shows content after 2.5s if the script never arrives |
| **Header** | `src/components/SiteHeader/` | Announcement from Site settings, fixed nav, centred wordmark, QAR, search, account, bag. Condenses after 80px of scroll. Mobile menu |
| **Footer** | `src/components/SiteFooter/` | As in the mockup. Contact details from Site settings; newsletter writes to Subscribers (same thank-you for new and repeat signups, so the list can't be probed) |
| **Product page** | `app/(app)/products/[slug]` | Desktop: large photo then pairs, sticky info column. Phone: swipeable photo row so the buy button isn't seven photos down. Size boxes, "Select a size" / "Add to bag" / "Sold out" states, embroidery panel with the live fee, detail rows built only from true data |
| **Videos** | `public/video/` | Camera originals rotated upright, slowed to half speed, 1–2.8 MB each, MP4 + WebM + poster |
| **Full-resolution photos** | `seed-assets/brand-*` | The client's 1333×2000 photographs replace the 640–1100px images pulled from the old HTML. The seed upgrades the gallery only if it is still exactly the legacy set |

### Fixed on the way

- **Product structured data said `139900` `usd`.** Google would have read a
  hundred and forty thousand dollars. Now `1399.00` `QAR`.
- **Site settings were cached with no invalidation** — a new announcement or
  WhatsApp number would not have appeared until a restart. Now cleared on save.

### Found, not fixed — needs a decision

- **Stock goes negative.** Size M had reached **−115** in the local database
  from repeated test purchases: nothing stops the plugin's `inventory: $inc`
  going below zero. This is P9, blocked on the client's answer to "do
  out-of-stock sizes block purchase, or allow made-to-order?" (REQUIREMENTS
  §9.3 Q8). Local test data was reset to 6.

### Second pass — review, fixes, embroidery and the bag

Reviewed with `scripts/shoot-storefront.ts` (new: desktop + phone, full page
and first screen, console errors). From Git Bash run it with
`MSYS_NO_PATHCONV=1`, or `/our-story` becomes a Windows path.

| Piece | Notes |
|---|---|
| **Embroidery drawer** | `components/product/EmbroideryDrawer.tsx`. Placement → style → lettering → symbol → thread, numbered as the steps appear. Up to the Site-settings maximum of placements, each editable and removable. Lettering is cleaned as typed with the server's own `cleanLettering` ("m.k🙂!" → "M.K"). Only option **keys** reach the bag; the engine rebuilds names and fee |
| **Embroidery before the button** | The mockup put the panel under "Add to bag"; it now sits between size and the button, because the embroidery travels with the piece when it is added |
| **Bag drawer** | `components/Cart/CartModal.tsx`, as SCREEN-PROMPTS 08. Opens by itself after "Add to bag" (MOTION-SPEC D4). Lines show size and embroidery in words; stepper and remove. **Money comes from `/api/quote`**, not `cart.subtotal` — the plugin's subtotal omits embroidery and is overwritten with the full total once payment starts |
| **Goods-only quote** | `/api/quote` without a country now prices goods and embroidery and returns `deliveryPending: true`, via the new `priceGoods()` — the same line pricing checkout uses |
| **Phone announcement** | One phrase at a time, crossfading; first phrase server-rendered so nothing jumps |
| **Not-found page** | In the house style, with a way back to the shop |
| **No monospace** | The template's Geist Mono (prices, form labels) now falls back to Jost |

### Fixed in the second pass

- **Embroidery was silently lost when merging bag lines.** The plugin's default
  matcher treats same product + same size as one line and adds the
  quantities, so a plain M plus an embroidered M became "2 × plain M".
  `src/lib/cart/itemMatcher.ts` makes embroidery part of a line's identity.
  7 tests; verified in a real browser (plain ×2 merged, embroidered kept apart,
  QAR 4,357.00 = 3 × 1,399 + 160).
- Thread swatch selection ring was invisible (global focus styles); the
  lettering counter wrapped on phones.

Integration tests: **107 passing**.

### Not yet

- **Discount code field in the bag** (mockup 08). Belongs with checkout, where
  the code is stored on the cart and validated against the email.
- The homepage and shop grid are still the template.
- Nav and footer link to pages not built yet: Made for You, Our Story, FAQ,
  Press, Spotted, Shipping & Returns — they land on the new not-found page.
- Click-to-zoom on the gallery (MOTION-SPEC D2).
- The old template `Header` and `Footer` components are no longer used.
- Dev-only warning on 404 pages: "Encountered a script tag while rendering".
  Next renders the not-found layout on the client, and the template's
  `beforeInteractive` theme script trips React's warning there. Harmless; the
  theme is applied by `ThemeProvider` on mount.

### Homepage — 24 Sep 2026

`src/app/(app)/page.tsx` + `src/components/home/`. Replaces the template's
Pages-driven home, which showed "Payload Ecommerce Template" because no home
page existed.

| Section | Motion (MOTION-SPEC) | Data |
|---|---|---|
| Hero | §A: centre film clip-reveals up, four photographs rise in and trail the cursor by depth, drift at different speeds on scroll; tagline lines rise from a mask. Phone: vertical film full-bleed, two photographs over its edge | `/video/hero-*`; photographs from Media by filename |
| The Print | §B: pinned 150%, card `inset(20% 36%)` opens to full screen, story fades in at the end | `brand-02-print-macro.jpg` |
| Product band | §C reveals | First published product, lowest variant price |
| Lifestyle row | §C reveals | `brand-05-armchair.jpg` |
| Reviews, Spotted | §C reveals | **Approved entries only; hidden while there are none** — the mockup's quotes were invented |

- Only one film loads — the one for the screen size — and none under reduced motion.
- Verified headless: film playing, cursor drift, the print card at 2% / 60% /
  130% of the pin (`inset(20% 36%)` → `12% 21.6%` → `2.7% 4.8%`), no console errors.
- **Placeholder copy** (tagline, print story, lifestyle line) lives in
  `src/components/home/content.ts`. Next: an admin-editable Homepage global.
- The print is visibly soft full-screen at 1333px wide — ask for the original.
- **Hero alignment fixed (reported by the client's developer at ~1650–1920px).**
  Cutouts were positioned in % of width but tops in % of viewport height, so
  on wide screens they drifted into each other. The collage now sits on a
  fixed 1440 × 780 canvas that scales as one piece, built on shared lines
  (top line, bottom line, a right edge per column, 2% gaps); the tagline
  sizes in container units (`cqw`). Verified at 1024, 1280, 1366, 1440, 1680,
  1920 and 2560 wide: all lines hold, no photo overlaps another or the words.
- **Hero redesigned as a grid spread (client feedback: "images overlapping,
  not the right size, feels empty").** Words column (label + a line from her
  own product description at the top, tagline at the bottom) · two photographs
  · the film · two photographs. Full width under the header, edges on the
  header's hairline, every gutter 1.5cqw, every photograph filling its cell.
  Verified at seven sizes (1024×700 → 2560×1300, plus a short 1600×700):
  shared top and bottom lines, equal gutters, tagline fits, no overlaps.
- **Entrance and motion revised to the client's brief:** the film opens from
  92% with a clearing blur over 1.2s (`expo.out` ≈ cubic-bezier(0.16,1,0.3,1));
  photographs drift in from their own sides; words last. Afterwards the
  photographs are nearly still — ≤5px weighted cursor drift, each column moving
  as one — so the film carries the motion. The before-paint theme/motion
  script is gone: `data-theme="light"` and `js-motion` are rendered on <html>.

### Shop — 24 Sep 2026

`src/app/(app)/shop/` + `src/components/shop/ProductCard.tsx`, from
SCREEN-PROMPTS 05. Heading, a filter row of the real collections, search and
sort, then the grid. Cards swap to the second photograph on hover (D2, hover
devices only). While the catalogue is one piece, an editorial tile for hand
embroidery (live fee, links to the product's embroidery panel) sits beside it.
Skeleton loading in paper blocks (D5).

Fixed on the way, both inherited from the template:
- **Search crashed every time** — it `ilike`d `description`, which is rich text
  stored as JSONB (`operator does not exist: jsonb ~~* unknown`); it only
  worked on the template's original MongoDB. Now searches title, fabric,
  colour and composition.
- **`?sort=` went straight to the database.** Now one of three named sorts or
  ignored.

The template's `Search`, `Categories`, `FilterList` and `ProductGridItem`
components are no longer used.

The "1 Issue" badge the client's developer saw was a hydration mismatch on
`fdprocessedid` — an attribute a browser extension (form filler / password
manager) injects into buttons. Not a site defect.
- **Hero motion made visible (client's developer: "no animation").** It was
  running, but the tiles were nearly still by design, so after a 1.5s intro
  only the film moved. Now the frames stay fixed (grid intact) and the
  *pictures* move inside them: a slow breathing zoom (1.18 → 1.27, 11–18.5s,
  each its own pace), a 12px window shift against the cursor (film shifts 8px
  with it — the depth-of-field brief without moving an edge), and a slower
  slide on scroll. Intro strengthened: film from 88% + 14px blur over 1.6s;
  photographs travel 90/60px, 0.15s apart, each picture settling from a 1.45
  zoom. Verified: frames unmoved by cursor and breathing; no errors.
- **Test-shot switch.** `pnpm test-shots` uploads AI-generated test photographs
  from `brand-assets/test-shots/` (alt "TEST SHOT — not for launch"); the
  homepage uses them only while `TEST_SHOTS=on` (set in `.claude/launch.json`,
  not `.env`), falling back to the real photograph wherever there is no test
  shot. The Print frames a landscape image centred and a portrait one high.
  First trial: `print-wide.jpg` — the whole shark fits the band.

### Homepage rebuilt to the client's reference — 24 Sep 2026

The client shared a screen recording (`brand-assets/reference/client-reference-animation.mov`,
an "Atelier Aesthetica" demo). Its motion is five moves, and the homepage now follows them:

| Move | Built as |
|---|---|
| Full-screen cinematic hero, mixed upright/italic headline, framed detail | `HomeHero.tsx`: landscape café film (`hero-wide`, cropped from the 4K original of EK3A2406 so the shirt shows, 3.4 MB); header over it in white; "Rest *differently.*"; a framed still of the print with its label on the right edge (a frame over the moving film framed nothing, and nearer the middle it covered her face) |
| Next section slides up over the hero | Hero is sticky inside a wrapper that ends with the philosophy section; the film leans in and dims as it is covered |
| Headline held while photographs drift past | `Philosophy.tsx`: her own words, sticky; six photographs at different scroll speeds, some in front of the words (desktop only) |
| A small image opens to full screen, with figures | `PrintBand.tsx` + facts from her settings: lead time, number of thread colours |
| Pinned 01/04 sequence | `MadeSteps.tsx`: four steps, one screen each; every fact from the database (sizes, threads, fee, lead time, delivery prices via the shared `deliveryRange()`) |

Verified: the film keeps her face in frame through the whole loop at 1280×720,
1440×900, 1920×1080, 1280×1024, 2560×1080 and on a phone; each move captured
at scroll positions with no console errors; steps read 1 → 4 in order.

Fixed on the way: the header no longer changes height when it condenses (every
page jumped 32px); step progress is read from the track's own rectangle (stored
ScrollTrigger positions were taken before the Print band's pin spacing and put
the steps two screens early). `LifestyleRow` is no longer used.
- **Motion review round (client's developer, from a recording of the site).**
  Curtain: the whole hero now recedes (scales to 0.92, dims, words lift away)
  with `scrub: 1` so it trails the wheel by a beat. Philosophy headline rises
  line by line tied to the scroll (no longer on a timer); photographs arrive
  from their own side (±40px, `expo.out`, 1.8s) after the words. Depth
  site-wide: every `RevealImage` picture rests at 108% and drifts ±3% inside
  its frame against the scroll. Steps: the upward wipe replaced by a
  cross-dissolve (in 1.2s, out 0.9s, scale settle 1.8s). Verified by filming
  both transitions frame by frame; hero at 500px scroll measured at 0.959.
- **Steps no longer feel stuck (client's developer).** The section pinned for
  four screens but only changed at four thresholds, so most of the scroll moved
  nothing. It is now one GSAP timeline scrubbed across the track (`scrub: 1`):
  each photograph rises over the last in step with the wheel and reverses on
  the way back, titles and words slide with it, a hairline fills with progress,
  and every picture keeps a slow zoom and drift. Pinned travel cut from 4 to 3
  screens.
- **Scroll positions below The Print were wrong.** Its pin adds 1.5 screens of
  spacing, and later triggers were measuring before it — the steps finished
  half-way through their track. The pin now has `refreshPriority: 1`, so it is
  measured first. Verified: progress line equals scroll position at every 10%.
