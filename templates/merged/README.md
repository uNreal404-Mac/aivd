# Merged SaaS Template Skeleton

Fused strengths from **shipany-tanstack**, **mkfast-app**, and **seo-site-template**.

See [MERGE_NOTES.md](./MERGE_NOTES.md) for source mapping and plan.

## Modules

| Module | Status | Primary source |
|--------|--------|----------------|
| Auth / Login | skeleton + references | mkfast (+ shipany RBAC) |
| Credits | skeleton + references | mkfast + shipany |
| Payment | skeleton + references | mkfast providers + shipany extras |
| Admin | access skeleton | shipany |
| SEO | merged helpers | mkfast + seo-site |
| Pages | stubs | all |

## Quick start (when promoting to a site)

1. Copy this folder to a new app or wire it into your TanStack Start project.
2. Copy `.env.example` → `.env` and fill placeholders locally (never commit secrets).
3. Keep `GENERATION_ENABLED=false` unless you intentionally enable generation APIs.
4. Install deps from `package.json` outline and adapt import paths.

## License notes

Upstream templates retain their own licenses (see each source repo). This merge is for CharlesHarry7 internal reuse under `dreamutopia-clone`.
