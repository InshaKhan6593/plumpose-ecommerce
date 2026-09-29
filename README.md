# plumpose

Luxury silk sleepwear store for [plumpose](https://plumpose.com), Qatar.

Next.js + Payload CMS, built so the owner can manage products, orders,
promotions and content herself without a developer.

---

## Status

**Backend.** Data model, admin panel and the commerce engine are built. A full
purchase runs end to end against the SkipCash sandbox: bag → priced → paid →
order, with the money breakdown, embroidery instructions, stock decrement and
the discount ledger. The payment webhook is the source of truth. Order emails
(confirmation, new-order alert, shipped, resend, password reset) go through
Resend.

**Storefront.** Built from the approved mockups and the client's reference
animation: homepage (full-screen film hero, curtain, The Print, a pinned "made
for you" sequence), shop, product page with the hand
embroidery drawer, bag drawer, branded header, footer and not-found page. Motion
is GSAP + ScrollTrigger + Lenis, and all of it switches off under
`prefers-reduced-motion`.

**Checkout.** Contact, delivery (Qatar city picker; blocked countries say why),
gift note and discount code, priced live; payment on SkipCash's own page (a
redirect); a confirmation page reached by the
order's private link.

**Content pages.** Our Story (with the café film and her illustration films),
FAQ, Shipping & Returns, Made for You with project pages, Press, Spotted,
Contact (enquiry form) and Track order. Her corrections of 27 Sep 2026 are in;
any wording still to confirm is hers to change in the admin (Page text, Site
settings) — see [docs/BUILD-LOG.md](docs/BUILD-LOG.md) §40 and §62. The pieces are **designed
in Doha**, not made there: never write "hand-finished in Doha".

**Search.** Canonicals, branded titles and descriptions, Product / ProductGroup,
Organization and breadcrumb structured data, real 404s, a sitemap without
demo or sample records (BUILD-LOG §39). An SEO audit scored 54, then 70 after
the fixes; on plumpose.com it scored 69, and ~76 with the §58 fixes. Google
Search Console is verified and the sitemap submitted; the product page passes
Product snippets and Merchant listings (§62). **Google Analytics 4** counts
visits and sales in QAR, with private order links kept out of it (§63).

**Accounts.** Sign in, create an account, password reset on the storefront,
orders, saved addresses (Qatar city picker; they pre-fill checkout), details.

**Reward wheel.** First-visit pop-up, prizes and rules set in the admin.

**Currencies.** Prices in the visitor's currency, from their location or the
country picker; always charged in QAR. On/off in Site settings.

**Also:** payments she can follow up (paid or not), spreadsheet downloads of
orders and subscribers, reviews with approval and replies, customer Spotted
submissions, an enquiries inbox, editable page text, a sitemap, sale prices,
colours and patterns, exchange-rate checks — see BUILD-LOG §29.

**Orders.** Known by a code (PLM-260928-7K4QX2), the same as the SkipCash Transaction ID. She can mark one Cancelled or Refunded after refunding in SkipCash, and the customer is emailed. Checkout can be paused in Site settings → Orders; it is open on the live site since SkipCash production went in (29 Sep 2026).

Payments run on **SkipCash production** since 29 Sep 2026 (BUILD-LOG §61); local development stays on the sandbox. 298 integration tests (297 pass; the other needs SkipCash's sandbox, which they switched off on 29 Sep) and 62 end-to-end tests (all passed on 28 Sep; they too need the sandbox).

**Hosting.** Vercel, and only Vercel (decided 26 Sep 2026). Live at
https://plumpose.com since 28 Sep 2026 (plumpose.vercel.app redirects there).
The shop needs **Vercel Pro, $20/month**, because the free plan does not allow
commercial use.

See [docs/BUILD-LOG.md](docs/BUILD-LOG.md) for detail and
[CLAUDE.md](CLAUDE.md) for the briefing.

---

## Stack

| Layer         | Choice                                      |
| ------------- | ------------------------------------------- |
| Framework     | Next.js 16 (App Router), React 19           |
| CMS / backend | Payload 3.90.2, in the same app             |
| Database      | PostgreSQL                                  |
| Commerce      | `@payloadcms/plugin-ecommerce`              |
| Styling       | TailwindCSS 4 + shadcn/ui                   |
| Language      | TypeScript                                  |
| Payments      | SkipCash (production; sandbox locally) — see below |
| Hosting       | Vercel — Pro ($20/month) for the live shop  |
| Media         | Cloudflare R2 (EU)                          |

Base currency is **QAR**, stored in minor units — `139900` is QAR 1,399.00.

---

## Running locally

Requires **Node 20.9+** (`engines`: `^18.20.2 || >=20.9.0`) and pnpm.

The app runs against the **live services**: the Neon database and the R2
bucket. Their keys go in `.env` (see `.env.example`):

```bash
cp .env.example .env    # then fill in PAYLOAD_SECRET, the DATABASE_URLs and the R2 keys
pnpm install
pnpm dev
```

Storefront at `http://localhost:3000`, admin at `/admin`.

Development against the live database is guarded: Payload never pushes schema
changes there (a schema change needs a migration — `pnpm payload
migrate:create <name>`, then `pnpm payload migrate` against
`DATABASE_URL_DIRECT`), the dev admin is never created there, and the e2e suite
refuses to run against it. See CLAUDE.md.

**Docker is kept** for the integration tests, which always use it, and for
working offline (swap `LOCAL_DATABASE_URL` into `DATABASE_URL`):

```bash
docker run -d --name plumpose-pg   -e POSTGRES_USER=plumpose -e POSTGRES_PASSWORD=plumpose -e POSTGRES_DB=plumpose   -p 5434:5432 postgres:16
```

**The client's media is not in this repository** — it is public, and the
photography and film are hers and unreleased. Photographs live in R2 (uploaded
by the seed), films in R2 under `video/` (`pnpm films:upload` / `films:fetch`).
To seed a fresh database, copy `brand-assets/product/*.jpg` into `seed-assets/`
as `brand-01-window.jpg` … `brand-07-qatar-book.jpg` (the names are in
`src/seed/index.ts`), then:

```bash
pnpm seed                                  # her real data; idempotent
SEED_SAMPLES=yes pnpm seed                 # … plus the sample Made-for-You projects
SEED_SAMPLES=yes pnpm demo:seed            # 21 demo pieces, for testing
pnpm demo:remove                           # every sample out, her data stays
npx tsx scripts/create-admin.ts you@example.com "Your Name"
```

---

## Scripts

| Command                                            | Purpose                                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                                         | Development server                                                                                                                                                                   |
| `pnpm seed`                                        | Seed her real data (and, with `SEED_SAMPLES=yes`, the sample projects)                                                                                                               |
| `pnpm demo:seed` / `pnpm demo:remove`              | Add or remove the 21-piece demo catalogue (Pexels photos; needs `PEXELS_API_KEY`). On the live database only with `SEED_SAMPLES=yes`; `demo:remove` also deletes the sample projects |
| `pnpm films:upload` / `pnpm films:fetch`           | Films to / from R2 (`public/video` is not in the repo)                                                                                                                               |
| `npx tsx scripts/create-admin.ts <email> "<name>"` | First admin on a database — hidden password prompt; refuses if one exists                                                                                                            |
| `npx tsx scripts/check-r2.ts`                      | Checks the R2 keys: write, read, list, delete, private                                                                                                                               |
| `pnpm audit:admin`                                 | Print every collection's resolved admin config and flag gaps                                                                                                                         |
| `pnpm shoot:admin`                                 | Screenshot all admin screens (logs in as the dev fixture)                                                                                                                            |
| `pnpm generate:types`                              | Regenerate `payload-types.ts`                                                                                                                                                        |
| `pnpm generate:importmap`                          | Regenerate the admin import map                                                                                                                                                      |
| `pnpm test:int`                                    | Integration tests                                                                                                                                                                    |
| `pnpm test:e2e`                                    | Playwright end-to-end tests                                                                                                                                                          |
| `pnpm test-shots`                                  | Import AI-generated **test** photographs from `../brand-assets/test-shots/` (shown only while `TEST_SHOTS=on`; never for launch — see `../docs/TEST-SHOTS.md`)                       |
| `npx tsx scripts/shoot-storefront.ts [paths…]`     | Screenshot storefront pages at desktop and phone size, full page and first screen, with console errors                                                                               |
| `sh scripts/encode-videos.sh`                      | Rebuild the web film from the camera originals                                                                                                                                       |
| `sh scripts/record/reset-demo.sh build\|reset`     | The demo database for the client's tutorial videos (see `scripts/record/README.md`)                                                                                                 |

Two ad-hoc helpers for chasing a single layout problem:

```bash
npx tsx scripts/shoot-one.ts "/admin/collections/products/1" "Price & sizes" out
npx tsx scripts/inspect-one.ts "/admin/collections/products/1" "Price & sizes"
```

> On Git Bash, prefix these with `MSYS_NO_PATHCONV=1` — otherwise a
> leading-slash argument is rewritten into a Windows path.

---

## Payments

**SkipCash**, the Qatari gateway, in `src/payments/skipcash/`. Four keys from
the Merchant Portal (Online Payments → generate a private key) go in `.env`:

```bash
PAYMENT_PROVIDER=skipcash
SKIPCASH_ENV=sandbox          # or production
SKIPCASH_CLIENT_ID=
SKIPCASH_KEY_ID=
SKIPCASH_KEY_SECRET=
SKIPCASH_WEBHOOK_KEY=
```

Without all four, checkout says payments are not switched on.

- **It is a redirect flow.** "Pay" registers the payment with SkipCash and
  sends the customer to its page; they come back to `/checkout/return?id=…`,
  which asks SkipCash what happened and creates the order. The webhook
  (`/api/payments/skipcash/webhooks`) does the same if they never come back.
- **Never charge `cart.subtotal`.** The plugin's own adapters do, and it omits
  delivery, embroidery and discounts — QAR 1,399 for a bag that costs QAR
  1,579. The adapter prices through `priceOrder()`.
- **Webhooks cannot reach localhost.** Locally the return page settles the
  order. On a public https address the store sends its webhook URL with every
  payment.
- **Sandbox test card:** 5200 0000 0000 0007, 04/27, CVV 256 — no 3-D Secure
  (checkout shows it in sandbox). The 3-D Secure card, 4000 0000 0000 2503,
  fails on SkipCash's sandbox with "Empty TermURL for the CRes POST" before it
  returns to us. More at dev.skipcash.app → Test Cards.

**Production (live since 29 Sep 2026).** The four production values and
`SKIPCASH_ENV=production` are **Vercel environment variables only** — never in
the local `.env`, which stays on the sandbox because the test suites pay
through it. The portal's Production settings take the webhook URL
(`https://plumpose.com/api/payments/skipcash/webhooks`) and the return URL
(`https://plumpose.com/checkout/return`). Production has no test cards: test
with a real card for a small amount (a one-use fixed-amount discount code),
then refund it in the portal. See [docs/BUILD-LOG.md](docs/BUILD-LOG.md) §61.

See [docs/BUILD-LOG.md](docs/BUILD-LOG.md) §32.

---

## Notes for anyone picking this up

**Build from the release tag, not `main`.** The upstream Payload ecommerce
template on `main` imports APIs that are not in the published packages and will
not compile. This project pins every `@payloadcms/*` package to one exact version (now `3.90.2`); upgrade them together.

**Money is stored in minor units.** Anything rendering a price needs a
formatter — see `src/components/admin/PriceCell.tsx`.

**Order money fields are locked.** `amount`, `currency`, `status` and
`transactions` are read-only at field level. The payment gateway is the source
of truth, and a hand-edited total silently breaks reconciliation.

**Adding a collection?** Run `pnpm audit:admin` afterwards. It catches missing
groups, missing `useAsTitle`, absent columns, and columns that point at fields
which do not exist.

---

## Project docs

- [docs/BUILD-LOG.md](docs/BUILD-LOG.md) — what has been built, tested, and not
