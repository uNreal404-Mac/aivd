# aivd-preview Pages proxy

Tiny Cloudflare Pages "advanced mode" proxy that serves the app at
`https://aivd-preview.pages.dev` and forwards requests to the bound Worker via
the `APP` service binding.

Deploy from a copy outside the repository so Wrangler does not pick up
`apps/video/wrangler.jsonc`:

```bash
mkdir -p /tmp/aivd-preview-pages-proxy/public
cp apps/video/deploy/pages-proxy-aivd-preview/public/_worker.js /tmp/aivd-preview-pages-proxy/public/_worker.js
cp apps/video/deploy/pages-proxy-aivd-preview/wrangler.toml /tmp/aivd-preview-pages-proxy/wrangler.toml
cd /tmp/aivd-preview-pages-proxy && npx wrangler pages deploy
```

Rollback: delete the Pages project; the app Worker is unaffected.
