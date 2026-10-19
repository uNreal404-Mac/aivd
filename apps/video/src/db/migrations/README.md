# Cloudflare D1 migrations

The video app uses Cloudflare D1. Drizzle-generated migrations and metadata in
this directory are the source of truth.

Apply migrations locally:

```bash
pnpm db:migrate:local
```

Apply migrations to the configured remote D1 database:

```bash
pnpm db:migrate
```

Wrangler records applied files in D1's `d1_migrations` table, so an already
applied migration is not run again.

## Grant a Super Account role

Run this only for a user who has already registered, replacing the email:

```bash
pnpm exec wrangler d1 execute dreamutopia-db --remote --command \
  "UPDATE user SET isSuperAccount = 1 WHERE lower(email) = lower('user@example.com');"
```

This role is independent of payment and subscription status.
