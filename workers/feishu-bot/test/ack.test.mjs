import assert from "node:assert/strict";
import test from "node:test";
import { ACK_FALLBACK_TEXT, ACK_SIGNATURE, ackKey } from "../src/ack.mjs";

test("exports the single fixed acknowledgement text with the em-dash signature", () => {
  assert.equal(ACK_SIGNATURE, "——老三");
  assert.equal(ACK_FALLBACK_TEXT, "收到，马上处理，结果稍后回复。——老三");
  assert.equal(ACK_FALLBACK_TEXT.endsWith(ACK_SIGNATURE), true);
});

test("namespaces the per-message acknowledgement dedupe key", () => {
  assert.equal(ackKey("om_1"), "feishu:acked:message:om_1");
});
