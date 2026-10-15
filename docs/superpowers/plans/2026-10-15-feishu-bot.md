# Feishu Bot Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent, test-covered Cloudflare Worker that responds to Feishu DMs and explicit group mentions with project progress, site URL, health, or help.

**Architecture:** Keep the bot isolated under `workers/feishu-bot/` and use Web Crypto, `fetch`, and a dedicated KV namespace without a runtime SDK. Separate security/parsing, command routing, Feishu API calls, health checks, and webhook orchestration so each boundary can be unit-tested with injected fetch and KV implementations.

**Tech Stack:** Cloudflare Workers module syntax, Wrangler TOML, Workers KV, Web Crypto, Node.js built-in test runner (`node --test`), Markdown.

**Spec:** [../specs/2026-10-15-feishu-bot-design.md](../specs/2026-10-15-feishu-bot-design.md)

## Global Constraints

- Keep the Worker independent from the existing Pages Worker and its `wrangler.toml`.
- Keep `FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `FEISHU_VERIFICATION_TOKEN`, and `FEISHU_ENCRYPT_KEY` in Wrangler secrets; never put credential values in source, logs, docs, or PR text.
- Only respond to `im.message.receive_v1`, user text in direct chats, or group messages that mention the bot's own `open_id`; ignore bot-authored and non-text messages.
- Use both `event_id` and `message_id` KV markers; derive reply `uuid` from `message_id`; describe deduplication as best effort because KV is eventually consistent.
- The only DreamUtopia request is a bounded GET to `https://dreamutopia-clone.pages.dev/api/health`; never call `/api/generate`, `/api/upload`, or a paid AI endpoint.
- Keep deployment on Workers Free with Workers KV; do not enable a paid plan, paid binding, custom domain, or AI service. Verify the Cloudflare account is on Workers Free before deploying.
- Do not log request bodies, message text, credentials, or access tokens.
- No scheduled or unsolicited messages; reply only when directly messaged or mentioned in a group.

## Review Focus

- Missing, malformed, or mismatched signature inputs on every non-handshake delivery must fail closed whenever Encrypt Key is configured, including plaintext envelopes; URL-verification handshakes are the sole exception because Feishu can omit signature headers, and their payload must still be decrypted when encrypted and its top-level Verification Token validated before echoing a challenge.
- Corrupt base64, short ciphertext, and invalid PKCS#7 padding must not reach event parsing; Task 1 tests malformed and tampered ciphertext.
- Duplicate event deliveries, distinct event IDs for the same message, and failed replies must preserve retry behavior; Tasks 1 and 4 test marker lookup, marker timing, and retryable failure.
- Group mentions of a human or a different bot must not trigger a reply; Task 2 tests these alongside a matching bot mention and DMs.
- Slow, non-OK, or malformed health responses must yield a short safe summary without leaking raw payloads; Task 3 tests each health failure class and checks raw error bodies are omitted.
- The complete callback path must stay below the platform response window; Task 4 tests that a delayed health endpoint cannot hold a callback beyond the configured budget.

---

### Task 1: Pure security, command, and deduplication helpers

**Files:**
- Create: `workers/feishu-bot/src/security.mjs`
- Create: `workers/feishu-bot/src/commands.mjs`
- Create: `workers/feishu-bot/src/dedupe.mjs`
- Test: `workers/feishu-bot/test/security.test.mjs`
- Test: `workers/feishu-bot/test/commands.test.mjs`
- Test: `workers/feishu-bot/test/dedupe.test.mjs`

**Interfaces:**
- Produce `verifyLarkSignature({ rawBody, timestamp, nonce, signature, encryptKey }) -> Promise<boolean>`; hash UTF-8 bytes for `timestamp + nonce + encryptKey` followed by the original `rawBody` bytes with SHA-256 and compare the lowercase hex digest without parsing/reserializing the body.
- Produce `decryptLarkPayload(encryptedBase64, encryptKey) -> Promise<Uint8Array>`; derive the AES-256 key as SHA-256 of UTF-8 `encryptKey`, use the first 16 decoded bytes as the IV, decrypt the remaining AES-CBC ciphertext, and reject invalid padding or malformed input.
- Produce `parseCommand(text) -> 'progress' | 'url' | 'health' | 'help'`; remove surrounding punctuation/whitespace, recognize the three supported intents inside natural phrases, and return help for ambiguous text. Export `PROGRESS_MESSAGE = '项目正在持续开发中。回复「网址」查看演示站，回复「健康」检查服务；具体进度请项目负责人更新机器人配置。'` and `HELP_MESSAGE = '我可以帮你查询：回复「进度」查看项目进度，回复「网址」获取网站地址，回复「健康」检查服务状态。群聊中请 @我。'` so maintainers can update project status in one place.
- Produce `dedupeKeys(eventId, messageId) -> string[]`, `hasProcessed(kv, eventId, messageId) -> Promise<boolean>`, and `markProcessed(kv, eventId, messageId) -> Promise<void>`; use namespaced KV keys and a seven-day expiration TTL (`604800` seconds).

