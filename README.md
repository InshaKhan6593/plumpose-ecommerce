# plumpose

Luxury silk sleepwear store for [plumpose](https://plumpose.com), Qatar.

Next.js + Payload CMS, built so the owner can manage products, orders,
promotions and content herself without a developer.

---

## Status

**Backend.** Data model, admin panel and the commerce engine are built. A full
purchase runs end to end against the Stripe sandbox: bag → priced → paid →
order, with the money breakdown, embroidery instructions, stock decrement and
the discount ledger. The payment webhook is the source of truth. Order emails
(confirmation, new-order alert, shipped, resend, password reset) go through
Resend.

**Storefront.** Built from the approved mockups and the client's reference
animation: homepage (full-screen film hero, curtain, floating photographs, The
Print, a pinned "made for you" sequence), shop, product page with the hand
embroidery drawer, bag drawer, branded header, footer and not-found page. Motion
is GSAP + ScrollTrigger + Lenis, and all of it switches off under
`prefers-reduced-motion`.

**Checkout.** Contact, delivery (Qatar city picker; blocked countries say why),
gift note and discount code, priced live; payment on Stripe's hosted page (a
redirect, the same shape as SkipCash); a confirmation page reached by the
order's private link.

**Content pages.** Our Story (with the café film), FAQ, Shipping & Returns,
Made for You with project pages, Press, Spotted, Contact (enquiry form) and
Track order. Some copy is placeholder until the client confirms it — see
[docs/BUILD-LOG.md](docs/BUILD-LOG.md) §17.

**Accounts.** Sign in, create an account, password reset on the storefront,
orders, saved addresses (Qatar city picker; they pre-fill checkout), details.

**Reward wheel.** First-visit pop-up, prizes and rules set in the admin.

**Currencies.** Prices in the visitor's currency, from their location or the
country picker; always charged in QAR. On/off in Site settings.

SkipCash is pending credentials. 162 integration and 38 end-to-end tests pass.

See [docs/BUILD-LOG.md](docs/BUILD-LOG.md) for detail and
[CLAUDE.md](CLAUDE.md) for the briefing.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| CMS / backend | Payload 3.90.1, in the same app |
| Database | PostgreSQL |
| Commerce | `@payloadcms/plugin-ecommerce` |
| Styling | TailwindCSS 4 + shadcn/ui |
| Language | TypeScript |
| Payments | SkipCash *(pending credentials)* — Stripe sandbox in dev, see below |

Base currency is **QAR**, stored in minor units — `139900` is QAR 1,399.00.

---

## Running locally

Requires **Node 20.9+** (`engines`: `^18.20.2 || >=20.9.0`), pnpm and Docker.

```bash
docker run -d --name plumpose-pg \
  -e POSTGRES_USER=plumpose -e POSTGRES_PASSWORD=plumpose -e POSTGRES_DB=plumpose \
  -p 5434:5432 postgres:16
```

```bash
cp .env.example .env    # then fill in PAYLOAD_SECRET and DATABASE_URL
pnpm install
pnpm dev
```

Storefront at `http://localhost:3000`, admin at `/admin`.

```bash
pnpm seed
```

The seed is idempotent and safe to re-run.

**The client's media is not in this repository** — it is public, and the
photography and film are hers and unreleased. After cloning, with the client's
`brand-assets/` folder beside `plumpose/`:

- **Photographs:** copy `brand-assets/product/*.jpg` into `seed-assets/` as
  `brand-01-window.jpg` … `brand-07-qatar-book.jpg` (the names are in
  `src/seed/index.ts`), then run `pnpm seed`. Missing files are skipped.
- **Film:** `sh scripts/encode-videos.sh` rebuilds `public/video/` from the
  camera originals (needs ffmpeg).

---

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm seed` | Seed reference and demo data |
| `pnpm demo:seed` / `pnpm demo:remove` | Add or remove a 20-piece demo catalogue (Pexels photos; needs `PEXELS_API_KEY`). Development only |
| `pnpm audit:admin` | Print every collection's resolved admin config and flag gaps |
| `pnpm shoot:admin` | Screenshot all admin screens (logs in as the dev fixture) |
| `pnpm generate:types` | Regenerate `payload-types.ts` |
| `pnpm generate:importmap` | Regenerate the admin import map |
| `pnpm test:int` | Integration tests |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm test-shots` | Import AI-generated **test** photographs from `../brand-assets/test-shots/` (shown only while `TEST_SHOTS=on`; never for launch — see `../docs/TEST-SHOTS.md`) |
| `npx tsx scripts/shoot-storefront.ts [paths…]` | Screenshot storefront pages at desktop and phone size, full page and first screen, with console errors |
| `sh scripts/encode-videos.sh` | Rebuild the web film from the camera originals |

Two ad-hoc helpers for chasing a single layout problem:

```bash
npx tsx scripts/shoot-one.ts "/admin/collections/products/1" "Price & sizes" out
npx tsx scripts/inspect-one.ts "/admin/collections/products/1" "Price & sizes"
```

> On Git Bash, prefix these with `MSYS_NO_PATHCONV=1` — otherwise a
> leading-slash argument is rewritten into a Windows path.

---

## Payments

**Stripe sandbox is a development harness, not the gateway.** SkipCash is the
real one and is still pending credentials. Stripe is wired so the work
downstream of a successful payment — order creation, stock, discounts, email —
is not blocked behind them.

```bash
PAYMENT_PROVIDER=stripe   # anything else, or empty, disables it
```

It refuses to load when `NODE_ENV` is production. Webhooks cannot reach
localhost, so forward them:

```bash
stripe login
pnpm stripe-webhooks      # forwards the four payment events to localhost:3000
```

Two things to know before building on it:

- **It is a redirect flow, like SkipCash.** Payment happens on Stripe's hosted
  Checkout page and the customer comes back to `/checkout/return`; the webhook
  creates the order if they never do. When SkipCash arrives only the adapter
  and the webhook's signature check change — see
  `src/payments/checkoutSession.ts`.
- **Never charge `cart.subtotal`.** The plugin's own adapters do, and it omits
  delivery, embroidery and discounts — QAR 1,399 for a bag that costs QAR
  1,579. Price through `priceOrder()`, as `src/payments/stripeSandbox.ts` does.

See [docs/BUILD-LOG.md](docs/BUILD-LOG.md) §13 and §16 for the full picture.

---

## Notes for anyone picking this up

**Build from the release tag, not `main`.** The upstream Payload ecommerce
template on `main` imports APIs that are not in the published packages and will
not compile. This project is pinned to `3.90.1` throughout.

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
