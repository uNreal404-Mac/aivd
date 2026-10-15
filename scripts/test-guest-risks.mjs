#!/usr/bin/env node
/**
 * PR #23 guest-job migration risk tests. Mock KV + mock D1 only — no network,
 * no KIE / Stripe calls (KIE outcomes are passed as `prefetched`).
 * Run: npx tsx scripts/test-guest-risks.mjs
 */
import { mergeGuestJobs } from "../libs/account.ts";
import { settleAccountJob } from "../libs/settle.ts";
import { GUEST_COOKIE } from "../libs/guest.ts";

const results = [];
async function test(name, fn) {
  try { await fn(); results.push([name, true]); console.log("PASS", name); }
  catch (e) { results.push([name, false]); console.log("FAIL", name, "-", e.message); }
}
function assert(c, m) { if (!c) throw new Error(m); }
const tick = () => new Promise((r) => setImmediate(r));

function mockKv(map = new Map()) {
  return { map, async get(k) { await tick(); return map.has(k) ? map.get(k) : null; },
    async put(k, v) { await tick(); map.set(k, v); }, async delete(k) { await tick(); map.delete(k); } };
}

/** Minimal D1: each statement runs atomically, with an await before it so requests interleave. */
function mockD1() {
  const st = { gens: [], events: [], users: new Map(), nextId: 1 };
  const exec = (sql, a) => {
    const q = sql.replace(/\s+/g, " ").trim();
    if (/^SELECT id FROM generations WHERE user_id = \? AND provider_job_id = \?/.test(q))
      return { first: st.gens.find((g) => g.user_id === a[0] && g.provider_job_id === a[1]) || null };
    if (/^INSERT INTO generations/.test(q)) {
      if (/WHERE NOT EXISTS/.test(q) && st.gens.some((g) => g.provider_job_id === a[10]))
        return { meta: { changes: 0 } };
      const id = st.nextId++;
      st.gens.push({ id, user_id: a[0], model: a[1], prompt: a[2], status: a[3], media_key: a[4],
        input_image_url: a[5], provider_job_id: a[6], result_url: a[7], error_message: a[8], created_at: a[9] });
      return { meta: { changes: 1, last_row_id: id } };
    }
    if (/^DELETE FROM generations WHERE id = \?/.test(q)) {
      st.gens = st.gens.filter((g) => g.id !== a[0]); return { meta: { changes: 1 } };
    }
    if (/^UPDATE generations SET status = 'failed'/.test(q)) {
      const g = st.gens.find((x) => x.id === a[1] && x.status === "processing");
      if (g) { g.status = "failed"; g.error_message = a[0]; }
      return { meta: { changes: g ? 1 : 0 } };
    }
    if (/^SELECT 1 AS x FROM credit_events WHERE user_id = \? AND reason = \?/.test(q))
      return { first: st.events.find((e) => e.user_id === a[0] && e.reason === a[1]) || null };
    if (/^INSERT INTO credit_events/.test(q)) {
      const [user_id, d1, d2] = a; const delta = a.length === 2 ? 0 : d1; const reason = a.length === 2 ? d1 : d2;
      if (reason.startsWith("refund:gen:") && st.events.some((e) => e.reason === reason))
        throw new Error("UNIQUE constraint failed: credit_events.reason");
      st.events.push({ user_id, delta, reason }); return { meta: { changes: 1 } };
    }
    if (/^UPDATE users SET credits = credits \+ \? WHERE id = \?/.test(q)) {
      st.users.set(a[1], (st.users.get(a[1]) || 0) + a[0]); return { meta: { changes: 1 } };
    }
    if (/^SELECT .* FROM generations WHERE id = \?/.test(q))
      return { first: st.gens.find((g) => g.id === a[0]) || null };
    throw new Error("mock D1: unhandled SQL " + q.slice(0, 80));
  };
  const db = { st, prepare(sql) { return { bind(...a) { return {
    async first() { await tick(); return exec(sql, a).first ?? null; },
    async run() { await tick(); return exec(sql, a); } }; } }; } };
  return db;
}

