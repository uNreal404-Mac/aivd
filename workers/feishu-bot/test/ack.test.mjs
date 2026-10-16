import assert from "node:assert/strict";
import test from "node:test";
import { ACK_FALLBACK_TEXT, ackKey } from "../src/ack.mjs";

test("exports the fixed acknowledgement text", () => {
  assert.equal(ACK_FALLBACK_TEXT, "收到，马上处理，结果稍后回复。——老三");
});

test("namespaces the per-message acknowledgement dedupe key", () => {
  assert.equal(ackKey("om_1"), "feishu:acked:message:om_1");
});
