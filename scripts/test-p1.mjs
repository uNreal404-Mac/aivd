#!/usr/bin/env node
/**
 * Unit checks for #20 P1 — guest job merge + image-lite KIE mapping.
 * Mocks only. Does not call KIE createTask / paid generation.
 */
import { mergeGuestJobs } from "../libs/account.ts";
import {
  buildImageTaskSpec,
  mapKieTaskOutcome,
  parseKieResultUrl,
  KIE_T2I_LITE_MODEL,
  KIE_T2I_MODEL,
} from "../libs/kie.ts";
import { guestIdFromRequest, GUEST_COOKIE } from "../libs/guest.ts";

const fail = [];
const ok = [];

function assert(cond, label) {
  if (cond) ok.push(label);
  else fail.push(label);
}

function mockKv(map) {
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

function mockD1(state) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/SELECT id FROM generations WHERE user_id = \? AND provider_job_id = \?/.test(sql)) {
                const [userId, providerJobId] = args;
                return (
                  state.rows.find((r) => r.user_id === userId && r.provider_job_id === providerJobId) ||
                  null
                );
              }
              return null;
            },
            async run() {
              if (/INSERT INTO generations/.test(sql)) {
                const [
                  userId,
                  model,
                  prompt,
                  status,
                  mediaKey,
                  inputImageUrl,
                  providerJobId,
                  resultUrl,
                  errorMessage,
                  createdAt,
                ] = args;
                if (userId <= 0) throw new Error("refusing guest user_id");
                state.rows.push({
                  id: state.rows.length + 1,
                  user_id: userId,
                  model,
                  prompt,
                  status,
                  media_key: mediaKey,
                  input_image_url: inputImageUrl,
                  provider_job_id: providerJobId,
                  result_url: resultUrl,
                  error_message: errorMessage,
                  created_at: createdAt,
                });
                return { success: true, meta: { last_row_id: state.rows.length, changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}

function requestWithCookie(guestId) {
  const headers = new Headers();
  if (guestId) headers.set("cookie", `${GUEST_COOKIE}=${guestId}; Path=/`);
  return new Request("https://dreamutopia-clone.pages.dev/api/auth/register", {
    method: "POST",
    headers,
  });
}

const guestA = "gst_aaaaaaaaaaaaaaaa";
const guestB = "gst_bbbbbbbbbbbbbbbb";
const jobA = {
  id: "g_1111111111111111",
  providerJobId: "8c383440aaaaaaaaaaaaaaaaaaaaaaaa",
  prompt: "a red apple on table",
  kind: "video",
  model: "lite",
  status: "done",
  inputImageUrl: "https://example.com/a.png",
  resultUrl: "https://dreamutopia-clone.pages.dev/api/media?key=0_out_aaa.mp4",
  errorMessage: null,
  createdAt: "2026-10-15T05:00:00.000Z",
};
const jobB = {
  id: "g_2222222222222222",
  providerJobId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  prompt: "other guest only",
  kind: "video",
  model: "lite",
  status: "done",
  inputImageUrl: "https://example.com/b.png",
  resultUrl: "https://dreamutopia-clone.pages.dev/api/media?key=0_out_bbb.mp4",
  errorMessage: null,
  createdAt: "2026-10-15T05:01:00.000Z",
};

{
  assert(guestIdFromRequest(requestWithCookie(guestA)) === guestA, "reads du_guest gst_+16hex");
  assert(guestIdFromRequest(requestWithCookie("gst_short")) === null, "rejects short guest cookie");
  assert(guestIdFromRequest(requestWithCookie("")) === null, "no cookie → null");
  assert(
    guestIdFromRequest(
      new Request("https://x.test/", { headers: { cookie: "du_guest=gst_aaaaaaaaaaaaaaaa; other=1" } })
    ) === guestA,
    "parses du_guest among other cookies"
  );
}

{
  const kvMap = new Map();
  kvMap.set(
    `guest:id:${guestA}`,
    JSON.stringify({ id: guestA, used: 1, uploads: 0, jobs: [jobA] })
  );
  kvMap.set(
    `guest:id:${guestB}`,
    JSON.stringify({ id: guestB, used: 1, uploads: 0, jobs: [jobB] })
  );
  const state = { rows: [] };
  const env = { DB: mockD1(state), SESSIONS: mockKv(kvMap) };

  const none = await mergeGuestJobs(env, requestWithCookie(null), 40);
  assert(none === 0 && state.rows.length === 0, "no cookie copies 0 jobs");

  const copied = await mergeGuestJobs(env, requestWithCookie(guestA), 40);
  assert(copied === 1, "cookie A copies 1 job for user 40");
  assert(state.rows.length === 1, "D1 has exactly one new row");
  assert(state.rows[0].user_id === 40, "row belongs to the signed-in user");
  assert(state.rows[0].provider_job_id === jobA.providerJobId, "row is guest A's provider job");
  assert(state.rows[0].prompt === jobA.prompt, "prompt copied");
  assert(
    !state.rows.some((r) => r.provider_job_id === jobB.providerJobId),
    "does not expose guest B's job"
  );

  const again = await mergeGuestJobs(env, requestWithCookie(guestA), 40);
  assert(again === 0 && state.rows.length === 1, "second merge is idempotent for same user");

  const otherUser = await mergeGuestJobs(env, requestWithCookie(guestA), 41);
  assert(otherUser === 1, "same guest cookie can attach to a different account once");
  assert(
    state.rows.filter((r) => r.provider_job_id === jobA.providerJobId).length === 2,
    "dedupe is per user_id + provider_job_id"
  );

  const skipped = await mergeGuestJobs(env, requestWithCookie(guestA), 0);
  assert(skipped === 0, "refuses userId <= 0 (no user_id=0 dump)");
}

{
  const lite = buildImageTaskSpec({
    prompt: "a red apple on table",
    resolution: "1K",
    tier: "lite",
  });
  assert(lite.model === KIE_T2I_LITE_MODEL, "image-lite model is nano-banana-2-lite");
  assert(lite.input.prompt === "a red apple on table", "lite prompt passed through");
  assert(lite.input.aspect_ratio === "auto", "lite aspect_ratio auto");
  assert(lite.input.resolution === undefined, "lite omits resolution (unsupported on 2-lite)");
  assert(lite.input.output_format === undefined, "lite omits output_format");
  assert(lite.input.image_input === undefined, "lite does not send image_input");
  assert(lite.input.image_urls === undefined, "lite omits empty image_urls");

  const liteRef = buildImageTaskSpec({
    prompt: "edit this",
    imageUrls: ["https://example.com/a.png", "https://example.com/b.png"],
    resolution: "1K",
    tier: "lite",
  });
  assert(
    Array.isArray(liteRef.input.image_urls) && liteRef.input.image_urls.length === 2,
    "lite references use image_urls"
  );

  const pro = buildImageTaskSpec({
    prompt: "a red apple on table",
    resolution: "2K",
    tier: "pro",
  });
  assert(pro.model === KIE_T2I_MODEL, "image-pro model stays nano-banana-2");
  assert(pro.input.resolution === "2K", "pro sends resolution");
  assert(pro.input.output_format === "png", "pro 2K uses png");
  const pro1k = buildImageTaskSpec({ prompt: "x", resolution: "1K", tier: "pro" });
  assert(pro1k.input.output_format === "jpg", "pro 1K uses jpg");
  const proBlend = buildImageTaskSpec({
    prompt: "blend",
    imageUrls: ["https://example.com/a.png"],
    resolution: "4K",
    tier: "pro",
  });
  assert(
    Array.isArray(proBlend.input.image_input) && proBlend.input.image_input[0] === "https://example.com/a.png",
    "pro blend uses image_input"
  );
}

{
  assert(
    parseKieResultUrl('{"resultUrls":["https://cdn.example/out.jpg"]}') === "https://cdn.example/out.jpg",
    "parses resultUrls[0]"
  );
  assert(
    parseKieResultUrl({ result_urls: ["https://cdn.example/alt.jpg"] }) === "https://cdn.example/alt.jpg",
    "parses result_urls"
  );
  assert(parseKieResultUrl({ resultUrl: "https://cdn.example/one.jpg" }) === "https://cdn.example/one.jpg", "parses resultUrl");
  assert(parseKieResultUrl("not-json") === null, "bad JSON → null");
  assert(parseKieResultUrl({ resultUrls: [] }) === null, "empty resultUrls → null");
}

{
  const done = mapKieTaskOutcome({
    state: "success",
    resultUrl: "https://cdn.example/out.jpg",
    failMsg: null,
    failCode: null,
  });
  assert(done.action === "done" && done.resultUrl === "https://cdn.example/out.jpg", "success+url → done");

  const waitSuccess = mapKieTaskOutcome({ state: "success", resultUrl: null, failMsg: null, failCode: null });
  assert(waitSuccess.action === "wait", "success without URL stays wait (no local fail)");

  const gen = mapKieTaskOutcome({ state: "generating", resultUrl: null, failMsg: null, failCode: null });
  assert(gen.action === "wait" && gen.providerState === "generating", "generating stays processing");

  const queue = mapKieTaskOutcome({ state: "queuing", resultUrl: null, failMsg: null, failCode: null });
  assert(queue.action === "wait", "queuing stays processing");

  const upstream = mapKieTaskOutcome({
    state: "fail",
    resultUrl: null,
    failMsg: "generate task timeout.",
    failCode: "500",
  });
  assert(
    upstream.action === "fail" && upstream.message === "generate task timeout.",
    "KIE failMsg generate task timeout. is mapped as provider fail (not a local poll timeout)"
  );

  const unknown = mapKieTaskOutcome({ state: "mystery", resultUrl: null, failMsg: null, failCode: null });
  assert(unknown.action === "wait", "unknown state does not fail the job");
}

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nP1 unit checks passed (${ok.length})`);
