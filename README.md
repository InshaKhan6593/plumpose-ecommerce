# plumpose

Luxury silk sleepwear store for [plumpose](https://plumpose.com), Qatar.

Next.js + Payload CMS, built so the owner can manage products, orders,
promotions and content herself without a developer.

---

## Status

Phase 1 complete — data model and admin panel.
Storefront and payments not started. See [docs/BUILD-LOG.md](docs/BUILD-LOG.md).

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
| Payments | SkipCash *(pending credentials)* |

Base currency is **QAR**, stored in minor units — `139900` is QAR 1,399.00.

---

## Running locally

Requires **Node 24.15+**, pnpm and Docker.

```bash
docker run -d --name plumpose-pg \
  -e POSTGRES_USER=plumpose -e POSTGRES_PASSWORD=plumpose -e POSTGRES_DB=plumpose \
  -p 5433:5432 postgres:16
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

The seed is idempotent and safe to re-run. Product photography lives in
`seed-assets/`, which is not committed — the seed skips missing files and
carries on.

---

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm seed` | Seed reference and demo data |
| `pnpm audit:admin` | Print every collection's resolved admin config and flag gaps |
| `pnpm shoot:admin` | Screenshot all admin screens (logs in as the dev fixture) |
| `pnpm generate:types` | Regenerate `payload-types.ts` |
| `pnpm generate:importmap` | Regenerate the admin import map |
| `pnpm test:int` | Integration tests |
| `pnpm test:e2e` | Playwright end-to-end tests |

Two ad-hoc helpers for chasing a single layout problem:

```bash
npx tsx scripts/shoot-one.ts "/admin/collections/products/1" "Price & sizes" out
npx tsx scripts/inspect-one.ts "/admin/collections/products/1" "Price & sizes"
```

> On Git Bash, prefix these with `MSYS_NO_PATHCONV=1` — otherwise a
> leading-slash argument is rewritten into a Windows path.

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