const GID = "gst_0123456789abcdef";
function req() { return new Request("https://x.test/api/auth/me", { headers: { cookie: `${GUEST_COOKIE}=${GID}` } }); }
function env(jobs) {
  const kv = mockKv();
  kv.map.set(`guest:id:${GID}`, JSON.stringify({ id: GID, used: jobs.length, uploads: 0, jobs }));
  return { DB: mockD1(), SESSIONS: kv, KIE_API_KEY: "mock-not-used" };
}
const job = (n, status = "processing") => ({ id: `g_${String(n).padStart(16, "0")}`, providerJobId: `task_${n}`,
  prompt: "p", kind: "video", model: "lite", status, inputImageUrl: null,
  resultUrl: status === "done" ? "https://cdn.test/a.mp4" : null, errorMessage: null, createdAt: "2026-10-15T00:00:00Z" });
const FAIL = { ok: true, state: "fail", resultUrl: null, failMsg: "mock provider fail" };

// Risk 1
await test("R1: migrated processing guest job that later fails does NOT refund credits", async () => {
  const e = env([job(1)]); e.DB.st.users.set(7, 0);
  assert((await mergeGuestJobs(e, req(), 7)) === 1, "should migrate 1 job");
  const row = e.DB.st.gens[0];
  const r = await settleAccountJob(e, { ...row }, "https://x.test", FAIL);
  assert(r.row.status === "failed", "row should be failed");
  assert(e.DB.st.users.get(7) === 0, `credits changed to ${e.DB.st.users.get(7)} (free guest job refunded)`);
  assert(!e.DB.st.events.some((x) => x.reason.startsWith("refund:")), "refund event written");
});
await test("R1 control: a normal charged account job still refunds once", async () => {
  const e = env([]); e.DB.st.users.set(7, 0);
  e.DB.st.gens.push({ id: 50, user_id: 7, model: "lite", status: "processing", provider_job_id: "task_paid" });
  e.DB.st.nextId = 51;
  await settleAccountJob(e, { ...e.DB.st.gens[0] }, "https://x.test", FAIL);
  await settleAccountJob(e, { ...e.DB.st.gens[0], status: "processing" }, "https://x.test", FAIL);
  assert(e.DB.st.users.get(7) === 3, `expected +3 once, got ${e.DB.st.users.get(7)}`);
});
// Risk 2
await test("R2: same du_guest cookie, login A then B -> jobs claimed by A only", async () => {
  const e = env([job(1, "done"), job(2, "done")]);
  const a = await mergeGuestJobs(e, req(), 1);
  const b = await mergeGuestJobs(e, req(), 2);
  assert(a === 2, `A copied ${a}`);
  assert(b === 0, `B also copied ${b} jobs`);
  assert(e.DB.st.gens.every((g) => g.user_id === 1), "B owns some rows");
});
await test("R2: repeat merge for same account is idempotent", async () => {
  const e = env([job(1, "done")]);
  await mergeGuestJobs(e, req(), 1); await mergeGuestJobs(e, req(), 1);
  assert(e.DB.st.gens.length === 1, `rows=${e.DB.st.gens.length}`);
});
// Risk 3
await test("R3: 5 parallel auth requests (same user) -> one row per provider job", async () => {
  const e = env([job(1), job(2, "done")]);
  await Promise.all(Array.from({ length: 5 }, () => mergeGuestJobs(e, req(), 1)));
  assert(e.DB.st.gens.length === 2, `rows=${e.DB.st.gens.length}`);
  const marks = e.DB.st.events.filter((x) => x.reason.startsWith("guest_import:"));
  assert(marks.length === 1 && marks.every((m) => m.delta === 0), `import markers=${marks.length}`);
});
await test("R3: parallel A+B with same cookie -> each job owned by exactly one user, zero credits", async () => {
  const e = env([job(1), job(2)]);
  await Promise.all([mergeGuestJobs(e, req(), 1), mergeGuestJobs(e, req(), 2)]);
  assert(e.DB.st.gens.length === 2, `rows=${e.DB.st.gens.length}`);
  for (const g of [...e.DB.st.gens]) await settleAccountJob(e, { ...g }, "https://x.test", FAIL);
  assert([...e.DB.st.users.values()].every((c) => c === 0), "credits granted: " + JSON.stringify([...e.DB.st.users]));
});

const pass = results.filter((r) => r[1]).length;
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
