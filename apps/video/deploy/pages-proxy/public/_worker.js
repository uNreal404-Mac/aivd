// Cloudflare Pages "advanced mode" proxy.
// Purpose: serve the app at a neutral URL (https://dreamutopia-video.pages.dev)
// without exposing the account's workers.dev subdomain. Every request is
// forwarded unchanged (method, headers, body, URL host) to the bound Worker
// via the APP service binding.
// Rollback: delete the Pages project; the app Worker is unaffected.
export default {
  async fetch(request, env) {
    return env.APP.fetch(request);
  },
};
