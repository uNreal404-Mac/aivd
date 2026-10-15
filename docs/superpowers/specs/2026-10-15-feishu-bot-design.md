# Feishu Project Bot Worker Design

## Goal

Add a low-cost, webhook-based Feishu project bot as an independent Cloudflare Worker at `workers/feishu-bot/`. It responds to direct messages and group messages that explicitly mention this bot. The first release supports project progress, site URL, and health commands. It uses no AI service and does not call generation or upload endpoints.

The provided group screenshot is a style and usage reference. Its statements about payment, generation, and project completion are not treated as verified status. Progress copy will be a configurable constant with a conservative default.

## Architecture

- Keep the Worker independent from the existing Pages Worker and its `wrangler.toml`.
- Use the Worker runtime's Web Crypto, `fetch`, and Workers KV APIs; add no runtime SDK dependency.
- Bind a dedicated KV namespace for event/message deduplication, access-token caching, and the bot's own `open_id` cache.
- Expose only `POST /feishu/events`; return 404 for other paths and methods.
- Keep credentials in Wrangler secrets: `FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `FEISHU_VERIFICATION_TOKEN`, and `FEISHU_ENCRYPT_KEY`. No credential value may appear in source, logs, docs, or PR text.

## Event and security flow

1. Read and retain the original request body bytes.
2. If `FEISHU_ENCRYPT_KEY` is configured, every non-handshake delivery, whether encrypted or plaintext, requires `X-Lark-Signature` as SHA-256 of `timestamp + nonce + encrypt key + raw body`; validate the exact original body bytes before accepting an event. For signed encrypted deliveries, verify before decrypting. Derive the AES key as SHA-256 of the UTF-8 Encrypt Key; the first 16 decoded bytes are the IV. Do not parse and re-serialize JSON before signature verification.
3. A URL-verification handshake may be plaintext or encrypted and can omit signature headers. Decrypt it when encrypted, validate the top-level Verification Token, and return the challenge in `{"challenge":"..."}`. For schema 2.0 events, require a valid signature when an Encrypt Key is configured and validate `header.token`. Reject invalid tokens, signatures, malformed payloads, and decryption failures without logging the body.
4. Acknowledge event types other than `im.message.receive_v1` without side effects. Ignore messages sent by bots and non-text messages.
5. Respond to all user text in `p2p` chats. In groups, resolve and cache the bot's own `open_id` using the Bot Info API and respond only when a mention's `id.open_id` matches it; mentioning another person or bot is insufficient.
6. Bound the complete synchronous event flow to 2.5 seconds, including outbound response bodies and KV calls; cap the health request at 700 ms and return a retryable status if the overall deadline is exceeded.

## Commands and replies

- Parse text after removing the platform's mention placeholders and surrounding punctuation/whitespace. Natural phrases containing one supported intent work (for example, “及时汇报项目进度” routes to progress). Ambiguous or unsupported content returns the help message.
- `进度`: return an exported `PROGRESS_MESSAGE` constant. Its default avoids unverified claims; maintainers can edit it when project status changes.
- `网址`: return `https://dreamutopia-clone.pages.dev`.
- `健康`: GET only `https://dreamutopia-clone.pages.dev/api/health`, with a short timeout and redirects disabled. Summarize HTTP and selected readiness fields; do not expose raw payloads or secrets.
- Reply with `POST /open-apis/im/v1/messages/{message_id}/reply` and `msg_type: "text"`.
- Obtain tenant access tokens through `/open-apis/auth/v3/tenant_access_token/internal`. Cache token and absolute expiry in KV; refresh if 5 minutes or less remain. Never use an expired token as a fallback after a failed refresh.

## Idempotency and failure handling

- Use KV markers keyed by both `event_id` and `message_id`, with expiry, to suppress platform retries and known duplicate message deliveries.
- Derive the reply API's `uuid` deterministically from `message_id`. The platform deduplicates a reply UUID for one hour, which protects a retry if the first reply succeeded but its response was lost.
- Write completion markers only after the reply succeeds (or the platform confirms the same reply UUID was already handled). Do not acknowledge a failed reply as complete. Return a retryable server error for transient KV or Feishu API failures.
- Workers KV is eventually consistent, and its read-then-write pattern is not an atomic lock. The design provides layered best-effort deduplication; it does not promise strict exactly-once replies across concurrent or cross-region deliveries.
- Do not log request bodies, secrets, access tokens, or user message contents.

## Free-tier boundary

- Use the Workers Free plan and a free Workers KV namespace; do not enable a paid plan, paid binding, custom domain, or AI service. Use the `workers.dev` hostname.
- Current published Workers Free limits include 100,000 Worker requests and 1,000 KV writes per day. Free quota exhaustion fails requests/operations; the code does not upgrade the account. The account's active Cloudflare plan is an external setting, so deployment must confirm it is Workers Free before deploying to satisfy the no-charge requirement.
- Never call `/api/generate`, `/api/upload`, or another paid AI endpoint. The only DreamUtopia request in this Worker is the fixed `/api/health` GET.

## Testing and documentation

- Use Node's built-in test runner with no paid or runtime test service.
- Unit-test raw-body signature validation, AES decryption, event/message deduplication policy, and command parsing. Also cover failed reply retry behavior, duplicate reply UUID handling, token refresh at the five-minute boundary, bot-vs-user mentions, and health timeout behavior.
- Add `workers/feishu-bot/README.md` with KV namespace setup, local test/dev commands, `wrangler secret put` steps, deploy commands, Free-plan checks, and the callback address pattern `https://feishu-bot.<account-subdomain>.workers.dev/feishu/events`.
- Update the repository README with a short link to the Worker instructions.
- The PR description will list post-deployment Feishu settings: the actual callback URL, permissions `im:message`, `im:message.group_at_msg`, and `im:message:send_as_bot`, the `im.message.receive_v1` subscription, enabling bot capability, and publishing the app version. If the console requires a separate read-only direct-message scope, document that requirement too.

## Out of scope

- Scheduled proactive reports or unprompted group messages.
- Free-form model responses, paid AI endpoints, image/video generation, or uploads.
- Changes to the existing Pages application's generation, upload, payment, or database flows.
