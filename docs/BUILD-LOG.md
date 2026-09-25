# plumpose — Build Log

**Project:** [`plumpose/`](../plumpose) — Next.js + Payload CMS store
**Phase reached:** Backend, email and the whole storefront — shop, checkout, content pages, accounts — are built. A purchase runs end to end through Stripe’s hosted page (sandbox), the redirect shape SkipCash will use. Content-page copy partly placeholder (§17); SkipCash pending credentials.
**Last updated:** 25 Sep 2026

This is the running record of what has actually been built, tested and
verified. The requirements and scope document is kept outside this repository.

---

## 1. Current state at a glance

| | |
|---|---|
| Collections | 18 (13 visible to the client, 5 hidden) |
| Type errors | **0** |
| Admin config audit | **No problems** |
| Integration tests | **121 passing** |
| End-to-end tests | **36 passing** (21 skipped — the template storefront spec) |
| Storefront | **Every page** — homepage, shop, product, bag, checkout, order, content pages (§15–§17) and the account area (§19) |
| Email | Built (§14); sending from plumpose.com waits on domain verification |
| Payments | Stripe sandbox, hosted Checkout (redirect flow), working end to end; SkipCash blocked on credentials |

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

### ~~Known remaining jargon~~ — fixed 25 Sep 2026 (§31)
`AVAILABLE VARIANTS` now reads *Sizes & stock*, its `VARIANT OPTIONS` column
*Size, colour or pattern*, and "Enable QAR price" *Set a price*.

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

#### ~~Known limitation: account holders~~ — closed 25 Sep 2026 (§31)

The webhook is anonymous, and the plugin refuses to settle a signed-in
customer's transaction from an anonymous caller — `validateSettlement` throws
"Guest transaction belongs to an authenticated customer". That guard is
correct and was not weakened. Settlement now acts as the customer the
transaction belongs to, so a signed-in customer who pays and closes the tab
gets their order too. See §31.

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

- ~~**Stock goes negative.**~~ *Fixed 24 Sep 2026, §20.* Size M had reached **−115** in the local database
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
- **Landing-page polish from a review of the client's screen recording (24 Sep).**
  Five faults, each traced to a cause:
  - *Photographs slid over the headline* in the philosophy section: they were
    placed across the whole section, half of them in front of the words. The
    headline is now held to the middle 54% of the screen and every photograph
    lives in the outer margins (furthest in: 18% of the width), all behind.
  - *Photographs popped in*: each arrived on a 1.8s timer when it crossed a
    line. Fade, settle and drift are now all scrubbed to the scroll. On a phone
    there are no margins, so the section is the words and two photographs.
  - *A cream border round the hero during the curtain*: the whole section was
    scaled to 0.92. Now only the film inside the frame leans in and sinks.
  - *The Print's words looked cut off*: the white copy faded in while the frame
    was still opening, half of it over cream paper. It now waits for the full
    frame; `scrub: 1` instead of `true` removes the jitter.
  - *The steps felt mechanical*: each photograph wiped up with a clip, showing
    two half-photographs mid-way. Now a cross-dissolve with a zoom settle,
    overlapping word changes, `scrub: 1.4`.
  Also: the dev-mode "Compiling" badge is off (`devIndicators: false`) — it
  appeared in every recording and read as a site fault; the product band's
  bottom padding is lighter, so it no longer leaves a screen of blank paper
  above the footer. Verified by wheel-scrolling headlessly at 1920×1080 and on a
  phone: at every step no photograph intersects the headline's text, the Print
  copy never shows before the frame is full, the hero stays full width, and
  there are no console errors.
- **Steps readable, and a clean hand-off to the product (second review, 24 Sep).**
  The previous round made each change take 80% of its step so something was
  always moving — which left the middle steps readable for a fraction of a
  second ("Add hand embroidery" flashed past in the recording). Now each change
  takes 40% of a step, centred on the boundary, and 60% holds still: measured
  by wheel-scrolling, steps 2 and 3 stay fully readable for ~720px of scroll
  (was ~185px). Scroll per step 85 → 95svh. The hairline now steps on a
  quarter at a time with the change, so it always agrees with the "02 / 04"
  counter (0 mismatches across the run). Hand-off: the product photograph
  began fully hidden and only opened at 90% of the screen, leaving half a
  screen of blank paper after the pinned steps. `RevealImage` takes a `start`
  (default unchanged); the product band opens from `'top bottom'` and its top
  padding is lighter.
- **Hero film fit checked on screen; header nav wrap fixed (24 Sep).** At
  1920×1080, 1440×900, 1366×768, 1280×1024, 2560×1080, 1024×768 (landscape
  film) and 768×1024, 390×844 (vertical film): playing, `object-fit: cover`,
  covering the hero edge to edge, intro settled at scale 1, her face in frame
  at 10/35/60/85% of the loop. The close-up at ~60% of the phone clip has no
  face in the source itself. Ultrawide 2560 upscales the 1080p film 1.33× —
  fine, but a 4K encode would be sharper there and on retina screens. Found on
  the way: from 768 to 1023px the inline nav wrapped into "MADE / FOR / YOU"
  (column 266–394px, links need ~363–411px). Inline nav now from `lg` at
  `gap-6`, `xl:gap-10`, `whitespace-nowrap`; below that, the menu button.
- **Closer to the reference; descenders no longer cut (24 Sep).** Compared
  frame by frame against `brand-assets/reference/client-reference-animation.mov`:
  - *The Print now does the reference's signature move.* Its heading and
    figures are on screen from the start, in ink on paper, and each letter
    turns white as the growing card reaches it — two identical copies of the
    words, the ink one on the paper and the white one inside the frame, where
    the frame's own clip-path reveals it. Only the paragraph and link wait for
    the full frame. Starting card smaller and portrait, as in the reference.
  - *Philosophy:* four small thumbnails framing the headline instead of six
    photographs out at the page edges; placed from the centre (inner edges
    29–31vw from it, the headline column is 27vw either side). No overlap at
    768, 1024, 1440, 1920.
  - *Descenders were clipped* — the y of "differently", the g of "gathering",
    the y of "by hand". SplitText clips each line's mask to the line box, and
    with line-height 0.9 the tails hang outside it. All three splits now go
    through `splitLines()` (src/motion/gsap.ts), whose masks carry
    `split-line-mask`; globals.css pads that box 0.22em below (0.06em above)
    and gives the space back with a negative margin. Lines start at
    `LINE_HIDDEN` (130%) so they still clear the taller mask.
  Not changed on purpose: the hero's detail frame stays at the edge (an outline
  over a moving subject frames nothing); the steps keep a dissolve rather than
  the reference's wipe (the wipe was reviewed as mechanical); no extra section
  padding (the reference has none, and the last review flagged gaps).
- **Steps: left-to-right wipe (client request, 24 Sep).** The dissolve felt
  flat; the client asked for the reference's direction. The next photograph is
  uncovered from its left edge (`clip-path` inset from the right, 100% → 0)
  while its picture glides in from 10% left at 118% and settles; the last
  drifts 8% right beneath it, so the two move as one strip. `power2.inOut`,
  change = half a step (was 40%), scroll per step 95 → 110svh so the holds stay
  as long. Titles and notes slide the same way (out right, in from left).
  Verified: over 150 wheel samples no picture ever leaves an edge showing
  inside its visible part of the frame; middle steps readable ~14–15 samples.
- **Why the step wipe did not feel smooth: the photographs were not there yet
  (24 Sep).** Measured by wheel-scrolling with a frame logger and the Long
  Animation Frames API: the animation itself holds 60fps (median and p99
  16.7ms, no long frames). The fault was loading — photographs 2–4 are
  `loading="lazy"` and sit fully clipped until their wipe, and the browser does
  not count a fully clipped image as visible, so each one only began to
  download as its wipe uncovered it: an empty frame, then a pop mid-transition
  (worse in dev, where each image size is generated on first request).
  `Media` now takes `loading`; the step photographs are `eager`, and the
  section calls `img.decode()` on all four a screen before it arrives so no
  decode lands in a wipe. Verified: all four complete before the section, and
  a clean run shows 0 frames over 20ms. Residual 33ms frames in a second run
  were scattered, not aligned with wipes — dev mode and machine load, not the
  page. Judge smoothness on `pnpm build && pnpm start`.
