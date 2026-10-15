/**
 * GENERATION_ENABLED kill switch — mocks only. Never calls real KIE.
 */
import {
  WORKSPACE_PATH,
  GENERATION_DISABLED_CODE,
  GENERATION_DISABLED_MESSAGE,
  generationCta,
  isGenerationEnabled,
} from "../libs/generation.ts";
import { onRequestPost as generatePost } from "../functions/api/generate.ts";
import { onRequestGet as uploadGet, onRequestPost as uploadPost } from "../functions/api/upload.ts";
import { onRequestGet as healthGet } from "../functions/api/health.ts";

const fail = [];
const ok = [];

function assert(cond, label) {
  if (cond) ok.push(label);
  else fail.push(label);
}

function pagesCtx(env, request) {
  return { env, request, waitUntil() {}, params: {}, data: {}, functionPath: "", next: async () => new Response("ok") };
}

async function jsonOf(res) {
  return { status: res.status, body: await res.json() };
}

function mockKv() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
  };
}

const origFetch = globalThis.fetch;
const fetchCalls = [];
let allowMockKie = false;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  fetchCalls.push({ url, init });
  if (/kie\.ai/i.test(url)) {
    if (!allowMockKie) throw new Error("test must not call real KIE: " + url);
    return Response.json({ code: 200, data: { taskId: "mock_task_gate" } });
  }
  throw new Error("unexpected network call: " + url);
};

