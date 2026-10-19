# Phase 2: aivd-preview host cutover

Do not apply this change in phase 1. `apps/video/wrangler.jsonc` must remain
unchanged until the new Pages host is ready.

## `wrangler.jsonc` var changes

```diff
--- a/apps/video/wrangler.jsonc
+++ b/apps/video/wrangler.jsonc
@@
-    "NEXT_PUBLIC_APP_URL": "https://dreamutopia-video.pages.dev",
+    "NEXT_PUBLIC_APP_URL": "https://aivd-preview.pages.dev",
@@
-    "AI_CALLBACK_URL": "https://dreamutopia-video.pages.dev/api/v1/video/callback",
+    "AI_CALLBACK_URL": "https://aivd-preview.pages.dev/api/v1/video/callback",
```

Deploy the app with the new public URL:

```bash
NEXT_PUBLIC_APP_URL='https://aivd-preview.pages.dev' pnpm -C apps/video run cf:deploy
```

## Checklist

- [ ] Add Google OAuth redirect URI `https://aivd-preview.pages.dev/api/auth/callback/google` and keep the old URI.
- [ ] Add a Stripe TEST webhook endpoint at `https://aivd-preview.pages.dev/api/webhooks/stripe`.
- [ ] Switch `APP_URL` and deploy with the two `wrangler.jsonc` var changes above.
- [ ] Enable the old-domain 301 by deploying `deploy/pages-proxy/_worker.redirect-phase2.js` as the old Pages proxy's `public/_worker.js`.

The Stripe route above is the route currently implemented at
`src/app/api/webhooks/stripe/route.ts`.