- **Production build, run locally (24 Sep).** `pnpm build` passes (TypeScript
  included; `/` prerenders as static). Next 16 builds into `.next` and dev into
  `.next/dev`, so the two can run side by side. Locally, `next start` 400'd
  every photograph: Next 16 refuses to optimise upstream images on a private
  IP, and `dangerouslyAllowLocalIP` was dev-only. It now also honours
  `LOCAL_PRODUCTION_PREVIEW=on`, set only in the `plumpose-prod` entry of
  `.claude/launch.json` (port 3000) — never on a deployed server, where the
  host is public and the guard should stay on. Measured on the production
  server: median frame 16.7ms in every run, no long animation frames, step
  photographs all loaded before the section, no wipe edge gaps.

---

## 16. Checkout — Stripe hosted page as the SkipCash stand-in, 24 Sep 2026

The template's checkout (an inline Stripe card form) is gone. It never recorded
the Qatar delivery city on the cart, so every Qatar address would have been
refused at payment with "Please choose a delivery city".

### The flow

| Step | Where | What happens |
|---|---|---|
| Form | `/checkout` — `components/checkout/CheckoutPage.tsx` | Contact, delivery (every country; blocked ones say why; Qatar city picker with fees), gift note, discount code. Priced live by `/api/quote`. Wordmark-only header. The draft survives a cancelled payment (sessionStorage) |
| Pay | `stripeSandbox.ts` → `initiatePayment` | Writes city + code onto the cart, re-prices with `priceOrder()`, stores address + gift in the cart's pricing snapshot (not in Stripe metadata), opens a **hosted Checkout Session** for exactly that total, returns `redirectURL` |
| Return | `/checkout/return` | `settleCheckoutSession()` on the server, then a redirect to the order — or back to checkout if unpaid. A short "confirming" state keeps checking if Stripe has taken the money but the order is not yet confirmable |
| Order | `/order/[id]?token=…` | Thank-you, order no., 4-step progress, pieces with embroidery, breakdown, address, gift note. The order's random `accessToken` is the key; the email address is no longer in the link (it was, on the template's `/orders/:id?email=…`) |

**How a Checkout Session meets the plugin.** The plugin confirms from a
PaymentIntent and checks it hard (`validateSettlement`). The session is created
with the plugin's metadata on its PaymentIntent, so every check passes — except
that the PaymentIntent does not exist until the customer pays. The transaction
therefore records `stripe.checkoutSessionID` (new field), and
`settleCheckoutSession()` copies the PaymentIntent id across once paid, then
confirms through the plugin's own endpoint. The return page and the webhook both
call it; the plugin's atomic claim on the transaction means exactly one order.

**Two traps it avoids.** The link write goes out *without* `req` — inside the
webhook's transaction it would be invisible to the confirm call, a separate HTTP
request. And a declined card no longer marks the transaction failed: on the
hosted page the customer can try another card, and the plugin only settles a
transaction that is still pending. Abandoned sessions are marked `expired` by
`checkout.session.expired` (P11).

**Signed-in customers.** The return page forwards the shopper's cookie to the
confirm endpoint, so their order settles as theirs. The webhook stays anonymous
and still covers guests only (§13).

### Verified

- A real purchase through the UI: bag → checkout → Stripe's page showed QAR
  1,419.00 → back on "Thank you, Mariam." Order 105: amount 141900 = 139900 +
  2000, gift note, full address and phone; transaction `succeeded` with session
  and PaymentIntent linked; both forwarded events 200 with valid signatures.
- `checkout.e2e.spec.ts` rewritten to pay on the hosted page in a browser (8):
  engine total charged, breakdown/address/gift on the order, embroidery, stock,
  discount consumed only on payment (guest ledger email), a cancelled payment
  creates nothing, a signed-in customer's order is theirs, a blocked country is
  refused. `webhook.e2e.spec.ts` (8): signatures, "customer never comes back"
  (browser stopped before the return page; exactly one order), a retried event
  applied once, a declined card leaves the transaction pending.
- Full suite: **36 e2e pass**, 21 skipped (the template storefront spec);
  **121 integration** (14 new in `checkout-session.int.spec.ts`).

### Found and fixed on the way

- **A signed-in customer's confirmation email was never sent** — "no
  recipient": their order carries the account, not `customerEmail`.
  `customerEmailOf()` falls back to the account; used by the emails and the
  order page.
- **The admin e2e spec had been failing at load since `ff7df58`**: the suite
  loads the Payload config as strict ESM, where `next/cache` and `next/server`
  do not resolve. Those imports (in files the config loads) now carry `.js`.
- The find-order email printed its access link to the server log. Removed.
- `@stripe/react-stripe-js` and `@stripe/stripe-js` removed — nothing uses them.
- The webhook's old "bare PaymentIntent" path (its own copy of the confirm call,
  ~130 lines) is gone: every payment is now a Checkout Session. A paid
  PaymentIntent with no session behind it is logged as "not a checkout
  payment" and let go, never retried.
- `webhookLog.applied` now says what it can know: "had the payment become an
  order". When the return page and the webhook race, the plugin hands every
  caller the one order it made, so no caller can tell which of them made it.

### Not yet

- **Track order** (`/find-order`) is still the template's form.
- **Stripe's page says "New business sandbox"** — the account's business name,
  set in the Stripe dashboard (Settings → Business → Public details), along with
  its logo and brand colour. Nothing in code.
- **The owner's new-order alert 403s** until plumpose.com is verified in Resend
  (test mode only delivers to the account owner). `EMAIL_TEST_RECIPIENT` can
  route everything to one inbox meanwhile.
- **Saved addresses** use the plugin's default country list, which lacks Qatar —
  fix before building account pages.
- A bag of ~8+ lines could exceed Stripe's 500-character metadata limit on
  `cartItemsSnapshot` (the plugin has the same ceiling).

---

## 17. Content pages — 24 Sep 2026

Every page the nav and footer link to now exists. Before this they landed on
the not-found page.

| Page | Route | Built from |
|---|---|---|
| **Our story** | `/our-story` | Opener film → the house → behind the print (`#the-print`) → the silk (`#the-silk`) → the atelier (`#atelier`) → closing line |
| **FAQ** | `/faq` | The FAQs collection, grouped by category, native `<details>` (opens without JS, find-in-page reaches closed answers), FAQPage structured data |
| **Shipping & returns** | `/shipping-returns` | `#delivery` rate tables from `rateCard()` — the function checkout prices against, so the page cannot quote a fee checkout would not charge; `#returns` her policy; `#gifting` |
| **Made for you** | `/made-for-you`, `/made-for-you/[slug]` | What she makes (four categories, one photograph each), how a commission runs 01–04, then her published projects with a category filter; each project has its own page |
| **Press** | `/press` | Published press items; with none, a press-enquiries band. **No publication is named that she has not added** |
| **Spotted** | `/spotted` | Approved posts only; with none, her own campaign photographs, **labelled as the campaign** |
| **Contact** | `/contact` | Channels from Site settings (WhatsApp appears once the number is filled in) + an enquiry form. `?subject=` preselects the topic |
| **Track order** | `/find-order` | Restyled; same lookup. Accepts "#105" as well as "105" |

Shared parts: `src/components/editorial/` (heading, split band, prose, closing
band, `StoryOpener`, `ContactForm`); copy in `src/content/pages.ts`; photographs
through `loadPageMedia()` (`src/utilities/pageMedia.ts`), which also handles
test shots. Footer gains *The silk* and *Contact us*.

### Media — every client asset now has a job

