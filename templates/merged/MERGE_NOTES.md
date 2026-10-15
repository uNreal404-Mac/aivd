# Template Merge Notes / 合并说明

**Branch:** `feat/templates-merged`  
**Target path:** `templates/merged` inside `CharlesHarry7/dreamutopia-clone`  
**Constraint:** PR only — no production deploy / wrangler production secrets changed.  
**GENERATION_ENABLED:** left untouched in root `wrangler.toml` (remains `"false"`).

## Sources

| Source | Stack | Strengths taken |
|--------|-------|-----------------|
| [shipany-tanstack](https://github.com/saas-sources-org/shipany-tanstack) | TanStack Start + better-auth + Drizzle | Rich **admin** (RBAC, credits/payments admin), multi-provider **payment** (Stripe/Creem/PayPal/Alipay/WeChat), mature **credits** module |
| [mkfast-app](https://github.com/saas-sources-org/mkfast-app) | TanStack Start + better-auth + CF D1 | Clean **auth** UX, **credits** packages/redemption, payment providers with e2e (Stripe/Creem/Waffo), `lib/seo.ts` + sitemap |
| [seo-site-template](https://github.com/CharlesHarry7/seo-site-template) | Vinext/Next + CF Workers | Strong **SEO** (build-sitemap, robots, alternates), team billing, credit ledger patterns, checkout flow |

## Merge plan (what wins)

1. **Auth (登录)** — Primary: mkfast `src/auth` (+ shipany RBAC helpers). better-auth email/password + Google OAuth stubs.
2. **Credits (积分)** — Primary: mkfast credits packages/redemption + shipany admin credit handlers; ledger ideas from seo-site.
3. **Payment (支付)** — Primary: mkfast provider interface (Stripe/Creem/Waffo) + shipany extra providers (PayPal/Alipay/WeChat) as optional adapters.
4. **Admin (后台)** — Primary: shipany admin-access / RBAC skeleton; mkfast admin users/redemptions/tasks patterns referenced in docs.
5. **Pages** — Marketing/pricing/settings stubs under `src/pages` pointing at fused modules.
6. **SEO** — Fuse mkfast `seo.ts`/`sitemap.ts` with seo-site `build-sitemap` + `robots` patterns into `src/seo/merged-*`.

## Layout under `templates/merged`

```
templates/merged/
  MERGE_NOTES.md          # this file
  README.md
  package.json            # dependency outline (not a runnable monorepo root)
  .env.example            # placeholders ONLY — no real secrets
  src/
    auth/                 # mkfast + shipany references + merged facade
    credits/
    payment/
    admin/
    seo/
    pages/
    index.ts              # public barrel
```

## Security / cost

- Zero new paid cloud spend for this PR.
- No `.env`, keys, tokens, or private keys committed.
- Do not enable `GENERATION_ENABLED` in production wrangler.

## Known gaps

- This is a **fusion skeleton**, not a fully wired runnable app (deps/paths still need wiring when you promote it to a standalone site).
- Vendor copies under `src/*/mkfast|shipany|seo-site` are reference modules for porting; prefer importing from `src/*/merged-*` facades.
- Full admin UI routes and i18n message catalogs are not fully copied (size/context limits).