- [ ] **Step 1: Write failing tests** for valid/invalid raw-body signatures; AES decrypt round-trip plus malformed Base64, short payload, and tampered padding; command intents/help; and both event/message marker lookup and writes using a fake KV namespace.
- [ ] **Step 2: Run the new tests and confirm they fail** because the helper modules do not exist.

Run: `node --test workers/feishu-bot/test/security.test.mjs workers/feishu-bot/test/commands.test.mjs workers/feishu-bot/test/dedupe.test.mjs`
Expected: FAIL for missing helper exports.

- [ ] **Step 3: Implement the three pure helper modules** with the interfaces above and Web Crypto only.
- [ ] **Step 4: Run the focused tests and confirm they pass.**

Run: `node --test workers/feishu-bot/test/security.test.mjs workers/feishu-bot/test/commands.test.mjs workers/feishu-bot/test/dedupe.test.mjs`
Expected: all tests pass, including malformed crypto inputs failing closed.

- [ ] **Step 5: Commit the helper layer.**

```bash
git add workers/feishu-bot/src/security.mjs workers/feishu-bot/src/commands.mjs workers/feishu-bot/src/dedupe.mjs workers/feishu-bot/test
git commit -m "feat: add Feishu bot security and command helpers"
```

### Task 2: Callback verification and event eligibility

**Files:**
- Create: `workers/feishu-bot/src/events.mjs`
- Test: `workers/feishu-bot/test/events.test.mjs`

**Interfaces:**
- Consume Task 1 `verifyLarkSignature` and `decryptLarkPayload`.
- Produce `decodeFeishuRequest({ rawBody, headers, encryptKey }) -> Promise<object>`; read `X-Lark-Request-Timestamp`, `X-Lark-Request-Nonce`, and `X-Lark-Signature`; when Encrypt Key is configured, require and verify signatures over the original bytes for all non-handshake deliveries, encrypted or plaintext. Allow a `url_verification` handshake to omit signature headers, decrypt it when encrypted, and let the Worker validate its top-level Verification Token before replying. Parse plaintext callbacks directly when encryption is not configured and reject malformed JSON or unsigned ordinary deliveries when encryption is configured.
- Produce `validateVerificationToken(payload, configuredToken) -> boolean`; accept the callback handshake shape and event-envelope token shape only when the configured token matches.
- Produce `selectMessageEvent(payload, botOpenId) -> { eventId, messageId, chatType, text } | null`; read schema 2.0 `header.event_type`, `header.event_id`, `event.message`, and sender type; accept only `im.message.receive_v1`, `message_type: 'text'` messages from users, every `chat_type: 'p2p'` message, and `chat_type: 'group'` messages whose `mentions[].id.open_id` equals `botOpenId`; remove only that mention's `key` placeholder from the JSON-encoded message text. Reject selected events missing either ID.

- [ ] **Step 1: Write failing tests** for plain and encrypted callback decoding, URL verification token match/mismatch, schema 2 event token match/mismatch, malformed JSON, wrong event type, bot-authored/non-text messages, DMs, bot mentions, and mentions of other users/bots.
- [ ] **Step 2: Run the event tests to confirm they fail.**

Run: `node --test workers/feishu-bot/test/events.test.mjs`
Expected: FAIL because `events.mjs` has not been implemented.

- [ ] **Step 3: Implement event decoding, token validation, and eligibility selection** using the exact interfaces above.
- [ ] **Step 4: Run event tests and confirm all cases pass.**

Run: `node --test workers/feishu-bot/test/events.test.mjs`
Expected: PASS; invalid verification and ineligible messages never become selected message events.

- [ ] **Step 5: Commit callback parsing.**

```bash
git add workers/feishu-bot/src/events.mjs workers/feishu-bot/test/events.test.mjs
git commit -m "feat: validate Feishu callbacks and message events"
```

### Task 3: Feishu API client and safe health summary

**Files:**
- Create: `workers/feishu-bot/src/feishu-api.mjs`
- Create: `workers/feishu-bot/src/health.mjs`
- Test: `workers/feishu-bot/test/feishu-api.test.mjs`
- Test: `workers/feishu-bot/test/health.test.mjs`