- **Our Story opener uses the unused café clip** (EK3A2414, the pillow) — the
  homepage uses EK3A2406, so no footage repeats. Encoded as `story-pillow`
  (portrait, half speed, 2.8 MB MP4 / 3.4 MB WebM). A landscape crop was tried
  and dropped: from a portrait source it is only her face. Desktop shows the
  film in a portrait half-screen frame that opens from a card; on a phone it
  opens to the full screen and the heading turns white where the film reaches
  it (the Print band's two-copies trick). Verified by wheel-scrolling
  headlessly at 1440×900 and iPhone 13: card → full frame, film playing,
  face in frame, no errors.
- `scripts/encode-videos.sh`: this machine's ffmpeg rejects `-b:v 0` with
  `-maxrate` for VP9 ("Rate control parameters set without a bitrate"), so every
  WebM came out empty. Now capped quality (`-crf 36 -b:v <rate>k`).
- **Every film now has a place, and none repeats on the same device:**

  | Film | Homepage | Content pages |
  |---|---|---|
  | EK3A2406 café breakfast | desktop hero (`hero-wide`) | Made for You, Bridal tile (`story-cafe`, portrait) — phone visitors see it only here |
  | IMG_5839 corridor → print close-up | phone hero (`hero-mobile`) | Our Story, behind the print — desktop visitors see it only here; replaces the print macro still, which is already the homepage Print band |
  | EK3A2414 café pillow | — | Our Story opener (`story-pillow`) |

  Below-the-fold films use `InViewFilm` (`src/components/editorial/InViewFilm.tsx`):
  poster first, sources attached only within a screen of the viewport, paused
  off screen, poster only under reduced motion. `SplitBand` takes `film` in place
  of `image`. Verified headlessly: the corridor film is not requested until
  scrolled near, then plays; the opener pauses once off screen; no errors.
- All seven photographs are used across the pages.

### Seeded (`pnpm seed`)

- **Product details, from her old site verbatim**, filled only where empty:
  colour, composition, fabric, weight, trims, fit note, material & care, gift
  packaging. Delivery & returns left empty on purpose so the product page
  keeps building it from the live rates.
- **10 more FAQs** (16 total), each restating something the old site already
  said. None quotes a fee — they point to Shipping & returns.
- **The Contact form** (form-builder). Submissions land in Content → Enquiries.
- **Three SAMPLE Made-for-You projects** — `sample-a-bridal-morning`,
  `sample-initials-in-gold`, `sample-cut-to-measure`. **Not real
  commissions**; seeded only outside production, like the dev admin.

### Verified

Type check clean. All nine routes 200 at desktop and phone, no console
errors (`scripts/shoot-storefront.ts`). Contact: a submission is stored
(201), anonymous read of submissions is 403; test rows deleted.

### Copy — what is hers and what is ours

Every block in `src/content/pages.ts` is marked **LEGACY** (her old site,
verbatim) or **PLACEHOLDER** (ours, to confirm).

**Hers, verbatim:** behind the print · the three silk pillars · returns
policy · gift packaging · material & care · product details · "Slip into the
evening." · "Silk nightwear, hand-finished to order." · the contact intro.

**Ours — the client must confirm or replace before launch:**
1. Our Story opener: "For the hours that belong to you" (from her footer line, reworded).
2. The house: "Made in Doha, for slow evenings" and its two paragraphs — the founder paragraph she was asked for.
3. The atelier paragraph.
4. Made for You: the intro, the four offers (does she take each kind of commission?), the four process steps ("we send a photograph before it leaves" is a promise).
5. Contact subjects; Press and Spotted empty-state lines.
6. The three sample projects — replace with real work or delete.

**Contradiction on her old site:** "Pure 22-momme silk" and "97% silk, 3%
spandex" both appear. Both are carried over (Our Story, product details,
FAQ). Ask which is right.

### Not done / follow-ups

- ~~No email when an enquiry arrives~~ — done in §19 (`src/email/enquiryAlert.ts`,
  every value escaped; the plugin's own emails stay off).
- ~~Form-builder does not enforce required fields server-side~~ — done in §19
  (`src/hooks/validateEnquiry.ts`).
- ~~The order-access email from Track order~~ — done in §19: branded, and it
  matches a signed-in customer's order by the account's email.
- Copy lives in code; next is an admin-editable global for these pages (A18).

### Test-shot slots (`PAGE_TEST_MEDIA`, used only with `TEST_SHOTS=on`)

| File in `brand-assets/test-shots/` | Appears on | Stands in for |
|---|---|---|
| `our-story-portrait.jpg` | Our Story — the house | doorway |
| `atelier-hands.jpg` | Our Story — the atelier | qatar book |
| `embroidery-initials.jpg` | Made for You — special embroidery (falls back to `atelier-hands.jpg`, then piping) | piping |
| `packaging.jpg` | Shipping — gift wrapping; Made for You — collaborations | qatar book |
| `doha-sea.jpg` | Our Story — a wide band after behind the print; **the band exists only while there is a sea photograph** (`pick.only`) | — |

**Imported 24 Sep:** atelier-hands, packaging, our-story-portrait, doha-sea.
Still wanted: `embroidery-initials.jpg` — the image supplied under that name
showed a plain pocket with no embroidery; kept aside, unused, in
`brand-assets/test-shots/unused/model-bedroom.jpg` (the importer reads only
the top level). The packaging shot's bag wordmark and "Thank you for being
here" card text were drawn by the image model — test only, as ever.
| `print-wide.jpg` | Our Story — third silk pillar (already imported) | print macro |

---

## 18. Hero film quality and click response — 24 Sep 2026

### Why the hero film looked soft

Measured against the camera original (SSIM, frame-aligned):

| Encode | Size | Bitrate | SSIM | Note |
|---|---|---|---|---|
| Old `hero-wide.webm` | 3.2 MB | 1.6 Mbps | **0.937** | **What Chrome played** — WebM was listed first |
| Old `hero-wide.mp4` | 3.3 MB | 1.6 Mbps | 0.964 | |
| New `hero-wide.mp4` | 7.2 MB | 3.4 Mbps | **0.975** | H.264 CRF 22, standard range |

Three causes, all fixed in `scripts/encode-videos.sh`:
1. **Bitrate far too low** for a full-screen 1080p close-up: 1.6 Mbps smeared
   skin texture, fine hair and the print on the collar.
2. **The browser picked the worse file.** VP9 from this libvpx tops out at
   SSIM ≈0.94 whatever the bitrate (a 13.5 MB WebM scored 0.939), and Chrome
   takes the first `<source>` it can play — the WebM.
3. **The café films are full-range colour** straight from the camera
   (`yuvj420p`, `pc`), which some browser/decoder pairs misread as limited range.
   Now converted to standard range with BT.709 tags.

The café films (`hero-wide`, `story-cafe`, `story-pillow`) now ship as H.264
only; `webm` is optional in every film component. `hero-mobile` (standard-range
source) keeps both formats. Desktop hero download: 3.3 → 7.2 MB; phones never
load it.

### Why clicks felt unresponsive

Measured with real mouse input (Playwright), time until the screen changes / the new page is ready:

| Click | Dev, before | Production, after |
|---|---|---|
| Hero "Discover the collection" → product | 6.3 s / 2.5 s warm, **nothing on screen meanwhile** | **53–70 ms** / 0.4 s |
| Hero "Our story" | 1.8 s / 0.8 s | 83–100 ms / 0.1 s |
| Nav "Shop" / "Made for you" | 0.3–0.7 s | 28–44 ms / 0.35 s |

- **`/products/[slug]` is dynamic and had no `loading.tsx`**, so Next could
  not prefetch it and kept the old page on screen until the whole product page
  rendered (Next 16 docs, *Linking and navigating → Dynamic routes without
  loading.tsx*). Added a product skeleton, and `(app)/loading.tsx` as the
  fallback for every other dynamic page. Prerendered pages are prefetched whole
  and never show it.
- The product page looked the product up **twice** per request (metadata and
  page), three levels deep, then ran its other queries one after another. Now
  one `cache()`d lookup (keyed by the slug string — `cache` matches arguments by
  identity) and the rest in parallel.
- Dev mode compiles and renders every page on demand, which is most of the 6 s.
  Judge speed on `pnpm build` + the `plumpose-prod` launch entry.

### Found on the way: content edits never reached the live site

`/`, `/faq`, `/press`, `/spotted`, `/our-story`, `/shipping-returns` are
prerendered at build time, and only Site settings cleared the cache — so an FAQ
edit, an approved review or Spotted post, a price or a delivery fee would not
appear until the next deploy (the homepage had this before §17 too).
`src/hooks/revalidateStorefront.ts` marks the storefront for refresh
(`revalidatePath('/', 'layout')`) on any change to FAQs, Press, Spotted,
Reviews, Projects, shipping cities and zones, personalisation options and
products. Verified on the production build: an FAQ edited over the API showed
on `/faq` at the next visit, and again when reverted. Not covered: variants
(per-size price and stock) — the product page is dynamic so it is always
current; the homepage's "from" price would lag until another refresh.

121 integration tests pass; type check clean.

---

## 19. Account area, enquiries and Track order — 24 Sep 2026

### The account pages, rebuilt

| Page | Route | Notes |
|---|---|---|
| Orders | `/account` | The account's front page: one row per order (number, date, stage, total, pieces), opening the one order page every email links to (`/order/[id]`). Points guests to Track order |
| Addresses | `/account/addresses` | Add, edit, remove. **Qatar with the delivery-city picker**, as at checkout; every other country typed |
| Your details | `/account/details` | Name and email, and a separate change-password form |
| Sign in · Create an account · Forgotten password | `/login` `/create-account` `/forgot-password` | House form parts (`src/components/forms/house.tsx`, now shared with Contact and Track order) |
| Choose a new password | `/reset-password?token=` | **New.** The reset email used to send customers to the Payload admin's screen; customers now come here, the client and staff still to the admin |
| Signed out | `/logout` | Linked to `/search`, which does not exist |
| `/orders`, `/orders/[id]` | — | Template duplicates; now redirect to `/account` and `/order/[id]` |

### Fixed on the way

- **Saved addresses could not be in Qatar.** The plugin's default list has 40
  countries and no Gulf state. `addresses.supportedCountries` is now the
  store's own 204 (`src/data/countryOptions.ts`, from the seed's countries.json).
