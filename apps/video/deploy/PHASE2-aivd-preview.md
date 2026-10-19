# Phase 2: aivd-preview host cutover

This is the runbook for switching the public preview host from
`dreamutopia-video.pages.dev` to `aivd-preview.pages.dev`. Do not apply it
until the new Pages host, auth callbacks, and Stripe TEST webhook are ready.

## Runtime variable names

Set these names on the app Worker and keep the values environment-specific:

- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `BETTER_AUTH_URL`
- `AI_CALLBACK_URL`
- `NEXT_PUBLIC_IS_PREVIEW`
- `NEXT_PUBLIC_SUPPORT_EMAIL` (optional; leave empty to omit support-email UI)

## Secret and credential names

The switch must preserve or configure these names without putting their values
in this repository:

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CALLBACK_HMAC_SECRET`
- `STORAGE_ACCESS_KEY`
- `STORAGE_SECRET_KEY`
- `CREEM_API_KEY`
- `CREEM_WEBHOOK_SECRET`

## Command order

1. Set the runtime variables and secrets above in the target Worker, with
   `APP_URL`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`, and `AI_CALLBACK_URL`
   using the new public host. Keep `NEXT_PUBLIC_IS_PREVIEW` enabled for this
   preview deployment.
2. Add the Google OAuth redirect URI for
   `/api/auth/callback/google` on the new host, and keep the old URI until the
   acceptance check is complete.
3. Add the Stripe TEST webhook endpoint at
   `/api/webhooks/stripe` on the new host.
4. Build and deploy the app Worker:

   ```bash
   pnpm -C apps/video run cf:build
   pnpm -C apps/video run cf:deploy
   ```

5. Confirm the new host is serving the app and that auth and Stripe TEST
   callbacks reach the intended Worker.
6. Activate the old-host redirect proxy last. Copy the finalized phase-2
   worker into the old Pages project and deploy that Pages project:

   ```bash
   cp apps/video/deploy/pages-proxy/_worker.redirect-phase2.js apps/video/deploy/pages-proxy/public/_worker.js
   pnpm -C apps/video exec wrangler pages deploy deploy/pages-proxy/public --project-name <old-pages-project>
   ```

The phase-2 proxy redirects normal old-host traffic while keeping exactly
`/api/auth`, `/api/auth/*`, `/api/webhooks`, and `/api/webhooks/*` proxied to
the old Worker. Roll back by restoring the phase-1 `public/_worker.js` and
redeploying that Pages project.
