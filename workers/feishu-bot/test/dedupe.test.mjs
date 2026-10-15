import assert from "node:assert/strict";
import test from "node:test";
import { dedupeKeys, hasProcessed, markProcessed } from "../src/dedupe.mjs";

function fakeKv(initial = new Map()) {
  const map = new Map(initial);
  const writes = [];
  return {
    map,
    writes,
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value, options) {
      writes.push({ key, value, options });
      map.set(key, value);
    },
  };
}

test("builds distinct namespaced keys for event and message IDs", () => {
  assert.deepEqual(dedupeKeys("evt-1", "om_1"), [
    "feishu:processed:event:evt-1",
    "feishu:processed:message:om_1",
  ]);
});

test("detects a previously processed event or message", async () => {
  const eventKey = dedupeKeys("evt-1", "om_1")[0];
  const messageKey = dedupeKeys("evt-2", "om_2")[1];

  assert.equal(await hasProcessed(fakeKv(), "evt-1", "om_1"), false);
  assert.equal(await hasProcessed(fakeKv(new Map([[eventKey, "1"]])), "evt-1", "om_1"), true);
  assert.equal(await hasProcessed(fakeKv(new Map([[messageKey, "1"]])), "evt-2", "om_2"), true);
});

test("writes completion markers for both IDs with a seven-day TTL", async () => {
  const kv = fakeKv();

  await markProcessed(kv, "evt-1", "om_1");

  assert.deepEqual(kv.writes, [
    { key: "feishu:processed:event:evt-1", value: "1", options: { expirationTtl: 604800 } },
    { key: "feishu:processed:message:om_1", value: "1", options: { expirationTtl: 604800 } },
  ]);
  assert.equal(await hasProcessed(kv, "evt-1", "om_1"), true);
});