**Interfaces:**
- Produce `getTenantAccessToken({ kv, appId, appSecret, fetchImpl, now }) -> Promise<string>`; cache token and absolute expiry in KV and refresh whenever 300 seconds or less remain.
- Produce `getBotOpenId({ kv, token, fetchImpl, now }) -> Promise<string>`; use the Bot Info API and cache only the bot's own `open_id` for 24 hours.
- Produce `replyUuid(messageId) -> Promise<string>` as an RFC 4122 UUIDv5 using the standard DNS namespace UUID `6ba7b810-9dad-11d1-80b4-00c04fd430c8` and UTF-8 name `dreamutopia-feishu:${messageId}`; `replyToMessage({ token, messageId, text, fetchImpl }) -> Promise<void>` POSTs `{ msg_type: 'text', content: JSON.stringify({ text }), uuid: await replyUuid(messageId) }` to `/open-apis/im/v1/messages/{message_id}/reply`, accepts successful idempotent replay responses, and throws on other API failures.
- Produce `fetchHealthSummary({ fetchImpl, timeoutMs }) -> Promise<string>`; GET only the fixed health URL with `redirect: 'error'` and a short timeout; summarize HTTP plus `ok`, `authReady`, `generationEnabled`, `generateReady`, `uploadReady`, `checkoutConfigured`, and `mailConfigured` booleans, and return a safe failure summary for timeout, non-OK, or malformed JSON.

- [ ] **Step 1: Write failing tests** for token cache hit, refresh at the five-minute boundary, token endpoint failure with no expired-token fallback, Bot Info cache behavior, stable valid UUIDv5 for the same message ID, reply endpoint/body, health success summary, non-OK response, invalid JSON, timeout, redirect response, and omission of raw error bodies from summaries.
- [ ] **Step 2: Run the API and health tests to confirm they fail.**

Run: `node --test workers/feishu-bot/test/feishu-api.test.mjs workers/feishu-bot/test/health.test.mjs`
Expected: FAIL because client modules do not exist.

- [ ] **Step 3: Implement the Feishu API client and health summarizer** with injectable `fetchImpl`, clock, and KV dependencies so tests make no network calls.
- [ ] **Step 4: Run focused API and health tests and confirm all pass.**

Run: `node --test workers/feishu-bot/test/feishu-api.test.mjs workers/feishu-bot/test/health.test.mjs`
Expected: PASS; failed token refresh does not reuse an expired token, and health calls cannot redirect to another URL.

- [ ] **Step 5: Commit API helpers.**

```bash
git add workers/feishu-bot/src/feishu-api.mjs workers/feishu-bot/src/health.mjs workers/feishu-bot/test/feishu-api.test.mjs workers/feishu-bot/test/health.test.mjs
git commit -m "feat: add Feishu API and health clients"
```

### Task 4: Worker route, reply orchestration, and retry-safe deduplication

**Files:**
- Create: `workers/feishu-bot/src/worker.mjs`
- Create: `workers/feishu-bot/test/worker.test.mjs`

**Interfaces:**
- Consume Tasks 1–3 helper interfaces.
- Produce the module Worker export `fetch(request, env, ctx) -> Promise<Response>`; serve only `POST /feishu/events`, return 404 for other paths/methods, 400 for malformed payloads, 401 for invalid signatures/tokens, and 503 for transient KV/Feishu failures; handle `url_verification` with a 200 JSON response preserving the challenge value exactly after decrypt/token validation. Bound the complete synchronous path, outbound response-body reads, and KV operations to 2.5 seconds; cap the health request at 700 milliseconds while reserving time for the Feishu reply.
- For selected messages, check both dedupe keys before work; map progress/url/health/help to text replies; acquire cached token and send reply; write completion markers only after a successful reply or confirmed duplicate reply UUID; return retryable 5xx for transient API/KV failure and do not mark failed replies complete.
- Inject a single fixed `PROGRESS_MESSAGE` constant with conservative project wording, plus the fixed site URL `https://dreamutopia-clone.pages.dev`.

- [ ] **Step 1: Write failing Worker tests** for route/method behavior, a JSON handshake response that preserves the challenge exactly, command-to-reply routing, duplicate `event_id`, same `message_id` under another event ID, marker writes only after reply success, retryable reply failure, same deterministic reply UUID on a retried API call, acknowledgment of unrelated event types, and no calls to `/api/generate` or `/api/upload`.
- [ ] **Step 2: Run Worker tests and confirm they fail.**

Run: `node --test workers/feishu-bot/test/worker.test.mjs`
Expected: FAIL because the Worker module does not exist.

- [ ] **Step 3: Implement the Worker entrypoint** with dependency-injected helper calls and safe status responses; import the single `PROGRESS_MESSAGE` from `commands.mjs`, and do not log event bodies or message content.
- [ ] **Step 4: Run the full Worker test suite.**

Run: `node --test workers/feishu-bot/test/*.test.mjs`
Expected: PASS; tests prove duplicate suppression is best effort, reply failures remain retryable, and no unsupported endpoint is called.

- [ ] **Step 5: Commit the webhook Worker.**

```bash
git add workers/feishu-bot/src/worker.mjs workers/feishu-bot/test/worker.test.mjs
git commit -m "feat: add Feishu webhook Worker"
```

