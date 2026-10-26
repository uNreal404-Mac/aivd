# AIVD admin console

The admin console is served at `/{locale}/admin` and uses a dedicated,
server-validated login at `/{locale}/admin-login`. It does not reuse or modify
the customer login, payment, or video-provider integrations.

## Required secrets

The default administrator username is `aivd001`. The password is never stored
in Git. Generate a PBKDF2 hash locally and store only that value as a
Cloudflare Worker secret:

```bash
pnpm admin:hash-password -- '<password>'
pnpm exec wrangler secret put ADMIN_PANEL_PASSWORD_HASH
```

Also configure an independent random signing secret of at least 32 characters:

```bash
pnpm exec wrangler secret put ADMIN_PANEL_SESSION_SECRET
```

Optionally override the username with `ADMIN_PANEL_USERNAME`. The production
password itself must not be placed in `.env.example`, `wrangler.jsonc`, GitHub,
client-side JavaScript, or a public deployment variable.

## D1 migration

Apply `src/db/migrations/0002_admin_console.sql` before opening the admin
console. The migration only adds account moderation fields and an append-only
admin audit table.

## Security included in this version

- PBKDF2-SHA256 password verification on the server.
- Signed, HttpOnly, SameSite=Strict, eight-hour admin session cookie.
- Same-origin checks for every admin mutation.
- Login throttling per Worker isolate.
- Server-side authorization on admin APIs and pages.
- Immediate session revocation when a customer account is banned.
- Append-only audit records for role, ban, and credit changes.
- No indexing metadata on admin routes.

For a public production launch, put the admin route behind Cloudflare Access
as a second authentication layer and restrict it to named team members.