- **Checkout pre-fills** from a signed-in customer's most recent address,
  including the Qatar delivery city (matched to its key by name). Anything
  typed in the visit still wins, field by field.
- **The bag was lost on sign-in, and the plugin kept fetching after sign-out.**
  The ecommerce plugin tracks the user itself and must be told:
  `onLogin` (merges a guest bag into the account's cart) and `onLogout`
  (forgets cart and addresses on the device) — never called before. Verified:
  a size added as a guest was in the account's cart after sign-in, alongside
  the one already there; no console errors after sign-out.
- **The auth provider's `create`, `forgotPassword` and `resetPassword` did not
  work** — a non-existent endpoint and GraphQL-shaped reads of REST replies.
  Rewritten; errors carry codes the forms turn into words.
- **Redirect messages are codes, not text.** The template printed any
  `?error=` / `?warning=` on the page, so a link could put words of anyone's
  choosing on plumpose.com. Verified: forged text shows nothing.
- **A catch-all `(app)/loading.tsx` (§18) turned every `redirect()` into a
  200 + client-side redirect** — account sign-in redirects and the payment
  return among them. Removed; skeletons are only where pages never redirect
  (product page, Made for You). All four redirects checked back at 307.

### Enquiries

- **Validated on the server** (`src/hooks/validateEnquiry.ts`, a
  `beforeValidate` hook on form-submissions): only the form's own fields,
  each once, trimmed and capped; required fields present; email fields well
  formed. Verified: name-only → 400, bad email → 400, junk and duplicate
  fields dropped.
- **A branded "New enquiry" alert** (`src/email/enquiryAlert.ts`) to the
  order-alert address, reply-to the sender, every value escaped, sent after
  commit. The plugin's own (unescaped) emails are not used. The send reached
  Resend and was refused only because plumpose.com is not verified yet — the
  same state as the order alerts.

### Track order

The lookup matched `customerEmail` only, which a signed-in customer's order
never has — so those orders could not be found. It now matches the account's
email too, case-insensitively for guests. Verified on order 129: old query 0
results, new 1. The email is branded, carries the order's token link, and the
reply is identical whether or not an order matched.

### Tests

7 new (`tests/int/enquiry-and-account-email.int.spec.ts`): escaping, line
breaks, subject and reply-to, the reset link per role. Integration suite
**128 passing**; type check clean. The account flow (create → address →
checkout pre-fill → details → sign out → locked page → wrong password → sign
in back to the page asked for) was driven headlessly end to end; its test
accounts were deleted afterwards.

### Still open

- ~~Stock can go negative~~ — fixed, §20.
- A size's own price change still does not refresh the homepage's "from" price (§18).

---

## 20. Stock — 24 Sep 2026

### What was wrong

Two faults in `@payloadcms/plugin-ecommerce`, found by reading its source:

1. **The pre-payment stock check never ran for a product with sizes.** In
   `endpoints/initiatePayment.js` the variant branch is nested inside
   `if (item.product && !item.variant)`, so it cannot be reached. Nothing
   checked stock before a payment.
2. **The decrement has no floor.** `confirmOrder.js` takes each piece off
   with a raw `db.updateOne({ inventory: { $inc: -qty } })` — which also
   bypasses collection hooks.

The storefront meanwhile blocked sold-out sizes regardless of the product's
*Made to order* switch, and capped quantities at stock. Size M reached −115,
then −24.

### The rule

The product's existing **Made to order** switch (admin → Fabric & Care, now
described in plain words there) decides it, in one module —
`src/lib/pricing/stock.ts` — that the storefront, the quote and payment share:

| | Made to order **on** (the seeded product) | **Off** |
|---|---|---|
| Size with no stock | Orderable; "M — made to order"; a note under the button | Sold out, button disabled |
| More than in stock | Allowed; bag says "2 made to order"; checkout lists them | Capped; "Only 2 left in … size M" |
| At payment | Charged | Refused before a payment page opens |

Quantities are summed per size across the bag, so a plain and an embroidered
M cannot each pass alone. Negative stock reads as zero everywhere.

### Where it is enforced

- **Before payment:** `stockRefusal()` runs inside `priceOrder()`, so the
  quote refuses and every payment adapter (Stripe now, SkipCash later) refuses
  too — the plugin shows its own generic error there, so customers get the
  words from checkout's live quote, which disables Pay first.
- **The bag:** the goods-only quote returns `stock` (refusal + made-to-order
  counts); the bag shows the refusal and blocks checkout. The cart now
  populates `madeToOrder` so the stepper can follow the rule.
- **After payment** (`src/hooks/stockAfterSale.ts`, on transactions turning
  `succeeded`, inside the plugin's own database transaction right after its
  decrement): stock below zero goes back to zero, and the order's internal
  notes say which size went beyond stock — *Made to order* or *OVERSOLD —
  contact the customer*. A paid order is never failed.

### Verified

- 9 unit tests (`tests/int/stock.int.spec.ts`); integration suite **137 passing**.
- The live quote, both ways: on → 8 of 6 sold with "2 made to order"; off →
  all 6 sold, 8 refused ("Only 6 left…"), bag shows it, sold out refused.
- **E2E suite 38 passing** (2 new): a made-to-order sale beyond stock is
  charged, stock ends at 0 not −1, the order note reads "Made to order — … M:
  1 beyond ready stock when paid"; with the switch off a sold-out size cannot
  open a payment page. "Decrements stock" now starts from a known figure —
  it relied on ambient stock that other tests spend.
- The product page, both ways, in a browser.
- Dummy stock reset to S 4 · M 6 · L 4 (the data is test data, to be replaced).

### Not done

- The client should still confirm the rule she wants at launch — the switch
  is hers to flip. REQUIREMENTS §9.3 Q8 / CLIENT-REQUEST §6.1.
- ~~No low-stock or oversold alert email~~ — built, §21.

---

## 21. Stock alerts — 24 Sep 2026

An email to the shop when a sale changes stock in a way she asked to hear
about. **All of it is hers to configure** in **Site settings → Stock alerts**:

| Setting | Default | Notes |
|---|---|---|
| Email me about stock | On | Off stops every stock email; the dashboard still shows low stock |
| Stock emails go to | *(empty)* | Empty = "New-order alerts go to", else the contact email |
| Running low at | 2 | Also drives the dashboard's low-stock panel (was hard-coded to 2) |
| When a size runs low · sells out · an order goes beyond stock | All on | Each can be unticked |

- **Crossings, not states.** Each event is worked out from the stock before
  and after the sale (`stockEventFor`), so a size already low does not email
  on every later sale. Only sales alert; editing a figure in the admin never does.
- **Beyond stock** says *"2 to make"* when the product is made to order, and
  *"OVERSOLD by 1. Contact the customer."* when it is not; the subject leads
  with the most serious event.
- Sent after the order commits, on a fresh read — no alert for an order that
  rolled back (`src/email/stockAlert.ts`, scheduled from `stockAfterSale`).