### Task 5: Wrangler setup and operator documentation

**Files:**
- Create: `workers/feishu-bot/wrangler.toml`
- Create: `workers/feishu-bot/README.md`
- Modify: `README.md`

**Interfaces:**
- Configure Worker name `feishu-bot`, entry `src/worker.mjs`, compatibility date, and a dedicated KV binding named `BOT_KV`; document creating the namespace and replacing only its generated namespace ID in Wrangler config.
- Document local tests/dev, `wrangler secret put` for each of the four exact secret names, Free-plan verification, deploy, and the callback URL pattern `https://feishu-bot.<account-subdomain>.workers.dev/feishu/events`.
- Document Feishu event `im.message.receive_v1`; bot capability; requested scopes `im:message`, `im:message.group_at_msg`, and `im:message:send_as_bot`; any additional read-only DM scope required by the console; callback validation; and app-version publication.
- Add a short root README link to the Worker guide. Do not put secret values in either README.

- [ ] **Step 1: Write deployment documentation** with explicit Free-plan/no-paid-binding guardrails, KV creation/binding, local commands, secret entry commands, deploy commands, callback address, and Feishu console checklist.
- [ ] **Step 2: Add Wrangler configuration** with a placeholder namespace ID that operators must replace using their own created KV namespace; make no paid bindings or custom-domain declaration.
- [ ] **Step 3: Link the guide from the repository README** without changing existing app setup content.
- [ ] **Step 4: Run final repository checks and a credential/forbidden-endpoint scan.**

Run: `node --test workers/feishu-bot/test/*.test.mjs`
Expected: PASS.

Run: `git diff --check`
Expected: no whitespace errors.

Run: `rg -n '/api/(generate|upload)|FEISHU_(APP_ID|APP_SECRET|VERIFICATION_TOKEN|ENCRYPT_KEY)=[^[:space:]]+|Bearer[[:space:]]+[A-Za-z0-9._-]{20,}' workers/feishu-bot README.md`
Expected: no calls to prohibited endpoints and no secret values; secret names may appear only in documentation commands/config key references.

- [ ] **Step 5: Commit deployment setup and docs.**

```bash
git add workers/feishu-bot/wrangler.toml workers/feishu-bot/README.md README.md
git commit -m "docs: document Feishu bot deployment"
```

### Task 6: Verify Free-plan prerequisites and deploy the Worker

**Files:**
- Modify: `workers/feishu-bot/wrangler.toml` with the created KV namespace ID only.

- [ ] **Step 1: Confirm Wrangler is authenticated to the intended Cloudflare account** using `npx wrangler whoami`; do not print or copy any secrets.
- [ ] **Step 2: Verify the account's Workers plan is Workers Free** in Cloudflare's account settings before creating resources or deploying. If the plan cannot be confirmed as Free, stop before deploy and report the account-side blocker.
- [ ] **Step 3: Create the dedicated KV namespace** using Wrangler, replace the config's placeholder with its namespace ID, and confirm no paid binding or custom domain is present.
- [ ] **Step 4: Set all four values interactively with `npx wrangler secret put FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `FEISHU_VERIFICATION_TOKEN`, and `FEISHU_ENCRYPT_KEY`**; never pass secret values as command arguments, capture them in output, or add them to a file.
- [ ] **Step 5: Deploy using `npx wrangler deploy --config workers/feishu-bot/wrangler.toml`** and record the generated `workers.dev` hostname for the Feishu callback URL. If Cloudflare authentication or secret values are unavailable, leave deployment unclaimed and report exactly which user-side input is needed.

### Task 7: Review, publish the branch, and open a pull request

**Files:**
- Review the complete branch diff; no additional source files expected.

- [ ] **Step 1: Run all Worker tests and inspect the complete diff.**

Run: `node --test workers/feishu-bot/test/*.test.mjs && git diff origin/main...HEAD --check`
Expected: all tests pass and diff check reports no errors.

- [ ] **Step 2: Confirm the branch contains no credential values and has no generation/upload/paid-AI calls.**

Run: `git diff origin/main...HEAD -- workers/feishu-bot README.md | rg -n '/api/(generate|upload)|FEISHU_(APP_ID|APP_SECRET|VERIFICATION_TOKEN|ENCRYPT_KEY)=[^[:space:]]+|sk-[A-Za-z0-9]+'`
Expected: no matches.

- [ ] **Step 3: Push `codex/feishu-bot` and open a PR** with summary, test evidence, and the post-deployment Feishu checklist: actual callback URL when deployed (otherwise the documented URL pattern), `im.message.receive_v1`, the three requested permissions, bot capability, and app-version publication. State any uncompleted Free-plan, authentication, or secret prerequisites; do not include secret values.
- [ ] **Step 4: Attach the created PR to this Codex task** and report its URL.