function generateReq(body) {
  return new Request("https://dreamutopia-clone.pages.dev/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

try {
  {
    assert(isGenerationEnabled({}) === false, "unset GENERATION_ENABLED is off");
    assert(isGenerationEnabled({ GENERATION_ENABLED: "" }) === false, "blank GENERATION_ENABLED is off");
    assert(isGenerationEnabled({ GENERATION_ENABLED: "false" }) === false, '"false" is off');
    assert(isGenerationEnabled({ GENERATION_ENABLED: "TRUE" }) === false, "case-sensitive: TRUE is off");
    assert(isGenerationEnabled({ GENERATION_ENABLED: "1" }) === false, '"1" is off');
    assert(isGenerationEnabled({ GENERATION_ENABLED: "true" }) === true, 'only "true" is on');
  }

  {
    const samples = generationCta(false, "samples", { href: "/workspace", label: "Start Creating Free →" });
    assert(samples.href === WORKSPACE_PATH && samples.label === "Start Creating Free →" && samples.closed, "closed samples CTA → /workspace");
    const quote = generationCta(false, "quote", { href: "/workspace", label: "Claim 10 Free Credits" });
    assert(quote.href === WORKSPACE_PATH && quote.label === "Claim 10 Free Credits" && quote.closed, "closed quote CTA → /workspace (no /business)");
    const open = generationCta(true, "samples", { href: "/workspace", label: "Start Creating Free →" });
    assert(open.href === "/workspace" && open.label === "Start Creating Free →" && !open.closed, "enabled CTA stays on /workspace");
    const openQuote = generationCta(true, "quote", { href: "/workspace", label: "Claim 10 Free Credits" });
    assert(openQuote.href === "/workspace" && openQuote.label === "Claim 10 Free Credits", "enabled quote CTA goes to /workspace");
  }

  {
    fetchCalls.length = 0;
    const offEnvs = [{}, { GENERATION_ENABLED: "false" }, { GENERATION_ENABLED: "TRUE" }, { KIE_API_KEY: "must-not-use" }];
    for (const env of offEnvs) {
      const got = await jsonOf(await generatePost(pagesCtx(env, generateReq({ prompt: "a cat", kind: "video", model: "lite", imageUrl: "https://example.com/x.jpg" }))));
      assert(got.status === 503, `POST /api/generate off (${JSON.stringify(env.GENERATION_ENABLED)}) is 503`);
      assert(got.body.code === GENERATION_DISABLED_CODE, "closed generate code is generation_disabled");
      assert(got.body.message === GENERATION_DISABLED_MESSAGE, "closed generate message is 暂未开放");
      assert(got.body.generationEnabled === false, "closed generate payload says generationEnabled false");
    }
    assert(fetchCalls.length === 0, "closed generate never calls KIE client");
  }

  {
    fetchCalls.length = 0;
    const got = await jsonOf(
      await uploadPost(
        pagesCtx(
          { KIE_API_KEY: "must-not-use", MEDIA: {}, SESSIONS: mockKv() },
          new Request("https://dreamutopia-clone.pages.dev/api/upload", {
            method: "POST",
            headers: { "content-type": "image/jpeg" },
            body: new Uint8Array(64),
          })
        )
      )
    );
    assert(got.status === 503 && got.body.code === GENERATION_DISABLED_CODE, "POST /api/upload off is 503 generation_disabled");
    assert(got.body.message === GENERATION_DISABLED_MESSAGE, "closed upload message is 暂未开放");
    assert(fetchCalls.length === 0, "closed upload never calls KIE");
  }

  {
    const health = await jsonOf(await healthGet(pagesCtx({}, new Request("https://dreamutopia-clone.pages.dev/api/health"))));
    assert(health.status === 200 && health.body.generationEnabled === false, "health defaults generationEnabled false");
    assert(health.body.generateReady === false, "health generateReady is false while generation is off");
    assert(health.body.guestTrials === false, "health guestTrials follows generationEnabled (off)");
    const closedAuth = await jsonOf(
      await healthGet(
        pagesCtx(
          { DB: {}, SESSIONS: mockKv(), KIE_API_KEY: "must-not-use" },
          new Request("https://dreamutopia-clone.pages.dev/api/health")
        )
      )
    );
    assert(
      closedAuth.body.message === "Generation disabled (GENERATION_ENABLED off) — demo only, no free tries",
      "health message when generation is off (auth ready)"
    );
    assert(closedAuth.body.guestTrials === false, "closed health guestTrials is false even with KIE present");
    const openHealth = await jsonOf(
      await healthGet(
        pagesCtx(
          { GENERATION_ENABLED: "true", DB: {}, SESSIONS: mockKv(), KIE_API_KEY: "must-not-use", MEDIA: {} },
          new Request("https://dreamutopia-clone.pages.dev/api/health")
        )
      )
    );
    assert(openHealth.body.generationEnabled === true && openHealth.body.guestTrials === true, "health guestTrials true when generation is on");
    assert(
      openHealth.body.message === "D1 + KV + KIE + R2 ready — 2 free Lite I2V tries, then sign in",
      "health ready message only when generation is on"
    );
    const cap = await jsonOf(await uploadGet(pagesCtx({}, new Request("https://dreamutopia-clone.pages.dev/api/upload"))));
    assert(cap.body.generationEnabled === false, "GET /api/upload reports generationEnabled false");
  }

  {
    fetchCalls.length = 0;
    allowMockKie = true;
    const env = { GENERATION_ENABLED: "true", KIE_API_KEY: "mock-not-real", SESSIONS: mockKv() };
    const got = await jsonOf(
      await generatePost(
        pagesCtx(
          env,
          generateReq({
            prompt: "a cat walks",
            kind: "video",
            model: "lite",
            imageUrl: "https://example.com/cat.jpg",
          })
        )
      )
    );
    assert(got.status === 200 && got.body.ok === true, "POST /api/generate on + mock KIE is 200");
    assert(got.body.providerJobId === "mock_task_gate", "enabled path uses mock KIE task id");
    assert(
      fetchCalls.some((c) => /api\.kie\.ai\/api\/v1\/jobs\/createTask/.test(c.url)),
      "enabled path calls mock KIE createTask"
    );
    assert(
      !fetchCalls.some((c) => /kie\.ai/.test(c.url) && !c.url.includes("api.kie.ai")),
      "enabled path does not call any other KIE host"
    );
  }
} finally {
  globalThis.fetch = origFetch;
}

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nGeneration gate checks passed (${ok.length})`);
