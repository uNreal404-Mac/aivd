# Database Migrations

## ⚠️ No drizzle journal yet

This repo currently has **no** drizzle `meta/` snapshot or `_journal.json`.
The schema was originally created with `drizzle-kit push` (`db:push`), so the
`src/db/migrations` directory contains plain, numbered `.sql` files instead of
drizzle-generated migration bundles.

## How to apply migrations

Apply the files **manually, in numeric order**, against your database:

```bash
psql "$DATABASE_URL" -f src/db/migrations/0001_credit_packages_order_no_unique.sql
```

If you use a different client, run the file's contents the same way — each file
is self-contained and ordered by its numeric prefix (`0001_`, `0002_`, ...).

All migrations in this directory are written to be **idempotent**, so re-running
them is safe.

## Migration index

| File | Purpose |
| --- | --- |
| `0001_credit_packages_order_no_unique.sql` | Dedupes non-null `credit_packages.order_no` values (keeping the earliest row per `order_no`, renaming the rest to `order_no \|\| '_dup_' \|\| id`), then creates the unique index `credit_packages_order_no_unique` on `credit_packages (order_no)`. |
| `0003_gallery.sql` | Adds gallery columns to `videos` (`visibility`, `published_at`, `gallery_title`, `gallery_description`, `public_prompt`, `prompt_protected`, `assets_reusable`), adds `user.isSuperAccount`, and creates the `videos_visibility_published_idx` index on `videos (visibility, published_at)`. |

## Baseline before using drizzle-kit generate

Because the current database was created via `db:push`, **do not** run
`db:generate` against an existing database before baselining. Doing so will make
drizzle believe the entire schema still needs to be created.

Recommended baseline flow:

1. Apply all numbered files in this directory in order (see above).
2. Generate a snapshot that matches the current database state (baseline).
3. Only then start using `db:generate` for new migrations.
