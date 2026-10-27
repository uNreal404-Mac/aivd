# admin001 preview proxy

This Cloudflare Pages project provides the stable preview URL
`https://dreamutopia-admin-preview.pages.dev` and forwards requests to the
isolated `dreamutopia-admin001` Worker through a service binding.

The preview Worker shares the existing D1 database, but has its own runtime
secrets and does not replace the main application Worker.