- Empty settings mean the default, never "off": the global row predates the
  fields, so `stockAlertSettings()` applies defaults itself.
- Sizes now read "Al Shaheen Nights, size M" in the alert and the order note
  (the storefront's own `sizeLabel`), and the admin collection is named
  **Sizes & stock** — it was the plugin's "Variants", which the email would
  not have matched.

**Verified:** 9 unit tests (`tests/int/stock-alert.int.spec.ts`); integration
**146 passing**, e2e **38 passing**. A real test purchase beyond stock built
and sent the alert after commit (order 149); Resend refused delivery only
because plumpose.com is not verified — the same state as every shop email.
The settings tab and the email were checked on screen.

---

## 22. Reward wheel — the logic, 25 Sep 2026

The wheel's rules and endpoints are built and tested; the pop-up is next.

**Endpoints** (`src/endpoints/spin.ts`): `GET /api/spin` — heading, words and
each segment's label and colour, **never the odds**; `POST /api/spin
{ email }` — one spin, decided entirely on the server.

**Rules, all hers** (Site settings → Reward wheel):

| Setting | Default |
|---|---|
| Show the wheel to first-time visitors | On (off: hidden, spins refused; issued codes keep working) |
| Heading · words under it | "Before anyone else." · the list copy |
| Extra spins from "Roll again" | 1 — after that it cannot be landed on |
| Only for people who have not ordered yet | Off |
| Spins per device per day | 5 (salted IP hash; a household on one Wi-Fi counts as one) |

Segments, prizes, odds and code lifetime stay in Shop → Reward wheel.

- **The draw** (`src/lib/spin/wheel.ts`, pure): weighted, from the OS CSPRNG;
  inactive, weightless or worthless segments (a "10% off" with no value, or
  over 100%) are never drawn.
- **The prize** is a code of its own — `PLUM-7K4Q-X2`, no look-alike
  characters — single use, **locked to the winning email** (the discount
  engine already refuses it for anyone else), expiring at the end of the day
  in Doha after the segment's days.
- **One prize per email, even under a race:** a unique `winnerEmail` column
  on the winning spin; a second win arriving at the same moment is refused by
  the database and its code withdrawn.
- "Already won" and "has ordered" give the **same** reply, so neither can be
  probed. The winner joins the newsletter list (the copy promises it), and
  the code is emailed after commit (`src/email/spinReward.ts`) as well as
  shown on screen.
- The spin log is now visible (Shop → Wheel spins) as the A8 issued-codes
  report; Discount codes show source, owner and use count.

**Verified against the running server:** no weights in the public data; a
spin won Free delivery and its code zeroed delivery for the winner and was
refused for another email; a second spin refused; **8 simultaneous spins for
one email → exactly 1 winning entry, 1 code**; the 6th spin from one device in
a day refused; with "roll again" made near-certain, spin 1 rolled again,
spin 2 had to be a prize, spin 3 refused; switched off → hidden and refused.
13 unit tests (`tests/int/spin-wheel.int.spec.ts`), integration **157 passing**.
Test spins, codes and subscribers deleted; odds restored.

**Next:** the pop-up (docs/SCREEN-PROMPTS 15 — a preview prompt was given):
when it appears (first visit, once, not at checkout), the spin animation
towards the segment the server chose, and the result screen with the code.

### The pop-up — 25 Sep 2026

`src/components/spin/RewardWheel.tsx`, mounted in the app layout, built to the
approved preview (the client's generated mockup) and SCREEN-PROMPTS 15.

- **When:** once per browser, ~6 s into a visit; never on checkout, order,
  account, sign-in or Track order pages; never again once won or closed
  (localStorage, fails safe to "may show again"). Nothing loads before then.
- **The wheel** is drawn in SVG from the live segments — a prize she adds,
  renames or switches off appears as it is. Labels stay level at every angle
  (they counter-rotate as the wheel turns); the pointer is fixed.
- **The spin:** the server decides first; the wheel then turns five times and
  settles on that segment over 5.2 s (`cubic-bezier(0.12, 0.8, 0.18, 1)` —
  silk, not snap), landing inside the segment, not on its line. Reduced
  motion: no turn, straight to the result. It cannot be closed mid-spin.
- **Roll again** → "One more turn" / "Spin again"; **won** → the segment in
  ink, the others dimmed, "Yours", the code with Copy, "Valid until … · One
  use", Shop the collection. Errors from the server show under the field.
- **Checkout offers the code** in its code field (not applied — it only works
  for the winning email, and checkout says so if the email differs).
- Focus lands on the pop-up itself — not the ×, not the email field (which
  would raise a phone's keyboard before a word is read).

**Verified in a browser**, desktop and iPhone 13: appears at ~5.5 s, spins,
wins, stores the code, does not reappear on the next page, no errors; the
phone layout keeps the email and button on the first screen. The per-device
limit also showed itself locally — every local request shares one address.

**Open:** the centre uses a square crop of the print photograph, which
catches the cream piping. A clean single-shark artwork (Darna Studio's print
file, or a generated one) should replace it — a prompt was given.

## 23. Currency display — 25 Sep 2026

Prices now show in the visitor's currency (REQUIREMENTS C21, S7). **What is
charged is unchanged: always QAR**, priced by `priceOrder()`.

**The rule** (`src/lib/pricing/currency.ts`, pure, shared by server and
browser) is the old site's:

- The hand-set price for the flagship piece (Shop → Currencies, "Price set by
  hand") is sacred. One piece shows exactly it, two pieces exactly twice it.
- Everything else converts at the rate that price implies (price ÷ the anchor,
  QAR 1,399 by default), rounded to the currency's `step`. A stored rate is used
  only when there is no hand-set price. A currency with neither is not offered.
- A letter symbol takes a space ("AED 1,410"), a sign does not ("£285").

**Her switches** (Site settings → Currencies): show prices in other currencies
(on); start from the visitor's location (on); the anchor piece's QAR price
(1399). Off → everyone sees QAR and the header code is plain text again.

**Where it comes from:** `GET /api/locale` reads the host's country header
(Vercel, Cloudflare or CloudFront) and returns that country's currency when it
can be quoted; no header means no guess, QAR. `GET /api/locale/options` lists
countries and quotable currencies, cached for five minutes. Outside production
`?country=GB` stands in for the header.

**In the browser** (`src/providers/Locale/`): pages still render QAR on the
server, so prerendered pages stay prerendered. The browser then swaps in the
visitor's figure. The choice is remembered on the browser and refreshed once a
session, in case she has changed a price. `Money` and `useMoney` do the
formatting, and `ChargedInQar` puts the QAR figure beside a converted one.

**The picker** (`src/components/locale/LocalePicker.tsx`) uses the old site's
words, "Where shall we deliver?". The currency follows the country and can
then be changed on its own. A country she cannot deliver to says why here,
rather than at checkout. It opens from the currency code in the header and
from "Country · CODE" in the footer.

**Where prices changed:** shop cards, the homepage band, the product page
(with "Charged in QAR 1,399.00"), the embroidery fee, the bag ("Charged in QAR
… before delivery"). **Checkout stays in QAR**, what the card is charged, with
one guide line: "About AED 1,430 in UAE Dirham, as a guide — your bank
converts at its own rate." Orders and emails stay in QAR.

**Verified in a browser:**

- From the UAE: product AED 1,410 with the QAR line, embroidery "From AED 160",
  the shop at AED 1,410, header "AED", footer "United Arab Emirates · AED".
- The bag shows AED with "Charged in QAR 1,399.00 before delivery". Checkout
  shows "Pay QAR 1,419.00" with "About AED 1,430".
- In the picker, choosing the UK moved the currency to GBP and the product
  showed £285. Iran showed its blocked reason.
- With no location, QAR and no extra line. With currencies off, QAR and no
  picker. With detection off, QAR with the picker. Both back on, AED again.

5 unit tests (`tests/int/currency.int.spec.ts`). Integration **162 passing**,
e2e 38.

**Also fixed:** the two wheel email tests timed out under the full suite
(importing the sender loaded the Payload config). The pure builder now lives
in `src/email/spinRewardEmail.ts`.

**Note:** Windows does not draw flag emoji, so the picker shows the two
letters there ("🇶🇦" reads "QA"). Other systems show the flag.

## 24. Demo catalogue and data clean-up — 25 Sep 2026

**Data cleared** (local database, backed up first to
`../backups/plumpose-before-demo-2026-09-25.dump`): every test order,
transaction, bag, discount code, spin, webhook log entry and enquiry, plus the
template's `admin@test.com` customer. Kept: her product, photographs, the store
setup from her old site (countries, currencies, delivery, embroidery, FAQs,
settings), the Made for You samples (dev only), and both admin logins.

**Demo catalogue** (`scripts/demo-catalogue.ts`), to see the shop with more
than one piece:

- `pnpm demo:seed` adds 20 pieces in four collections (Pyjama Sets, Robes,
  Slips, Sleep Accessories) with 54 photographs from the Pexels API
  (`PEXELS_API_KEY` in `.env`). Photos are cached in `seed-assets/demo/`
  (gitignored), so a re-seed does not download them again.
- `pnpm demo:remove` deletes all of it, and only that: web addresses starting
  `demo-`, photographs named `demo-pexels-<id>.jpg`. Tested: afterwards only
  her product, its three sizes and its 19 photographs remained.
- The stock covers every state: plenty, low, one size sold out, all sold out,
  made to order, and three pieces with no sizes.
- Refuses to run in production. The photos are stand-ins, never product
  photographs.

**Found by it and fixed:**

- **All sizes sold out, button said "Select a size".** It now says "Sold out"
  and is disabled (`AddToCart.tsx`).
- **Shop cards had no sold-out state.** A quiet "Sold out" now sits beside the
  price when nothing can be ordered (every size gone, not made to order).
- **The bag said "All orders are charged in QAR. before delivery."** when
  showing QAR. The second sentence now appears only beside a converted
  currency.
- **Full-page screenshots showed blank cards and the wheel pop-up.**
  `shoot-storefront.ts` now scrolls through so lazy photographs load, and marks
  the wheel as seen (`SHOOT_WHEEL=on` to see it).
- `pricing-live.int.spec.ts` priced "the first product"; it now finds her
  piece by its web address.

**Worth deciding (not changed):** on a phone the shop is one column, so 21
pieces make a very long page, and the six collection filters wrap onto five
lines before the first piece. Two columns on a phone, and a single scrolling
filter row, are the usual answers.

Integration **162 passing**, e2e 38. The test runs' orders were cleared again
afterwards, and her stock restored to S 4 · M 6 · L 4.

## 25. Does an admin edit reach the live site? — 25 Sep 2026

`scripts/check-admin-reflects.ts`, run against a **production build** (in dev
every page renders fresh, so everything passes there and proves nothing). For
each thing she can edit it saves a change through the admin's REST API (same
hooks as the admin screens), loads the public page, checks the change, then
undoes it and checks again.

**First run: 34 of 41.** Four were the check's own mistakes (the page never
shows that field). Three were real — the prerendered **homepage kept the old**:

- **size price** (Sizes & stock had no refresh hook),
- **collection name** (Collections had none),
- **photo description** (Media had none).

`withStorefrontRefresh()` is now on variants, sizes & colours, collections and
media. **Second run: 39 of 39** shown on the first visit, and every undo too.
Checked afterwards: nothing the check made or changed was left behind.

Covered: Site settings (announcement, contact email, embroidery fee, free
delivery threshold, lead time, wheel heading), product name, size price and
stock, unpublishing, collections, FAQs, Press, Spotted, Reviews, Made for You,
photos, new Pages, Qatar and international delivery fees, embroidery threads,
wheel segments, currencies, countries.

**Not live data, by design:** the FAQ answers are her own words, so "QAR 160
per placement" and "five thread colours" in them do not follow the settings. If
she changes the fee she edits that answer too.

**Dashboard stock line fixed.** It said "23 sizes are down to 2 or fewer",
counting made-to-order sizes at zero (fine by design) and draft pieces, and
naming none. It now reads "6 sizes are sold out" and "12 sizes are down to 2 or
fewer", live pieces only, each with a link to Sizes & stock sorted lowest
first. A related product populates with only a few fields, so the query now
asks for `_status` and `madeToOrder` explicitly. The bag was checked for the
same gap and is fine: + is disabled at 1 of 1.

**Admin menu review** — in the menu but unused by the site: **Header** and
**Footer** (template globals; the header and footer read Site settings and
code). Left in place pending her decision; see the reply of 25 Sep.

## 26. Admin trimmed to what she uses — 25 Sep 2026

Every field on every screen she sees was checked against the storefront and
email code (backup first: `../backups/plumpose-before-admin-trim-2026-09-25.dump`).

**Removed** — screens and fields that edited nothing she could see:

- **Settings → Header** and **Settings → Footer.** The template's globals. The
  storefront's header and footer come from Site settings and code, so those
  screens changed nothing. Globals and their six tables deleted.
- **Products → "You may also like".** Nothing renders it, so a choice there did
  nothing. Field and its `products_id` relation column deleted. Add it back
  together with a section that shows it.

**Hidden** — **Shop settings → Sizes & colours.** S, M and L are set once, and
renaming one renames that size on every product. New products still offer
Size (checked on the create screen).

**Found on the way:** in Payload 3 a hidden collection has **no admin screen at
all** — `/admin/collections/<slug>` answers 404. Comments that said
transactions, bags and sizes were "still reachable by URL" were wrong and are
corrected. The rows are kept and readable through the API as admin; un-hide a
collection to work in it.

Everything else in the menu is in use. The one near-miss is **Content → Pages**:
unused today, kept for terms and privacy pages, whose blocks are still the
template's and unstyled.

The menu is now: **Shop** (Discount codes, Reward wheel, Wheel spins, Sizes &
stock, Products, Orders) · **Content** (Made for You, FAQs, Press, Spotted,
Reviews, Subscribers, Pages, Collections, Media, Enquiries) · **Shop settings**
(Personalisation, Shipping zones, Qatar delivery, Countries, Currencies) ·
**Users** · **Settings** (Site settings).

Integration 162, e2e 38, `pnpm audit:admin` clean. All storefront pages 200.

**Schema pushes in dev prompt on data loss.** Removing a field made the running
dev server stop at "Accept warnings and push schema? (y/N)", which nothing can
answer, and every request hung. Drop the column yourself, then restart the dev
server.

## 27. "The site feels laggy" — measured, 25 Sep 2026

`scripts/perf-probe.ts` measures load, main-thread blocking, frame times while
the intro plays and while wheel-scrolling (Lenis), dropped film frames and
click latency, in Chromium with the GPU on. This machine has an AMD Radeon 740M
(integrated graphics).

**The dev server is most of it.** Click → new page shown:

| | /shop | /our-story | /made-for-you | /shop again |
|---|---|---|---|---|
| `pnpm dev` (3001) | 3,460 ms | 827 ms | 953 ms | 2,491 ms |
| production (3000) | 436 ms | 140 ms | 425 ms | 397 ms |

Dev also sends ~1 MB of JavaScript per page against ~260 KB in production, and
first paint on the homepage is 920 ms against 360 ms. Judge feel on a
production build (`plumpose-prod` in launch.json), never on dev. Builds and
test runs on the same machine slow browsing too.

**Production, laptop (1440×900 at 1×, 1.5× and 2×):** homepage and shop scroll
at 60 fps, no frame over 34 ms. The films drop 0 of 90–120 frames. The server
answers a click in ~3 ms. The one stutter seen (217 ms) was on the first
homepage load after a restart, while images were being resized for the first
time. It did not recur.

**Production, a mid-range phone** (Pixel 7, CPU slowed 4×): 0.5–1.4 s of
start-up work after load (worst single task 546 ms on the homepage), in which
a tap waits. Homepage and product page then scroll at 58–59 fps; the shop has
some stutter (47 fps, worst 383 ms). CPU profile of the homepage start: Next's
module loading ~220 ms and GSAP ~360 ms, including ScrollTrigger.refresh
187 ms (three refreshes: MotionProvider's, HomeHero's after fonts, and
ScrollTrigger's own on load). React hydration itself is small. De-duplicating
the refreshes would save ~15 ms on a laptop, so it was not done alone. The
real phone gain is deferring below-the-fold animation set-up. Not done yet.

**Films are healthy:** H.264 High, fast-start (index at the front), 1.5–3.4
Mbps. The desktop hero (7 MB) downloads in full at once. Instant on localhost;
on a slow connection it competes with the first photographs.

## 28. Phones, films and the shop, fixed and measured — 25 Sep 2026

Measured as an A/B: the previous build (44378e7) on :3002 against this one on
:3000, both production, interleaved, **median of five runs**, Pixel 7 with the
CPU slowed 4×. Single runs varied by ±30%, so no single-run figure is used.

| Page | Worst freeze | Busy after load | Film in first 5 s |
|---|---|---|---|
| Home | 575 → **472 ms** | 1,576 → 1,458 ms | 1.2 → 3.8 MB (16.7 s loop, was 5 s) |
| Our Story | 490 → **344 ms** | 1,392 → 1,220 ms | **12.1 → 4.1 MB** |
| Product | 458 → **357 ms** | 1,387 → 1,275 ms | — |
| Shop | 311 → 302 ms | 1,124 → 1,168 ms | — (now four pieces on the first screen, was one or two) |

**What changed:**

- **Reveals set up on arrival** (`src/motion/Reveal.tsx`, `whenReached()`).
  `Reveal` and `RevealImage` (39 uses) each made a ScrollTrigger at load, and
  every heading was split into lines at load, reveals at the foot of the page
  included. Now an IntersectionObserver waits, and the split, timeline and
  drift trigger are made only when the element arrives. An element already
  above the line, after an anchor jump or a restored scroll, reveals at once.
- **No second full re-measure on the first page** (`MotionProvider`).
  ScrollTrigger refreshes itself on load. The provider's refresh now runs on
  navigations only.
- **The steps sequence is built within a screen of view** (`MadeSteps`). Its
  start state is set at once; the timeline is built later, against a finished
  layout. Checked at step 1, mid-change and step 3 on desktop and phone.
- **Films wait for the page** (`src/utilities/afterPageLoad.ts`). With the
  site's code cached (a visitor arriving on a product, then opening the
  homepage) at 10 Mbit/s, the old build requested the 7 MB hero before the
  first photographs had finished, and the page loaded at 1,282 ms. Now the
  film follows the photographs, and the page loads at 893 ms.
- **The phone hero is the café film**, full portrait frame, 16.7 s. The old
  phone clip (IMG_5839) is only 5 s at 24 fps, so it looped constantly. It now
  plays on Our Story only, as `story-walk`.
- **Phone versions of the portrait films** (`small` on `Film`, used under
  768 px): `hero-mobile` (CRF 25, 3.4 MB; also the phone version of
  `story-cafe`, so the two share a download) and `story-pillow-small` (CRF 25,
  3.8 MB against 5.9 MB). SSIM against a lossless reference is 0.002 lower than
  the desktop encodes, which a phone cannot show. `scripts/encode-videos.sh`
  rebuilds them.
- **Shop on phones:** two to a row, and the collections and sorts are one line
  each that scrolls sideways. Page height 14,800 → 5,364 px on an iPhone 13.
  The embroidery tile spans the row. Each card reveals as it arrives: as one
  group, card 21 trailed card 1 by two seconds, so a quick scroll met blank
  cards. The tile's "From QAR 160" now follows the visitor's currency.

Desktop unchanged: 60 fps, no dropped film frames. Integration 162, e2e 38.

**What is left of the phone start-up** is Next's own module loading (~250 ms
at 4×) and hydrating the homepage's pinned scenes (hero, Philosophy, the
Print's pin), which must exist before the layout below them is measured.

## 29. The remaining requirements — 25 Sep 2026

Eleven items from REQUIREMENTS, built and tested end to end.
`tests/e2e/storefront-extras.e2e.spec.ts` drives each one as she and her
customers would, against a production build. Integration **208** (was 162).

| | What | Where |
|---|---|---|
| **P11** | **Payments** — every checkout, paid or not, with "What happened": *Paid — order #12*, *On the payment page*, *Not paid — left the payment page — card declined once ("…")*. Declines come from the webhook log, matched to the checkout by bag and time. The dashboard shows "N checkouts in the last week were not paid". Read-only. | `lib/payments/outcome.ts`, transactions override |
| **A6 / S19 / A17** | **Spreadsheet downloads** of orders and subscribers, in her words (items, sizes, embroidery as the email reads, totals in riyals, Doha time). The list's filter is kept. UTF-8 with BOM for Arabic names; formula injection blocked. Admin only. | `lib/exports/`, `endpoints/exports.ts`, `ExportButton` |
| **S18 / A15** | **Reviews**: a form on the product page; the average, stars and her reply on the page; the rating in Google's data; "Feature on the homepage". Checked on the server: rating 1–5, a real sentence, a live piece, one per email per piece, five a day per device. *Verified purchase* when the email has an order for it. | `hooks/validateReview.ts`, `ProductReviews`, `ReviewForm`, `Stars` |
| **S15** | **Spotted submissions**: photo, Instagram name, caption, link, permission. The real format is read from the bytes (JPEG/PNG/WebP), 12 MB max, 600 px min; three a day per device. Arrives pending; **rejecting a sent-in photo deletes it**. | `endpoints/spottedSubmit.ts` (POST /api/spotted/submit), `SpottedForm` |
| **A16** | **Enquiries inbox**: New → Read (on opening) → Replied → Archived; From, About and the start of the message as columns; "N new enquiries" on the dashboard. | form-submissions override, `MarkEnquiryRead` |
| **S1 / A18** | **Page text** (Settings): the words of the homepage and eight pages, one tab each, filled with today's text. An emptied field falls back to it, so a page is never blank. *asterisks* set italic in the homepage headline. **Featured piece** on the homepage (falls back if unpublished). | `content/pageTextSchema.ts` (one list → admin fields and merge), `globals/PageText.ts`, `content/getPageText.ts` |
| **N3** | **Sitemap** (fixed pages, published pieces, commissions, pages); **robots.txt** now actually served. It sat inside the `(app)` group, where Next never picks it up, and it pointed at Vercel's preview URL. It keeps crawlers out of admin, API, checkout and accounts. | `app/(app)/sitemap.ts`, `app/robots.ts` |
| **A3** | **Was price** on a piece: shown crossed out in the shop, on the piece and on the homepage; refused unless higher than the price. | products, `WasPrice` |
| **S4 / A4** | **Colour and pattern**: seeded as option types. *Sizes, colours & patterns* back in Shop settings. The picker disables combinations that are not made or are sold out, and says why. "Select a size and colour". The gallery shows the chosen colour's photographs ("Only show for" now works). Stock messages read "Classic (M / Blush)". Demo: `demo-two-colour-set`. | `VariantSelector`, `ProductGallery`, `sizeLabel` |
| **A14** | **Exchange rates**: "Refresh exchange rates" on Currencies; **At today's rate** and **Difference** beside each hand-set price (AED 1,410 vs 1,411: −0.1%). Hand-set prices never change. The dashboard asks for a refresh after 7 days. A daily job can call `GET /api/currencies/refresh-rates` with `Authorization: Bearer $CRON_SECRET` (the admin button uses POST). Rates by Exchange Rate API. | `lib/pricing/rates.ts`, `endpoints/refreshRates.ts` |
| **A1 / N6** | **Login lockout** stated: 5 wrong passwords lock an account for 15 minutes; tested on a real account. | Users auth |

**Holes closed on the way:**

- A public request could create an **already-approved review**: `status` had no field access. It can no longer, and every signed-in customer could read pending reviews and Spotted posts.
- **Deleting a rejected photo** failed on the required `image_id` column. It is now validated, not NOT NULL. ⚠️ Production needs the same change as a migration (`alter table spotted alter column image_id drop not null`).
- The Subscribers comment claimed an export plugin that was never installed.

**Test lessons:**

- On a page with `loading.tsx`, Next keeps a hidden second copy of the streamed page outside `<main>` until it swaps it in (≈2 s on the dev server). Look inside `main`.
- Reveals below the fold are hidden until scrolled to: scroll first.
- Admin labels are CSS-uppercased, so compare text case-insensitively.

## 30. Clean-up, and a refresh race it uncovered — 25 Sep 2026

**Code clean-up:**

- **Removed 14 files nothing used.** From the template: `LoadingSpinner`, `ProductItem`, `OrderStatus`, and `ui/` accordion, card, dialog, pagination, sheet and sonner (the toast container the site mounts is `providers/Sonner.tsx`, so add-to-bag errors do show). Also `getDocument`, `useClickableCard`, `useIgnoredEffect`, `populatePublishedAt` and `adminOrCustomerOwner`.
- **Removed two packages** nothing imported: `next-themes` and `@radix-ui/react-accordion` (276 lockfile lines).
- **Unused imports and variables cleared** everywhere `tsc --noUnusedLocals` found them: 25 files importing `React` for nothing, leftovers in the form and carousel blocks and the page hook, `currentOptions` in the option picker, `PayloadRequest` in the wheel endpoint, and unread loop counters in the seed. The template's skipped e2e suite is left as it is, due for replacement.
- **Prettier applied** to all source, scripts and tests (160 files, layout only), except the generated `payload-types.ts` and `importMap.js`. `prettier --list-different` is now empty.
- The Excel byte-order mark is written as `'﻿'`, not an invisible raw character.
- `pnpm lint` still fails inside `eslint-config-next`'s own config, as before. *(Fixed in §31.)*

**The refresh race.** The reviews e2e check failed on the production build: an approved, featured review never reached the homepage. It passed in any shorter sequence, and the query found the review when run directly. The cause is in how Next applies `revalidatePath`:

- It does not refresh when called. It stamps the time and queues the refresh, and Next applies the queue when the request finishes.
- Payload runs `afterChange` **inside the transaction, before the commit**. A homepage rebuild in that window — here, the browser prefetching `/` from the product page — reads the old data, finishes after the stamp, and is kept as current. The edit is lost until the next one.
- Calling `revalidatePath` again inside `after()` does nothing: that request's queue has already been applied.

**Fix** (`hooks/revalidateStorefront.ts`, `refreshStorefront`): refresh at once as before. Then, after the response (so after the commit), the server POSTs to itself at `/api/storefront/refresh`, signed with an HMAC of PAYLOAD_SECRET (403 without it). It does this twice, at once and two seconds later, so a rebuild already under way is overtaken. Collections, Site settings and Page text all use it.

**Measured:**

| | Runs passed |
|---|---|
| Before the fix | 0–1 in 3 |
| After-commit request once | 2 in 5 |
| Once and again at +2 s | **6 in 6**, then 3 full runs of the file (10 of 10 each) |
| `check-admin-reflects` | 39 of 39 at once |

**The promise:** a saved change is on every prerendered page within about two seconds. The e2e checks poll up to ten seconds rather than assuming the same instant.

⚠️ **On Vercel**, the self-request goes to the deployment's own URL. With Deployment Protection on a preview it gets a 401 and logs "Storefront refresh after the save failed". The production domain is unaffected.

Integration **208**. e2e: the new file 10 of 10 (three runs, production), full suite **48 passed**, 21 skipped (dev).

## 31. Gaps closed: webhook, tests, start-up, lint, admin words — 25 Sep 2026

Eight items were listed as remaining. Three were already done in §19 (enquiry
alert, server-side enquiry checks, Track order email) — §17's follow-ups had
not been struck through; they are now. The other five:

**Webhook recovery for account holders** (§13's known limitation). Settlement
no longer calls the confirm endpoint over HTTP with the shopper's cookie. It
calls the plugin's own confirm-order handler **in process**
(`confirmInProcess`, `src/payments/checkoutSession.ts`) on a local request
made as **the customer the transaction belongs to** — read from the
transaction, never from the caller. Every check the browser path runs still
runs (the atomic claim, `validateSettlement`, stock), in its own database
transaction. The return page and the webhook now take the same path, and
there is no self-request left to fail on a protected Vercel preview. Tested:
`webhook.e2e` "creates a signed-in customer's order when they never come
back" pays on Stripe's page, never returns, and the webhook creates the order
on the account.

**Storefront e2e suite.** `frontend.e2e.spec.ts` (the template's, skipped) is
deleted; `tests/e2e/storefront.e2e.spec.ts` replaces it — every page the
header and footer link to (200, a heading, no uncaught errors), the 404, shop →
piece, choosing a size, the bag (priced by the quote, +/−, survives a reload,
leads to checkout, empties), an account (create, sign out, sign in, refused
the admin), a wrong password, Track order's identical reply and its
validation. 8 tests. The full suite had stopped loading altogether: the
admin spec's seed loads the Payload config as strict ESM, and
`src/utilities/getGlobals.ts` imported bare `next/cache` — the trap this file
and CLAUDE.md already describe. Now `next/cache.js`.

**Phone start-up.** A CPU profile (Pixel 7, CPU 4×) of the product page put
105 ms of one long task in `RevealImage` mounting: the first `gsap.set` of a
style property reads computed style, forcing a whole-page style recalculation
in the middle of hydration — once per reveal on the page. The waiting state
now comes from CSS: `Reveal` and `RevealImage` render `data-reveal-wait`,
`globals.css` hides / closes them while it is there (only once the motion
script runs, so the failsafe still covers a dead script), and GSAP takes over
with `fromTo` on arrival and removes the attribute.

Measured as an A/B — the previous code in `.next-a` on :3000, this in `.next-b`
on :3002, both production, interleaved, **median of five runs**, Pixel 7 at 4×:

| Page | Busy after load | Worst freeze |
|---|---|---|
| Home | 1,208 → **1,098 ms** | 396 → **368 ms** |
| Our Story | 406 → **314 ms** | 225 → **134 ms** |
| Product | 433 → **304 ms** | 367 → **289 ms** |
| Shop | 303 → 368 ms | 257 → 243 ms |

The shop's runs overlap (253–388 against 254–399, plus one outlier of 664), so
no change there. Checked afterwards, scrolling every page to the end with the
wheel on desktop and iPhone 13, and with reduced motion: every reveal ends
shown, identically in both builds. The only frames left closed are the five in
the product page's phone gallery, in both — photographs in the sideways
gallery, which open when swiped to.

What remains of the start-up is loading GSAP itself (~90 ms at 4×), React's
hydration, and the per-frame ticker.

**`pnpm lint`.** `eslint.config.mjs` loaded `eslint-config-next` 16 through
`FlatCompat`, which crashed on the react plugin's circular config before
reading a file. It now spreads the package's flat configs. Of the 22 errors
that then appeared, 6 were fixed (the dashboard's five `<a>` links to admin
pages are `Link`s; `tailwind.config.mjs` imports instead of `require`). The
other 16 are the React Compiler readiness checks new in react-hooks 7 —
`set-state-in-effect` for reading storage or the session in an effect,
`purity` for `Date.now()` in the dashboard, which is a server component — and
are warnings: the app does not use the compiler, and the flagged code works
and is tested. Now **0 errors, 97 warnings**.

**Admin words.** The product's list of sizes was headed *Available variants*
(a plugin translation) with a *Variant options* column (a hard-coded label on
the variants collection): now *Sizes & stock* and *Size, colour or pattern*.
The same screen said *Enable QAR price* and, under the price, the plugin's
note about "variants enabled … sorting and filtering". The relabel map already
had `priceInQAREnabled`, but the plugin nests the price in an unnamed group
and row, and the map only looked at top-level fields — so neither it nor
`PriceCell` had ever applied there. `mapFieldsDeep` walks into those; the
price now reads *Set a price* / *Price (QAR)* with "The price shown in the
shop. A size with its own price is charged at that price instead."
`pnpm audit:admin`: no problems.

**Tooling.** `next.config.ts` takes `NEXT_DIST_DIR`, so a second production
build can sit beside the first for an A/B; `/.next-*/` is gitignored. Delete
those folders afterwards — Tailwind scans every unignored file, and before the
ignore rule the build output broke the dev server's CSS ("Parsing CSS source
code failed" on class names made from minified code).

**Also seen, not changed:** her size M shows 0 in stock — the checkout specs
buy it and reset it to a fixed number, and the versions show it at 0 before
this work began; the docs' "S 4 · M 6 · L 4" is out of date. A draft product
with no title, updated today, is in the products list. Both are hers to
decide.

Integration **208**. E2E: the full suite, **57 passed, none skipped** (dev, one worker, 4 min). `pnpm lint`: 0 errors. `tsc`: 0 errors.
