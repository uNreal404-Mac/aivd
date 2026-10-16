# dreamutopia-video Pages proxy

Tiny Cloudflare Pages "advanced mode" proxy that serves the app at a neutral URL
(https://dreamutopia-video.pages.dev) without exposing the account's workers.dev
subdomain. It forwards every request unchanged to the bound Worker via the `APP`
service binding.

Deploy (from `apps/video/deploy/pages-proxy`):

```
cd deploy/pages-proxy && npx wrangler pages deploy
```

Rollback: delete the Pages project; the app Worker is unaffected.

Set `NEXT_PUBLIC_APP_URL` to the pages.dev URL at build time and as a Worker secret.
