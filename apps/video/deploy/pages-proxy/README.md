# dreamutopia-video Pages proxy

Tiny Cloudflare Pages "advanced mode" proxy that serves the app at a neutral URL
(https://dreamutopia-video.pages.dev) without exposing the account's workers.dev
subdomain. It forwards every request unchanged to the bound Worker via the `APP`
service binding.

Deploy the current all-forwarding proxy from a copy outside the repository:

```
mkdir -p /tmp/dreamutopia-video-pages-proxy/public
cp apps/video/deploy/pages-proxy/public/_worker.js /tmp/dreamutopia-video-pages-proxy/public/_worker.js
cp apps/video/deploy/pages-proxy/wrangler.toml /tmp/dreamutopia-video-pages-proxy/wrangler.toml
cd /tmp/dreamutopia-video-pages-proxy && npx wrangler pages deploy
```

Rollback: delete the Pages project; the app Worker is unaffected.

Set `NEXT_PUBLIC_APP_URL` to the pages.dev URL at build time and as a Worker secret.

## Phase 2 old-domain redirect

To enable the old-domain 301 after the new host is accepted, copy
`_worker.redirect-phase2.js` to the copied proxy's `public/_worker.js`, then
deploy from that `/tmp` copy:

```bash
cp apps/video/deploy/pages-proxy/_worker.redirect-phase2.js /tmp/dreamutopia-video-pages-proxy/public/_worker.js
cd /tmp/dreamutopia-video-pages-proxy && npx wrangler pages deploy
```

`wrangler pages deploy` must run from a copy outside the repo because Wrangler
otherwise picks up `apps/video/wrangler.jsonc`.

## Preview Google login

- Canonical preview URL: `https://dreamutopia-video.pages.dev`
- Google OAuth callback to register: `https://dreamutopia-video.pages.dev/api/auth/callback/google`
- Do not start login from other preview hostnames until 301 redirects exist.
