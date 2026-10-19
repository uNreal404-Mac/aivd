import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Preview-only configuration: no incremental cache binding is configured.
// An R2-backed incremental cache can be added later for production by
// wiring an `incrementalCache` option here and adding the matching
// r2_buckets binding in wrangler.jsonc.
export default defineCloudflareConfig({});
